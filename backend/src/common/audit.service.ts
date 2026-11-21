import { Injectable, Logger } from '@nestjs/common';
import { Db } from './db';

export interface AuditEntry {
  actor?: { id: string; name: string } | null;
  action: string;
  entityType?: string;
  entityId?: string;
  summary?: string;
  reason?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

/** The permanent audit log: who, what, target, reason, time and IP address. A logging failure never breaks the request. */
@Injectable()
export class Audit {
  private readonly log = new Logger('Audit');
  constructor(private readonly db: Db) {}

  async record(e: AuditEntry): Promise<void> {
    try {
      await this.db.q(
        `INSERT INTO activity_log (actor_id, actor_name, action, entity_type, entity_id, summary, reason, details, ip) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [e.actor?.id ?? null, e.actor?.name || 'Visitor', e.action, e.entityType ?? '', e.entityId ?? '', (e.summary ?? '').slice(0, 600), (e.reason ?? '').slice(0, 2000), JSON.stringify(e.details ?? {}), e.ip ?? ''],
      );
    } catch (err) {
      this.log.error(`Could not write audit entry "${e.action}": ${(err as Error).message}`);
    }
  }
}
