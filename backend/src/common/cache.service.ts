import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { config } from '../config/config';

/**
 * A small cache for frequently read public data (the trending feed, counts, lists). It lives in Redis when REDIS_URL is
 * set, so every copy of the API shares it, and otherwise in memory. Entries are short-lived and can be rebuilt at any time.
 */
@Injectable()
export class Cache implements OnApplicationShutdown {
  private readonly mem = new Map<string, { exp: number; value: string }>();
  private redis?: { get: (k: string) => Promise<string | null>; set: (...a: unknown[]) => Promise<unknown>; del: (...k: string[]) => Promise<unknown>; keys: (p: string) => Promise<string[]>; quit: () => Promise<unknown> };

  constructor() {
    if (config.redisUrl) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require('ioredis');
      this.redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 2 });
    }
  }
  async onApplicationShutdown() { await this.redis?.quit().catch(() => undefined); }

  async wrap<T>(key: string, ttlSeconds: number, make: () => Promise<T>): Promise<T> {
    const k = `msh:cache:${key}`;
    try {
      const hit = this.redis ? await this.redis.get(k) : (() => { const e = this.mem.get(k); return e && e.exp > Date.now() ? e.value : null; })();
      if (hit) return JSON.parse(hit) as T;
    } catch { /* a cache problem never breaks a request */ }
    const value = await make();
    try {
      const s = JSON.stringify(value);
      if (this.redis) await this.redis.set(k, s, 'EX', ttlSeconds);
      else { if (this.mem.size > 500) this.mem.clear(); this.mem.set(k, { exp: Date.now() + ttlSeconds * 1000, value: s }); }
    } catch { /* ignore */ }
    return value;
  }
  /** Drops cached entries whose key starts with the prefix (for example when a story is published or removed). */
  async drop(prefix: string) {
    const p = `msh:cache:${prefix}`;
    try {
      if (this.redis) { const keys = await this.redis.keys(`${p}*`); if (keys.length) await this.redis.del(...keys); }
      else for (const k of [...this.mem.keys()]) if (k.startsWith(p)) this.mem.delete(k);
    } catch { /* ignore */ }
  }
}
