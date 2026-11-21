import { Injectable, Logger } from '@nestjs/common';
import { Db } from './db';
import { AuthUser } from './decorators';
import { pseudonym } from './field-crypto';
import { Realtime } from './realtime.gateway';
import { createHash } from 'crypto';

/**
 * Records interactions as analytics events, apart from the main data, with pseudonymised user references,
 * and keeps the daily totals the live charts read (Section 2.10). Never breaks the request that caused it.
 */
@Injectable()
export class Track {
  private readonly log = new Logger('Analytics');
  constructor(private readonly db: Db, private readonly live: Realtime) {}

  actor(user: AuthUser | undefined | null, visitor = ''): { actor: string; actorType: string } {
    if (user) return { actor: pseudonym(user.id), actorType: user.role };
    return { actor: visitor ? createHash('sha256').update(`${new Date().toISOString().slice(0, 10)}|${visitor}`).digest('base64url').slice(0, 22) : '', actorType: 'visitor' };
  }

  async event(type: string, who: { actor: string; actorType: string }, opts: { storyId?: string; meta?: Record<string, unknown>; metrics?: string[] } = {}) {
    try {
      await this.db.q(`INSERT INTO analytics_events (type, story_id, actor, actor_type, meta) VALUES ($1,$2,$3,$4,$5)`, [type, opts.storyId ?? null, who.actor, who.actorType, JSON.stringify(opts.meta ?? {})]);
      await this.bump([type, ...(opts.metrics ?? [])]);
    } catch (e) { this.log.warn(`Could not record ${type}: ${(e as Error).message}`); }
  }
  /** Adds to today's totals and tells open analytics screens. */
  async bump(metrics: string[], by = 1) {
    try {
      for (const metric of metrics) {
        const row = await this.db.one(`INSERT INTO analytics_daily (day, metric, value) VALUES ((now() AT TIME ZONE 'Africa/Nairobi')::date, $1, $2) ON CONFLICT (day, metric) DO UPDATE SET value = analytics_daily.value + $2 RETURNING day, value`, [metric, by]);
        this.live.toTeam('analytics', { metric, day: row?.day, value: Number(row?.value ?? 0) });
      }
    } catch (e) { this.log.warn(`Could not update totals: ${(e as Error).message}`); }
  }
}
