import { Logger } from '@nestjs/common';
import { monitorEventLoopDelay } from 'perf_hooks';

/**
 * Performance monitoring (Sections 9.4 and 11.8): how long requests and database queries take, how busy the
 * server is, and the error rate, over a rolling window of the last few minutes. It is kept in memory, per
 * server process, so it costs nothing to collect and never touches the database on the request path.
 *
 * It also decides when the server is **busy** (graceful degradation, Section 9.4): when the event loop is lagging
 * or responses have become slow, the live analytics broadcasts are thinned and heavy background work waits, so
 * that reading and sharing stories stay quick.
 */
const WINDOW_MS = 5 * 60_000;
const BUCKET_MS = 10_000;
const BUCKETS = WINDOW_MS / BUCKET_MS;
/** Event-loop lag (p99, ms) above which the server counts as busy. */
const BUSY_LAG_MS = Number(process.env.BUSY_LAG_MS ?? 200);
/** Queries slower than this are logged and listed for the Super Admins. */
export const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS ?? 500);

interface Bucket { at: number; durations: number[]; errors: number; count: number }
export interface SlowEntry { what: string; ms: number; at: string; count: number }

const pct = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : 0);
export const percentile = (values: number[], p: number) => pct([...values].sort((a, b) => a - b), p);

class Monitor {
  private readonly log = new Logger('Performance');
  private buckets: Bucket[] = [];
  private readonly lag = monitorEventLoopDelay({ resolution: 20 });
  private lastLag = { p50: 0, p99: 0, max: 0 };
  private lagTimer?: NodeJS.Timeout;
  private readonly slowRoutes = new Map<string, SlowEntry>();
  private readonly slowQueries = new Map<string, SlowEntry>();
  private forcedBusy: boolean | null = null;
  /** Off in the automated tests, so a slow test machine never holds back the work a test is waiting for. */
  busyDetection = process.env.BUSY_DETECTION !== 'false' && process.env.NODE_ENV !== 'test';
  readonly startedAt = Date.now();
  totalRequests = 0;
  totalErrors = 0;

  start() {
    if (this.lagTimer) return;
    this.lag.enable();
    this.lagTimer = setInterval(() => {
      this.lastLag = { p50: this.lag.percentile(50) / 1e6, p99: this.lag.percentile(99) / 1e6, max: this.lag.max / 1e6 };
      this.lag.reset();
    }, 5_000);
    this.lagTimer.unref();
  }
  stop() { if (this.lagTimer) clearInterval(this.lagTimer); this.lagTimer = undefined; this.lag.disable(); }

  private bucket(now = Date.now()): Bucket {
    const at = now - (now % BUCKET_MS);
    let b = this.buckets[this.buckets.length - 1];
    if (!b || b.at !== at) {
      b = { at, durations: [], errors: 0, count: 0 };
      this.buckets.push(b);
      const oldest = now - WINDOW_MS;
      while (this.buckets.length && this.buckets[0].at < oldest) this.buckets.shift();
      if (this.buckets.length > BUCKETS + 1) this.buckets.splice(0, this.buckets.length - BUCKETS - 1);
    }
    return b;
  }

  /** One finished API request. `route` is the route pattern (never the address with its ids). */
  request(route: string, status: number, ms: number) {
    const b = this.bucket();
    b.count++; this.totalRequests++;
    if (b.durations.length < 20_000) b.durations.push(ms);
    if (status >= 500) { b.errors++; this.totalErrors++; }
    if (ms >= 1000) this.note(this.slowRoutes, route, ms);
  }

  /** One database query; slow ones are logged with their first words, never their values. */
  query(sql: string, ms: number) {
    if (ms < SLOW_QUERY_MS) return;
    const what = sql.replace(/\s+/g, ' ').trim().slice(0, 160);
    this.note(this.slowQueries, what, ms);
    this.log.warn(`Slow query (${Math.round(ms)} ms): ${what}`);
  }

  private note(map: Map<string, SlowEntry>, what: string, ms: number) {
    const e = map.get(what);
    if (e) { e.count++; if (ms > e.ms) e.ms = Math.round(ms); e.at = new Date().toISOString(); }
    else {
      if (map.size >= 50) { const smallest = [...map.entries()].sort((a, b) => a[1].ms - b[1].ms)[0]; map.delete(smallest[0]); }
      map.set(what, { what, ms: Math.round(ms), at: new Date().toISOString(), count: 1 });
    }
  }

  /** Figures for the last `minutes` (at most 5). */
  window(minutes = 5) {
    const since = Date.now() - minutes * 60_000;
    const bs = this.buckets.filter((b) => b.at + BUCKET_MS > since);
    const durations = bs.flatMap((b) => b.durations).sort((a, b) => a - b);
    const count = bs.reduce((n, b) => n + b.count, 0);
    const errors = bs.reduce((n, b) => n + b.errors, 0);
    const span = Math.max(1, Math.min(minutes * 60, (Date.now() - Math.max(since, this.startedAt)) / 1000));
    return {
      minutes, requests: count, perMinute: Math.round((count / span) * 60 * 10) / 10,
      p50: Math.round(pct(durations, 50)), p95: Math.round(pct(durations, 95)), p99: Math.round(pct(durations, 99)),
      errors, errorRate: count ? Math.round((errors / count) * 1000) / 10 : 0,
    };
  }

  /** Busy: the event loop is lagging, or recent responses are slow. */
  get busy(): boolean {
    if (this.forcedBusy !== null) return this.forcedBusy;
    if (!this.busyDetection) return false;
    // Worked out at most once a second: it is asked on every analytics update and job, and sorting the last
    // minute's response times each time would itself slow the server down.
    const now = Date.now();
    if (now - this.busyAt < 1000) return this.busyCached;
    this.busyAt = now;
    const w = this.lastLag.p99 > BUSY_LAG_MS ? null : this.window(1);
    this.busyCached = !w || (w.requests >= 30 && w.p95 > 1500);
    return this.busyCached;
  }
  private busyAt = 0;
  private busyCached = false;
  /** For tests: hold the busy state on or off (null returns to measuring). */
  forceBusy(v: boolean | null) { this.forcedBusy = v; }

  snapshot() {
    const mem = process.memoryUsage();
    return {
      busy: this.busy,
      uptimeSeconds: Math.round(process.uptime()),
      last1: this.window(1),
      last5: this.window(5),
      eventLoopLagMs: { p50: Math.round(this.lastLag.p50), p99: Math.round(this.lastLag.p99), max: Math.round(this.lastLag.max), busyAbove: BUSY_LAG_MS },
      memoryMb: { rss: Math.round(mem.rss / 1048576), heapUsed: Math.round(mem.heapUsed / 1048576) },
      slowRoutes: [...this.slowRoutes.values()].sort((a, b) => b.ms - a.ms).slice(0, 15),
      slowQueries: [...this.slowQueries.values()].sort((a, b) => b.ms - a.ms).slice(0, 15),
      slowQueryMs: SLOW_QUERY_MS,
      totals: { requests: this.totalRequests, errors: this.totalErrors },
    };
  }

  /** The same figures in the Prometheus text format, for an outside monitoring service. */
  prometheus(): string {
    const s = this.snapshot();
    const lines = [
      '# HELP msh_requests_total API requests since the server started.', '# TYPE msh_requests_total counter', `msh_requests_total ${s.totals.requests}`,
      '# HELP msh_errors_total API responses with a server error (5xx).', '# TYPE msh_errors_total counter', `msh_errors_total ${s.totals.errors}`,
      '# HELP msh_request_ms API response time over the last 5 minutes.', '# TYPE msh_request_ms gauge',
      `msh_request_ms{quantile="0.5"} ${s.last5.p50}`, `msh_request_ms{quantile="0.95"} ${s.last5.p95}`, `msh_request_ms{quantile="0.99"} ${s.last5.p99}`,
      '# HELP msh_event_loop_lag_ms Event-loop lag (p99).', '# TYPE msh_event_loop_lag_ms gauge', `msh_event_loop_lag_ms ${s.eventLoopLagMs.p99}`,
      '# HELP msh_busy 1 while the server is shedding optional work.', '# TYPE msh_busy gauge', `msh_busy ${s.busy ? 1 : 0}`,
      '# HELP msh_memory_rss_mb Resident memory.', '# TYPE msh_memory_rss_mb gauge', `msh_memory_rss_mb ${s.memoryMb.rss}`,
    ];
    return lines.join('\n') + '\n';
  }

  /** Only for tests. */
  reset() { this.busyAt = 0; this.busyCached = false; this.busyDetection = process.env.BUSY_DETECTION !== 'false' && process.env.NODE_ENV !== 'test'; this.buckets = []; this.slowRoutes.clear(); this.slowQueries.clear(); this.totalRequests = 0; this.totalErrors = 0; this.forcedBusy = null; }
}

export const perf = new Monitor();
