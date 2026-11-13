import { Controller, Get, Header, Injectable, Logger, Module, OnApplicationBootstrap, OnApplicationShutdown, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { DataSource, Repository } from 'typeorm';
import { Roles } from '../common/decorators';
import { PageQuery, pageOf } from '../common/pagination';
import { MailService } from '../common/mail.service';
import { config } from '../config/config';
import { Activity } from '../database/entities';
import { AuthModule } from '../auth/auth.module';

class ActivityQuery extends PageQuery {
  @ApiPropertyOptional({ description: 'Action prefix, for example "login" or "record"' }) @IsOptional() @IsString() @MaxLength(40) action?: string;
}
class ExportQuery {
  @ApiPropertyOptional({ enum: ['records', 'activity', 'submissions'] }) @IsOptional() @IsIn(['records', 'activity', 'submissions']) kind?: 'records' | 'activity' | 'submissions';
}

/** CSV cell, quoted, with spreadsheet formula injection neutralised. */
const cell = (v: unknown) => {
  let s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return '﻿' + [cols.map(cell).join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n';
};

@Injectable()
export class ReportsService {
  constructor(private readonly ds: DataSource, @InjectRepository(Activity) private readonly activity: Repository<Activity>) {}

  async summary() {
    const q = <T = Record<string, unknown>>(sql: string) => this.ds.query(sql) as Promise<T[]>;
    const [totals, byType, byWater, byStatus, topRecords, viewsByMonth, submissionsByMonth, recent] = await Promise.all([
      q(`SELECT
           (SELECT count(*) FROM records WHERE deleted_at IS NULL)::int AS records,
           (SELECT count(*) FROM records WHERE status = 'published' AND deleted_at IS NULL)::int AS published,
           (SELECT count(*) FROM records WHERE status = 'draft' AND deleted_at IS NULL)::int AS drafts,
           (SELECT count(*) FROM users WHERE status <> 'deleted')::int AS users,
           (SELECT count(*) FROM users WHERE last_login_at > now() - interval '30 days')::int AS active_users_30d,
           (SELECT count(*) FROM submissions WHERE status = 'pending')::int AS pending_submissions,
           (SELECT count(*) FROM messages WHERE NOT read)::int AS unread_messages,
           (SELECT coalesce(sum(views), 0) FROM records WHERE deleted_at IS NULL)::int AS total_views,
           (SELECT coalesce(sum(size_bytes), 0) FROM media_files)::bigint AS storage_bytes`),
      q(`SELECT type, count(*)::int AS count FROM records WHERE status = 'published' AND deleted_at IS NULL GROUP BY type ORDER BY count DESC`),
      q(`SELECT coalesce(w.name, 'Not set') AS water_body, count(*)::int AS count FROM records r LEFT JOIN water_bodies w ON w.id = r.water_body_id
         WHERE r.status = 'published' AND r.deleted_at IS NULL GROUP BY w.name ORDER BY count DESC`),
      q(`SELECT status, count(*)::int AS count FROM records WHERE deleted_at IS NULL GROUP BY status`),
      q(`SELECT id, identifier, title, type, views FROM records WHERE deleted_at IS NULL ORDER BY views DESC, title LIMIT 5`),
      q(`SELECT to_char(m, 'YYYY-MM') AS month, coalesce(v.count, 0)::int AS count
         FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m
         LEFT JOIN (SELECT date_trunc('month', viewed_at) AS mm, count(*) FROM record_views GROUP BY 1) v ON v.mm = m ORDER BY m`),
      q(`SELECT to_char(m, 'YYYY-MM') AS month, coalesce(s.count, 0)::int AS count
         FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m
         LEFT JOIN (SELECT date_trunc('month', created_at) AS mm, count(*) FROM submissions GROUP BY 1) s ON s.mm = m ORDER BY m`),
      this.activity.find({ order: { createdAt: 'DESC' }, take: 10 }),
    ]);
    const t = totals[0] as Record<string, number | string>;
    return {
      totals: {
        records: t.records, published: t.published, drafts: t.drafts, users: t.users, activeUsers30d: t.active_users_30d,
        pendingSubmissions: t.pending_submissions, unreadMessages: t.unread_messages, totalViews: t.total_views, storageBytes: Number(t.storage_bytes),
        storageAlertBytes: config.alerts.storageGb ? config.alerts.storageGb * 1024 ** 3 : null,
      },
      byType, byWaterBody: byWater, byStatus, topRecords, viewsByMonth, submissionsByMonth, recentActivity: recent,
    };
  }

  async activityLog(q: ActivityQuery) {
    const qb = this.activity.createQueryBuilder('a').orderBy('a.createdAt', 'DESC').skip((q.page - 1) * q.pageSize).take(q.pageSize);
    if (q.action) qb.where('a.action LIKE :a', { a: `${q.action.replace(/[%_\\]/g, '')}%` });
    const [items, total] = await qb.getManyAndCount();
    return pageOf(items, total, q);
  }

  async exportRows(kind: 'records' | 'activity' | 'submissions'): Promise<Record<string, unknown>[]> {
    if (kind === 'activity') {
      return this.ds.query(`SELECT created_at AS "when", actor_name AS "who", action, entity_type AS "item type", entity_id AS "item id", summary, ip
                            FROM activity_log ORDER BY created_at DESC LIMIT 50000`);
    }
    if (kind === 'submissions') {
      return this.ds.query(`SELECT s.reference, s.created_at AS "submitted", u.name AS "contributor", u.email, s.type, s.title, s.year,
                              w.name AS "water body", s.place, s.status, s.review_note AS "review note", s.reviewed_at AS "reviewed"
                            FROM submissions s JOIN users u ON u.id = s.submitted_by_id LEFT JOIN water_bodies w ON w.id = s.water_body_id
                            ORDER BY s.created_at DESC`);
    }
    return this.ds.query(`SELECT r.identifier, r.type, r.format, r.title, r.summary, r.year, w.name AS "water body", r.county, r.place,
                            r.latitude, r.longitude, (SELECT string_agg(s.label, '; ' ORDER BY s.label) FROM record_subjects rs JOIN subjects s ON s.id = rs.subject_id WHERE rs.record_id = r.id) AS subjects,
                            r.creator, r.narrator, r.interviewer, r.photographer, r.language, r.rights, r.consent, r.status, r.views, r.published_at AS "published", r.created_at AS "added"
                          FROM records r LEFT JOIN water_bodies w ON w.id = r.water_body_id WHERE r.deleted_at IS NULL ORDER BY r.identifier`);
  }
}

@ApiTags('Admin: reports') @ApiBearerAuth() @Roles('admin')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Roles('admin', 'editor') @Get('summary') @ApiOperation({ summary: 'Dashboard figures and charts' })
  summary() { return this.reports.summary(); }

  @Get('activity') @ApiOperation({ summary: 'Audit log of sign-ins and admin actions' })
  activity(@Query() q: ActivityQuery) { return this.reports.activityLog(q); }

  @Get('export') @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Download a CSV of records, submissions or the activity log' })
  async export(@Query() q: ExportQuery, @Res() res: Response) {
    const kind = q.kind ?? 'records';
    const csv = toCsv(await this.reports.exportRows(kind));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="maritime-heritage-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }
}

/**
 * Checks media storage once a day and emails ALERT_EMAILS when use passes 80% of STORAGE_ALERT_GB,
 * so the team can add space or move masters to an archive tier well before any limit.
 */
@Injectable()
export class StorageMonitor implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('StorageMonitor');
  private timer: NodeJS.Timeout | null = null;
  private lastAlertDay = '';
  constructor(private readonly ds: DataSource, private readonly mail: MailService) {}

  onApplicationBootstrap() {
    if (!config.alerts.storageGb) return;
    this.timer = setInterval(() => void this.check(), 6 * 3600_000);
    this.timer.unref();
    setTimeout(() => void this.check(), 60_000).unref();
  }
  onApplicationShutdown() { if (this.timer) clearInterval(this.timer); }

  async check(): Promise<{ usedBytes: number; limitBytes: number; percent: number } | null> {
    if (!config.alerts.storageGb) return null;
    const [{ used }] = await this.ds.query(`SELECT coalesce(sum(size_bytes), 0)::bigint AS used FROM media_files`);
    const usedBytes = Number(used), limitBytes = config.alerts.storageGb * 1024 ** 3;
    const percent = Math.round((usedBytes / limitBytes) * 100);
    const today = new Date().toISOString().slice(0, 10);
    if (percent >= 80 && this.lastAlertDay !== today) {
      this.lastAlertDay = today;
      const gb = (usedBytes / 1024 ** 3).toFixed(1);
      this.log.warn(`Media storage at ${percent}% (${gb} GB of ${config.alerts.storageGb} GB)`);
      for (const to of config.alerts.emails) {
        await this.mail.send(to, `Archive storage at ${percent}%`,
          `The Maritime Safety Heritage Archive is using ${gb} GB of the ${config.alerts.storageGb} GB storage alert level (${percent}%).\n\n` +
          `Add space with the storage provider, or move older master files to the archive tier. Then raise STORAGE_ALERT_GB in the server settings.\n`);
      }
    }
    return { usedBytes, limitBytes, percent };
  }
}

@Module({ imports: [AuthModule, TypeOrmModule.forFeature([Activity])], controllers: [ReportsController], providers: [ReportsService, StorageMonitor] })
export class ReportsModule {}
