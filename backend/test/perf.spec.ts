import { perf, percentile } from '../src/common/perf';
import { PerfService } from '../src/health/perf.module';

describe('Performance monitoring (Section 9.4)', () => {
  beforeEach(() => perf.reset());

  it('works out percentiles', () => {
    const v = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(v, 50)).toBe(50);
    expect(percentile(v, 95)).toBe(95);
    expect(percentile([], 95)).toBe(0);
  });

  it('keeps response times, errors and slow requests', () => {
    for (let i = 0; i < 95; i++) perf.request('/api/v1/stories', 200, 20);
    for (let i = 0; i < 5; i++) perf.request('/api/v1/stories/:id', 500, 1200);
    const w = perf.window(5);
    expect(w.requests).toBe(100);
    expect(w.p50).toBe(20);
    expect(w.p99).toBe(1200);
    expect(w.errorRate).toBe(5);
    const s = perf.snapshot();
    expect(s.slowRoutes[0]).toMatchObject({ what: '/api/v1/stories/:id', ms: 1200, count: 5 });
    expect(s.totals).toEqual({ requests: 100, errors: 5 });
  });

  it('lists slow queries by their first words, without values', () => {
    perf.query('SELECT 1', 3);
    perf.query('SELECT *\n  FROM stories WHERE id = $1', 900);
    const s = perf.snapshot();
    expect(s.slowQueries).toHaveLength(1);
    expect(s.slowQueries[0].what).toBe('SELECT * FROM stories WHERE id = $1');
  });

  it('counts as busy when responses are slow', () => {
    perf.busyDetection = true;
    expect(perf.busy).toBe(false);
    for (let i = 0; i < 40; i++) perf.request('/api/v1/stories', 200, 2000);
    expect(perf.busy).toBe(false); // the answer is kept for a second
    (perf as any).busyAt = 0;
    expect(perf.busy).toBe(true);
  });

  it('gives Prometheus text', () => {
    perf.request('/api/v1/health', 200, 5);
    const text = perf.prometheus();
    expect(text).toContain('msh_requests_total 1');
    expect(text).toMatch(/msh_request_ms\{quantile="0.95"\} 5/);
  });

  it('alerts the Super Admins when slow, at most once an hour', async () => {
    const sent: any[] = [];
    const svc = new PerfService({} as any, { every: () => undefined } as any, { superAdmins: async (n: any) => { sent.push(n); } } as any);
    for (let i = 0; i < 60; i++) perf.request('/api/v1/stories', 200, 10);
    expect(await svc.checkAlerts(1e12)).toEqual({ alerted: false });
    for (let i = 0; i < 60; i++) perf.request('/api/v1/stories', 200, 800);
    expect((await svc.checkAlerts(1e12)).alerted).toBe(true);
    expect((await svc.checkAlerts(1e12 + 60_000)).alerted).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: 'performance.alert', link: '/super/system' });
  });
});

describe('Busy mode: optional work gives way (Section 9.4)', () => {
  afterEach(() => { perf.forceBusy(null); jest.useRealTimers(); });

  it('holds live analytics while busy and sends the newest value once, every 10 seconds', async () => {
    jest.useFakeTimers();
    const { Track } = await import('../src/common/track.service');
    let value = 0;
    const sent: any[] = [];
    const track = new Track({ one: async () => ({ day: '2026-11-25', value: ++value }) } as any, { toTeam: (_e: string, p: any) => sent.push(p) } as any);
    await track.bump(['story.view']);
    expect(sent).toHaveLength(1);
    perf.forceBusy(true);
    await track.bump(['story.view']); await track.bump(['story.view']); await track.bump(['story.view']);
    expect(sent).toHaveLength(1);
    jest.advanceTimersByTime(10_000);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ metric: 'story.view', value: 4 });
  });

  it('runs heavy jobs only when the server is not busy', async () => {
    const { Jobs, HEAVY_JOBS } = await import('../src/common/jobs.service');
    const calls: any[] = [];
    const jobs = new Jobs({ one: async (_sql: string, params: unknown[]) => { calls.push(params); return null; }, q: async () => [] } as any);
    perf.forceBusy(true);
    await (jobs as any).tick();
    perf.forceBusy(false);
    await (jobs as any).tick();
    expect(calls[0]).toEqual([true, HEAVY_JOBS]);
    expect(calls[1]).toEqual([false, HEAVY_JOBS]);
    expect(HEAVY_JOBS).toEqual(expect.arrayContaining(['archive.export', 'analytics.report', 'story.transcribe']));
    expect(HEAVY_JOBS).not.toContain('story.review');
  });
});
