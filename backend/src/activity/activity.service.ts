import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators';
import { Activity } from '../database/entities';

export interface LogEntry {
  actor?: Pick<AuthUser, 'id' | 'name'> | null;
  action: string;
  entityType?: string;
  entityId?: string;
  summary?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

/** Writes the audit trail. A logging failure never breaks the request that caused it. */
@Injectable()
export class ActivityService {
  private readonly log = new Logger('Activity');
  constructor(@InjectRepository(Activity) private readonly repo: Repository<Activity>) {}

  async record(e: LogEntry): Promise<void> {
    try {
      await this.repo.insert({
        actorId: e.actor?.id || null, actorName: (e.actor?.name || 'Visitor').slice(0, 120), action: e.action,
        entityType: e.entityType ?? '', entityId: e.entityId ?? '', summary: (e.summary ?? '').slice(0, 400),
        details: e.details ?? {}, ip: e.ip ?? '',
      });
    } catch (err) {
      this.log.error(`Could not write activity "${e.action}": ${(err as Error).message}`);
    }
  }
}
