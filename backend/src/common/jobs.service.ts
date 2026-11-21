import { Injectable, Logger, OnApplicationShutdown, OnApplicationBootstrap } from '@nestjs/common';
import { config } from '../config/config';
import { Db } from './db';

export type JobHandler = (payload: any, ctx: { progress: (pct: number) => Promise<void>; attempt: number }) => Promise<void>;
interface AddOptions { delayMs?: number; attempts?: number }

/**
 * Background jobs with retries (Section 2.11). Slow work never runs inside a user's request.
 * With REDIS_URL set, jobs go through BullMQ so separate workers can share the queue; otherwise they go through a queue
 * table in PostgreSQL and run inside this process. Both survive a restart.
 */
@Injectable()
export class Jobs implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('Jobs');
  private readonly handlers = new Map<string, JobHandler>();
  private readonly recurring: Array<{ name: string; everyMs: number; fn: () => Promise<unknown>; timer?: NodeJS.Timeout }> = [];
  private running = 0;
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private bull?: { queue: any; worker?: any };
  private idleWaiters: Array<() => void> = [];

  constructor(private readonly db: Db) {}

  handle(name: string, fn: JobHandler) { this.handlers.set(name, fn); }
  /** Repeating housekeeping (trending, analytics, purging, reminders). */
  every(name: string, everyMs: number, fn: () => Promise<unknown>) { this.recurring.push({ name, everyMs, fn }); }

  async onApplicationBootstrap() {
    if (config.redisUrl) {
      const { Queue, Worker } = await import('bullmq');
      const connection = { url: config.redisUrl, maxRetriesPerRequest: null as null };
      const queue = new Queue('msh', { connection });
      this.bull = { queue };
      if (config.jobsWorker) {
        this.bull.worker = new Worker('msh', async (job: any) => {
          const fn = this.handlers.get(job.name);
          if (!fn) throw new Error(`No handler for job ${job.name}`);
          await fn(job.data, { progress: async (p) => { await job.updateProgress(p); }, attempt: job.attemptsMade + 1 });
        }, { connection, concurrency: 3 });
        this.bull.worker.on('failed', (job: any, err: Error) => this.log.warn(`Job ${job?.name} failed: ${err.message}`));
      }
    } else if (config.jobsWorker) {
      await this.db.q(`UPDATE jobs SET status = 'queued' WHERE status = 'working'`);
      this.timer = setInterval(() => void this.tick(), config.env === 'test' ? 200 : 2000);
      this.timer.unref();
    }
    if (config.jobsWorker && config.env !== 'test') {
      for (const r of this.recurring) {
        r.timer = setInterval(() => void r.fn().catch((e) => this.log.warn(`${r.name}: ${e.message}`)), r.everyMs);
        r.timer.unref();
      }
    }
  }

  async onApplicationShutdown() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    for (const r of this.recurring) if (r.timer) clearInterval(r.timer);
    await this.bull?.worker?.close();
    await this.bull?.queue?.close();
  }

  async add(name: string, payload: Record<string, unknown> = {}, opts: AddOptions = {}): Promise<void> {
    if (this.bull) {
      await this.bull.queue.add(name, payload, { delay: opts.delayMs, attempts: opts.attempts ?? 4, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 500, removeOnFail: 2000 });
      return;
    }
    await this.db.q(`INSERT INTO jobs (name, payload, run_at) VALUES ($1, $2, now() + ($3 || ' milliseconds')::interval)`, [name, JSON.stringify(payload), String(opts.delayMs ?? 0)]);
    setImmediate(() => void this.tick());
  }

  /** Runs one recurring task now (used by tests and by the admin tools). */
  async runRecurring(name: string) { await this.recurring.find((r) => r.name === name)?.fn(); }

  /** Resolves when the queue is empty. Tests use it to wait for AI review and media processing. */
  async idle(timeoutMs = 30_000): Promise<void> {
    if (this.bull) { await new Promise((r) => setTimeout(r, 300)); return; }
    const start = Date.now();
    for (;;) {
      const left = await this.db.one(`SELECT count(*)::int AS n FROM jobs WHERE status IN ('queued','working') AND run_at <= now() + interval '1 second'`);
      if (!left?.n && !this.running) return;
      if (Date.now() - start > timeoutMs) throw new Error('Background jobs did not finish in time.');
      void this.tick();
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  private async tick() {
    if (this.stopped || this.running >= 3) return;
    this.running++;
    try {
      for (;;) {
        if (this.stopped) break;
        const job = await this.db.one(
          `UPDATE jobs SET status = 'working', attempts = attempts + 1 WHERE id = (
             SELECT id FROM jobs WHERE status = 'queued' AND run_at <= now() ORDER BY run_at, id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`);
        if (!job) break;
        const fn = this.handlers.get(job.name);
        try {
          if (!fn) throw new Error(`No handler for job ${job.name}`);
          await fn(job.payload, { progress: async (p) => { await this.db.q(`UPDATE jobs SET progress = $2 WHERE id = $1`, [job.id, Math.round(p)]); }, attempt: job.attempts });
          await this.db.q(`UPDATE jobs SET status = 'done', progress = 100, finished_at = now() WHERE id = $1`, [job.id]);
        } catch (e) {
          const msg = (e as Error).message ?? String(e);
          const final = job.attempts >= 4 || config.env === 'test';
          this.log.warn(`Job ${job.name} #${job.id} failed (attempt ${job.attempts}): ${msg}`);
          await this.db.q(`UPDATE jobs SET status = $2, error = $3, run_at = now() + ($4 || ' seconds')::interval, finished_at = CASE WHEN $2 = 'failed' THEN now() END WHERE id = $1`,
            [job.id, final ? 'failed' : 'queued', msg.slice(0, 1000), String(5 * 2 ** job.attempts)]);
        }
      }
    } catch (e) {
      if (!this.stopped) this.log.warn(`Queue check failed: ${(e as Error).message}`);
    } finally {
      this.running--;
    }
  }
}
