import { Injectable, OnModuleInit } from '@nestjs/common';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Ai } from '../ai/ai.service';
import { Audit } from '../common/audit.service';
import { Db, Row } from '../common/db';
import { AuthUser, RequestMeta } from '../common/decorators';
import { Jobs } from '../common/jobs.service';
import { fail, text } from '../common/messages';
import { Notify } from '../common/notify.service';
import { Pdf } from '../common/pdf';
import { MediaService } from '../media/media.service';

export const CHARTS: Record<string, { title: string; series: Array<{ name: string; metric: string; color: string }> }> = {
  stories: { title: 'Stories posted', series: [{ name: 'Stories', metric: 'story.published', color: '0B6FC2' }] },
  flags: { title: 'AI flags', series: [{ name: 'GREEN', metric: 'flag.green', color: '1E9E5A' }, { name: 'YELLOW', metric: 'flag.yellow', color: 'E0A800' }, { name: 'RED', metric: 'flag.red', color: 'D23B3B' }] },
  active_users: { title: 'Active users', series: [{ name: 'Active users', metric: 'active_users', color: '0B6FC2' }] },
  reports: { title: 'Reports from users', series: [{ name: 'Reports', metric: 'reports', color: '8A4FD3' }] },
  engagement: { title: 'Engagement (reactions, comments, shares, favourites, downloads)', series: [{ name: 'Engagement', metric: 'engagement', color: '0B6FC2' }] },
  visits: { title: 'Views by type of user', series: [{ name: 'Visitors', metric: 'visits.visitor', color: '7FB2E5' }, { name: 'Contributors', metric: 'visits.contributor', color: '0B6FC2' }] },
  safety: { title: 'Safety concerns raised', series: [{ name: 'Safety concerns', metric: 'safety_concerns', color: 'D2691E' }] },
};
type Period = 'day' | 'week' | 'month' | 'year';
const TRUNC: Record<Period, string> = { day: 'day', week: 'week', month: 'month', year: 'year' };

/** Live analytics and PDF reports (Sections 2.10 and 11.9). Charts read daily totals that are kept apart from the main data. */
@Injectable()
export class AnalyticsService implements OnModuleInit {
  constructor(private readonly db: Db, private readonly ai: Ai, private readonly jobs: Jobs, private readonly media: MediaService, private readonly notify: Notify, private readonly audit: Audit) {}

  onModuleInit() {
    this.jobs.handle('analytics.report', async ({ id }) => { await this.buildReport(id); });
    this.jobs.every('analytics.daily', 10 * 60_000, () => this.summarise());
    this.jobs.every('analytics.monthly_report', 6 * 3600_000, () => this.automaticMonthly());
  }

  /** Active users per day are counted from the events themselves (distinct pseudonymised people), then stored with the other daily totals. */
  async summarise() {
    await this.db.q(`INSERT INTO analytics_daily (day, metric, value)
      SELECT (created_at AT TIME ZONE 'Africa/Nairobi')::date, 'active_users', count(DISTINCT actor) FROM analytics_events
       WHERE actor <> '' AND actor_type <> 'visitor' AND created_at > now() - interval '3 days' GROUP BY 1
      ON CONFLICT (day, metric) DO UPDATE SET value = EXCLUDED.value`);
  }

  /** One or more metrics per day, week, month or year. */
  async series(chart: string, period: Period, from?: string, to?: string) {
    const def = CHARTS[chart];
    if (!def) return fail(400, 'invalid_input');
    const p = TRUNC[period] ?? 'day';
    const span = { day: '30 days', week: '26 weeks', month: '24 months', year: '10 years' }[p as Period];
    const start = from ?? null, end = to ?? null;
    const rows = await this.db.q(
      `WITH buckets AS (SELECT generate_series(date_trunc($1, coalesce($3::date, (now() - $2::interval)::date)::timestamp), date_trunc($1, coalesce($4::date, now()::date)::timestamp), ('1 ' || $1)::interval)::date AS bucket)
       SELECT b.bucket, m.metric, coalesce(sum(d.value), 0)::int AS value
         FROM buckets b CROSS JOIN unnest($5::text[]) AS m(metric)
         LEFT JOIN analytics_daily d ON d.metric = m.metric AND date_trunc($1, d.day::timestamp)::date = b.bucket
        GROUP BY b.bucket, m.metric ORDER BY b.bucket`, [p, span, start, end, def.series.map((s) => s.metric)]);
    const buckets = [...new Set(rows.map((r) => String(r.bucket).slice(0, 10)))];
    return { chart, title: def.title, period: p, labels: buckets,
      series: def.series.map((s) => ({ name: s.name, metric: s.metric, color: `#${s.color}`, values: buckets.map((b) => rows.find((r) => r.metric === s.metric && String(r.bucket).slice(0, 10) === b)?.value ?? 0) })) };
  }

  /** The measures the platform must report (Section 11.9), for a period or for all time. */
  async summary(from?: string, to?: string): Promise<Row> {
    const a = [from ?? '1970-01-01', to ? `${to} 23:59:59` : '2999-01-01'];
    const s: Row = (await this.db.one(
      `SELECT (SELECT count(*)::int FROM stories WHERE status = 'published') AS published_stories,
        (SELECT count(*)::int FROM stories WHERE status = 'published' AND published_at BETWEEN $1 AND $2) AS stories_in_period,
        (SELECT count(*)::int FROM stories WHERE status = 'published' AND type = 'testimony') AS testimonies,
        (SELECT count(*)::int FROM stories WHERE status = 'published' AND type = 'record') AS historical_records,
        (SELECT count(*)::int FROM stories WHERE status = 'published' AND import_batch_id IS NOT NULL) AS imported_items,
        (SELECT count(*)::int FROM incidents WHERE status = 'published') AS incidents,
        (SELECT count(*)::int FROM incidents WHERE status = 'published' AND latitude IS NOT NULL) AS incidents_mapped,
        (SELECT count(DISTINCT county)::int FROM stories WHERE status = 'published' AND county <> '') AS counties,
        (SELECT coalesce(array_agg(DISTINCT county), '{}') FROM stories WHERE status = 'published' AND county <> '') AS county_list,
        (SELECT count(DISTINCT water_body)::int FROM stories WHERE status = 'published' AND water_body <> '') AS water_bodies,
        (SELECT count(*)::int FROM users WHERE role = 'contributor' AND status IN ('active','warned','suspended') AND profile_complete) AS contributors,
        (SELECT count(*)::int FROM users WHERE role = 'contributor' AND trained AND last_seen_at > now() - interval '30 days') AS trained_active,
        (SELECT count(DISTINCT actor)::int FROM analytics_events WHERE actor <> '' AND actor_type <> 'visitor' AND created_at > now() - interval '30 days') AS monthly_active_users,
        (SELECT count(DISTINCT actor)::int FROM analytics_events WHERE actor <> '' AND actor_type = 'visitor' AND created_at > now() - interval '30 days') AS monthly_visitors,
        (SELECT count(*)::int FROM stories WHERE status = 'published' AND language <> 'en') AS non_english,
        (SELECT count(*)::int FROM stories s WHERE s.status = 'published' AND EXISTS (SELECT 1 FROM media_files m WHERE m.story_id = s.id AND m.kind IN ('audio','video'))) AS audio_video,
        (SELECT count(*)::int FROM resources WHERE status = 'published') AS resources,
        (SELECT coalesce(sum(views), 0)::int FROM resources) AS resource_views, (SELECT coalesce(sum(downloads), 0)::int FROM resources) AS resource_downloads,
        (SELECT count(*)::int FROM reports WHERE status = 'open') AS open_reports,
        (SELECT count(*)::int FROM reports WHERE created_at BETWEEN $1 AND $2) AS reports_in_period,
        (SELECT count(*)::int FROM safety_concerns WHERE created_at BETWEEN $1 AND $2) AS safety_concerns,
        (SELECT count(*)::int FROM shares WHERE kind = 'cite') AS citations, (SELECT coalesce(sum(download_count), 0)::int FROM stories) AS story_downloads,
        (SELECT count(*)::int FROM moderation_decisions WHERE target_type = 'story' AND ai_flag = 'RED' AND admin_action = '' AND created_at BETWEEN $1 AND $2) AS red_items,
        (SELECT count(*)::int FROM moderation_decisions a WHERE a.target_type = 'story' AND a.ai_flag = 'RED' AND a.admin_action = '' AND a.created_at BETWEEN $1 AND $2
            AND EXISTS (SELECT 1 FROM moderation_decisions b WHERE b.target_type = 'story' AND b.target_id = a.target_id AND b.admin_action <> '' AND b.created_at <= a.created_at + interval '24 hours')) AS red_within_24h,
        (SELECT count(*)::int FROM moderation_decisions WHERE admin_action = 'override' AND approved) AS overrides`, a))!;
    return {
      ...s, nonEnglishPercent: s.publishedStories ? Math.round((s.nonEnglish / s.publishedStories) * 100) : 0,
      redWithin24hPercent: s.redItems ? Math.round((s.redWithin24h / s.redItems) * 100) : 100,
      aiOverrideRatePercent: s.redItems ? Math.round((s.overrides / Math.max(1, s.redItems)) * 100) : 0,
      safetyPlaces: await this.db.q(`SELECT place_name, count(*)::int AS n FROM safety_concerns WHERE place_name <> '' AND created_at BETWEEN $1 AND $2 GROUP BY place_name ORDER BY n DESC LIMIT 8`, a),
      flagRatesByLanguage: await this.db.q(`SELECT language, count(*)::int AS stories, count(*) FILTER (WHERE ai_flag = 'RED')::int AS red, count(*) FILTER (WHERE ai_flag = 'YELLOW')::int AS yellow FROM stories WHERE ai_flag IS NOT NULL GROUP BY language ORDER BY stories DESC LIMIT 20`),
      flagRatesByRegion: await this.db.q(`SELECT coalesce(nullif(county, ''), 'Not given') AS county, count(*)::int AS stories, count(*) FILTER (WHERE ai_flag = 'RED')::int AS red FROM stories WHERE ai_flag IS NOT NULL GROUP BY 1 ORDER BY stories DESC LIMIT 20`),
    };
  }

  // ----- PDF reports -----
  async requestReport(user: AuthUser | null, dto: { from: string; to: string; charts?: string[]; title?: string }, meta: RequestMeta, automatic = false) {
    const charts = (dto.charts?.length ? dto.charts : Object.keys(CHARTS)).filter((c) => CHARTS[c]);
    const r = (await this.db.one(`INSERT INTO analytics_reports (title, period_from, period_to, charts, automatic, requested_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [dto.title?.trim() || `Archive report, ${dto.from} to ${dto.to}`, dto.from, dto.to, charts, automatic, user?.id ?? null]))!;
    await this.jobs.add('analytics.report', { id: r.id });
    if (user) await this.audit.record({ actor: user, action: 'report.generate', entityType: 'analytics_report', entityId: r.id, summary: `${user.name} requested a PDF report for ${dto.from} to ${dto.to}`, ip: meta.ip });
    return { id: r.id, message: text('report_generating', meta.lang) };
  }
  async reports() {
    const rows = await this.db.q(`SELECT id, title, period_from, period_to, charts, automatic, status, media_id, created_at FROM analytics_reports ORDER BY created_at DESC LIMIT 100`);
    return rows.map((r) => ({ ...r, url: r.status === 'ready' && r.mediaId ? `${this.media.link(r.mediaId, 'original')}&download=1` : null }));
  }
  /** On the first days of each month, last month's report is generated automatically. */
  async automaticMonthly() {
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)), last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    const from = first.toISOString().slice(0, 10), to = last.toISOString().slice(0, 10);
    if (await this.db.one(`SELECT 1 AS x FROM analytics_reports WHERE automatic AND period_from = $1`, [from])) return;
    await this.requestReport(null, { from, to, title: `Monthly report, ${first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}` }, { ip: '', userAgent: '', lang: 'en', visitor: '' }, true);
  }

  private async buildReport(id: string) {
    const r = await this.db.one(`SELECT * FROM analytics_reports WHERE id = $1`, [id]);
    if (!r || r.status === 'ready') return;
    try {
      const from = String(r.periodFrom).slice(0, 10), to = String(r.periodTo).slice(0, 10);
      const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400_000;
      const period: Period = days <= 45 ? 'day' : days <= 200 ? 'week' : days <= 1100 ? 'month' : 'year';
      const s = await this.summary(from, to);
      const charts = [];
      for (const c of r.charts as string[]) charts.push(await this.series(c, period, from, to));
      const figures: Record<string, number> = { storiesPosted: s.storiesInPeriod, publishedStoriesInTotal: s.publishedStories, registeredContributors: s.contributors, monthlyActiveUsers: s.monthlyActiveUsers, reportsFromUsers: s.reportsInPeriod,
        safetyConcerns: s.safetyConcerns, incidentRecords: s.incidents, countiesWithStories: s.counties, learningResourceViews: s.resourceViews, learningResourceDownloads: s.resourceDownloads,
        ...Object.fromEntries(charts.flatMap((c) => c.series.map((x) => [`total ${x.name}`, x.values.reduce((a, b) => a + b, 0)]))) };
      let narrative = await this.ai.narrative(figures, `${from} to ${to}`);
      // The figures in the text are checked against the data before the report is produced; a narrative with any other number is not used.
      const allowed = new Set([...Object.values(figures).map(String), ...from.split('-'), ...to.split('-'), ...from.split('-').map(Number).map(String), ...to.split('-').map(Number).map(String)]);
      const numbers = narrative.replace(/,(?=\d{3})/g, '').match(/\d+(?:\.\d+)?/g) ?? [];
      if (!narrative || numbers.some((n) => !allowed.has(n))) {
        narrative = `Between ${from} and ${to}, ${s.storiesInPeriod} stories were published, bringing the archive to ${s.publishedStories} published stories from ${s.counties} counties. `
          + `Users sent ${s.reportsInPeriod} reports and raised ${s.safetyConcerns} safety concerns. The archive has ${s.contributors} registered contributors, ${s.monthlyActiveUsers} of them active in the last 30 days.`;
      }
      await this.db.q(`UPDATE analytics_reports SET narrative = $2 WHERE id = $1`, [id, narrative]);
      const pdf = new Pdf('Remembering the Waters – Kenya’s Maritime and Inland-Water Safety Heritage Archive');
      pdf.text('Remembering the Waters', { size: 11, bold: true, color: '0B6FC2', gap: 0 });
      pdf.text(r.title, { size: 20, bold: true, color: '0B2E4F', gap: 2 });
      pdf.text(`Period: ${from} to ${to}   ·   Generated ${new Date().toISOString().slice(0, 10)}${r.automatic ? '   ·   Automatic monthly report' : ''}`, { size: 9, color: '6B7C8E' });
      pdf.rule();
      pdf.heading('Summary');
      pdf.text(narrative, { gap: 10 });
      pdf.stats([{ label: 'Stories posted in the period', value: String(s.storiesInPeriod) }, { label: 'Published stories (total)', value: String(s.publishedStories) }, { label: 'Registered contributors', value: String(s.contributors) }, { label: 'Monthly active users', value: String(s.monthlyActiveUsers) },
        { label: 'Testimonies archived', value: String(s.testimonies) }, { label: 'Historical records', value: String(s.historicalRecords) }, { label: 'Incident records mapped', value: `${s.incidentsMapped} of ${s.incidents}` }, { label: 'Counties with stories', value: String(s.counties) },
        { label: 'Not in English', value: `${s.nonEnglishPercent}%` }, { label: 'Audio and video stories', value: String(s.audioVideo) }, { label: 'RED reviewed within 24 h', value: `${s.redWithin24hPercent}%` }, { label: 'Resource views / downloads', value: `${s.resourceViews} / ${s.resourceDownloads}` }]);
      pdf.heading('Charts');
      for (const c of charts) pdf.chart(`${c.title} (per ${c.period})`, c.labels.map((l) => (c.period === 'year' ? l.slice(0, 4) : c.period === 'month' ? l.slice(0, 7) : l.slice(5))), c.series.map((x) => ({ name: x.name, color: x.color.slice(1), values: x.values })));
      if (s.safetyPlaces.length) { pdf.heading('Safety concerns by place'); pdf.table(['Place', 'Concerns'], s.safetyPlaces.map((p: Row) => [p.placeName, String(p.n)])); }
      if (s.flagRatesByLanguage.length) { pdf.heading('AI flags by language (fairness check)'); pdf.table(['Language', 'Stories reviewed', 'YELLOW', 'RED'], s.flagRatesByLanguage.map((l: Row) => [l.language, String(l.stories), String(l.yellow), String(l.red)])); }
      const path = join(tmpdir(), `msh-report-${id}.pdf`);
      await fs.writeFile(path, pdf.build());
      const file = await this.media.storeGenerated(path, { ownerId: r.requestedBy, purpose: 'report', name: `${r.title.replace(/[^\w -]/g, '').slice(0, 80)}.pdf`, mime: 'application/pdf' });
      await this.db.q(`UPDATE analytics_reports SET status = 'ready', media_id = $2 WHERE id = $1`, [id, file.id]);
      const lang = r.requestedBy ? (await this.db.one(`SELECT language FROM users WHERE id = $1`, [r.requestedBy]))?.language : 'en';
      if (r.requestedBy) await this.notify.send(r.requestedBy, { group: 'account', kind: 'report.ready', title: text('report_ready', lang), body: r.title, link: `/reports?open=${id}` });
      else await this.notify.superAdmins({ group: 'account', kind: 'report.ready', title: 'The monthly report is ready', body: r.title, link: `/reports?open=${id}` });
    } catch (e) { await this.db.q(`UPDATE analytics_reports SET status = 'failed' WHERE id = $1`, [id]); throw e; }
  }

  /** The AI quality measures (Section 5.7) and today's AI use, for the quarterly review. */
  async aiQuality() {
    const q = await this.db.one(
      `SELECT count(*) FILTER (WHERE ai_flag = 'RED' AND admin_action = '')::int AS red,
              count(*) FILTER (WHERE admin_action = 'override' AND approved)::int AS overridden,
              count(*) FILTER (WHERE admin_action IN ('confirm_block','remove') AND ai_flag = 'RED')::int AS confirmed FROM moderation_decisions WHERE target_type = 'story' AND created_at > now() - interval '90 days'`);
    const decided = (q?.overridden ?? 0) + (q?.confirmed ?? 0);
    return { ...q, agreementPercent: decided ? Math.round(((q?.confirmed ?? 0) / decided) * 100) : null, wronglyBlockedPercent: q?.red ? Math.round(((q?.overridden ?? 0) / q.red) * 100) : 0,
      thresholds: await this.ai.thresholds(), provider: this.ai.provider, usageToday: await this.ai.usageToday() };
  }
  /** Recalibration: the flag thresholds are reviewed on a schedule using the record of admin decisions. */
  async setThresholds(user: AuthUser, yellowAbove: number, redFrom: number, meta: RequestMeta) {
    if (!(yellowAbove >= 0 && yellowAbove < redFrom && redFrom <= 100)) return fail(400, 'invalid_input');
    await this.db.q(`INSERT INTO app_settings (key, value) VALUES ('ai.thresholds', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [JSON.stringify({ yellowAbove, redFrom })]);
    await this.audit.record({ actor: user, action: 'ai.recalibrate', entityType: 'ai', summary: `${user.name} set the AI flag thresholds to YELLOW above ${yellowAbove}% and RED from ${redFrom}%`, ip: meta.ip });
    return { yellowAbove, redFrom };
  }
}
