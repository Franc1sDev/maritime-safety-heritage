import { Injectable, OnModuleInit } from '@nestjs/common';
import { Approvals } from '../approvals/approvals.service';
import { Audit } from '../common/audit.service';
import { slugify } from '../common/crypto';
import { Db, Row } from '../common/db';
import { AuthUser, isTeam, RequestMeta } from '../common/decorators';
import { Jobs } from '../common/jobs.service';
import { ZipWriter } from '../common/zip';
import { tmpdir } from 'os';
import { join } from 'path';
import { DELETION_REASONS, EMERGENCY_NUMBERS, fail, LANGUAGE_NAMES, LANGUAGES, LAUNCH_LANGUAGES, MODERATION_NOTE, REPORT_REASONS, RULES, text } from '../common/messages';
import { Notify } from '../common/notify.service';
import { Realtime } from '../common/realtime.gateway';
import { Track } from '../common/track.service';
import { config } from '../config/config';
import { InboxService } from '../inbox/inbox.service';
import { MediaService } from '../media/media.service';
import { CATEGORIES, RIGHTS, StoriesService, VISIBLE } from '../stories/stories.service';
import { AVATARS } from '../users/profile';

export const INCIDENT_TYPES = ['Capsizing', 'Collision', 'Sinking', 'Fire', 'Grounding', 'Overloading', 'Person overboard', 'Storm or weather', 'Flooding', 'Other'];
export const RESOURCE_TYPES: Record<string, string> = { policy_brief: 'Policy brief', learning_summary: 'Learning summary', educational_material: 'Educational material', handbook: 'Handbook', exhibition: 'Online exhibition' };
export const AUDIENCES = ['General public', 'Schools', 'Community groups', 'Training institutions', 'Researchers', 'Policymakers'];

/** Places, incident records, the map and timeline, collections, learning resources, safety concerns, announcements and search. */
@Injectable()
export class ArchiveService implements OnModuleInit {
  constructor(private readonly db: Db, private readonly audit: Audit, private readonly notify: Notify, private readonly live: Realtime, private readonly track: Track,
    private readonly media: MediaService, private readonly approvals: Approvals, private readonly inbox: InboxService, private readonly stories: StoriesService, private readonly jobs: Jobs) {}

  onModuleInit() {
    this.jobs.handle('archive.export', async ({ exportId, includeMedia }) => { await this.buildArchiveExport(exportId, !!includeMedia); });
    this.approvals.on('collection', {
      approved: async (req) => { await this.db.q(`UPDATE collections SET status = 'published', published_at = now() WHERE id = $1`, [req.targetId]); },
      rejected: async (req) => { await this.db.q(`UPDATE collections SET status = 'rejected' WHERE id = $1`, [req.targetId]); },
    });
  }

  /** Lists and standard texts the website and apps need before anyone signs in. */
  publicConfig(lang: string) {
    const l = lang === 'sw' ? 'sw' : 'en';
    return {
      name: 'Remembering the Waters', siteUrl: config.siteUrl, languages: LANGUAGES.map((code) => ({ code, name: LANGUAGE_NAMES[code], launch: LAUNCH_LANGUAGES.includes(code), rtl: code === 'ar' })),
      categories: CATEGORIES, rights: RIGHTS, incidentTypes: INCIDENT_TYPES, resourceTypes: RESOURCE_TYPES, audiences: AUDIENCES, avatars: AVATARS,
      reportReasons: REPORT_REASONS.map((r) => ({ key: r.key, label: r[l] })), deletionReasons: DELETION_REASONS.map((r) => ({ key: r.key, label: r[l] })),
      rules: RULES.map((r) => r[l]), moderationNote: MODERATION_NOTE[l], emergencyNumbers: EMERGENCY_NUMBERS, safetyNotice: text('safety_notice', lang), sensitiveNotice: text('sensitive_notice', lang),
      limits: { ...config.limits, text: 200_000 }, minAge: config.minAge, minAppVersion: config.minAppVersion, storyTypes: { community: 'Community story', testimony: 'Testimony collected by the project', record: 'Historical record' },
      aiReview: { greenUpTo: 20, redFrom: 70, maxMinutes: 3 }, turnstileSiteKey: process.env.TURNSTILE_SITE_KEY ?? null, vapidPublicKey: config.push.vapidPublic || null,
      mapsKey: process.env.GOOGLE_MAPS_BROWSER_KEY ?? null,
      // Where stories involve loss, the platform shows where to find support.
      supportInfo: process.env.SUPPORT_INFO ?? (l === 'sw' ? 'Ikiwa hadithi hii imekugusa, zungumza na mtu unayemwamini. Kenya Red Cross hutoa ushauri nasaha bila malipo kupitia 1199.' : 'If this story has affected you, talk to someone you trust. The Kenya Red Cross offers free counselling on 1199.'),
    };
  }

  // ---------- places ----------
  /** Location auto-complete from the places list, matching as the user types (names and alternative names, tolerant of small typos). */
  async places(q: string | undefined, withStories = false) {
    const term = (q ?? '').trim().toLowerCase().replace(/[%_]/g, '');
    return this.db.q(
      `SELECT p.id, p.name, p.alt_names, p.type, p.county, p.water_body, p.latitude::float8 AS latitude, p.longitude::float8 AS longitude,
              (SELECT count(*)::int FROM stories s WHERE s.place_id = p.id AND s.status = 'published') AS stories
         FROM places p WHERE ($1 = '' OR p.search ILIKE '%' || $1 || '%' OR similarity(p.search, $1) > 0.25)
           AND ($2 = false OR EXISTS (SELECT 1 FROM stories s WHERE s.place_id = p.id AND s.status = 'published'))
        ORDER BY (lower(p.name) LIKE $1 || '%') DESC, similarity(p.search, $1) DESC, p.name LIMIT 30`, [term, withStories]);
  }
  async savePlace(dto: Row, id?: number) {
    const search = [dto.name, ...(dto.altNames ?? []), dto.county, dto.waterBody].filter(Boolean).join(' ').toLowerCase();
    const vals = [dto.name.trim(), dto.altNames ?? [], dto.type ?? 'town', dto.county ?? '', dto.waterBody ?? '', dto.latitude ?? null, dto.longitude ?? null, search];
    return id ? this.db.one(`UPDATE places SET name=$2, alt_names=$3, type=$4, county=$5, water_body=$6, latitude=$7, longitude=$8, search=$9 WHERE id=$1 RETURNING *`, [id, ...vals])
      : this.db.one(`INSERT INTO places (name, alt_names, type, county, water_body, latitude, longitude, search) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, vals);
  }

  // ---------- map and timeline ----------
  /** Map Explore: stories and incidents inside the visible area, grouped into clusters when zoomed out. */
  async map(q: Record<string, string | undefined>, viewer?: AuthUser | null) {
    const b = (q.bbox ?? '').split(',').map(Number);
    const box = b.length === 4 && b.every(Number.isFinite) ? b : [33.5, -5.2, 42.2, 5.5];
    const zoom = Math.max(1, Math.min(20, parseInt(q.zoom ?? '6', 10) || 6));
    const cell = zoom >= 11 ? 0 : 360 / 2 ** (zoom + 2);
    const params: unknown[] = [viewer?.id ?? null, box[0], box[1], box[2], box[3]];
    const where = [VISIBLE('$1::uuid'), `s.latitude IS NOT NULL AND s.longitude BETWEEN $2 AND $4 AND s.latitude BETWEEN $3 AND $5`];
    if (q.category) { params.push(q.category); where.push(`s.category = $${params.length}`); }
    if (q.language) { params.push(q.language); where.push(`s.language = $${params.length}`); }
    if (q.from) { params.push(q.from); where.push(`s.event_date >= $${params.length}::date`); }
    if (q.to) { params.push(q.to); where.push(`s.event_date <= $${params.length}::date`); }
    const from = `stories s LEFT JOIN users au ON au.id = s.author_id`;
    const stories = cell
      ? await this.db.q(`SELECT round(avg(s.latitude)::numeric, 5)::float8 AS latitude, round(avg(s.longitude)::numeric, 5)::float8 AS longitude, count(*)::int AS count, min(s.id::text) AS id, min(s.code) AS code
                           FROM ${from} WHERE ${where.join(' AND ')} GROUP BY floor(s.latitude / ${cell}), floor(s.longitude / ${cell}) LIMIT 800`, params)
      : await this.db.q(`SELECT s.id, s.code, s.title, left(s.body, 120) AS excerpt, s.category, s.place_name, s.latitude::float8 AS latitude, s.longitude::float8 AS longitude, 1 AS count FROM ${from} WHERE ${where.join(' AND ')} LIMIT 800`, params);
    const incidents = q.incidents === 'false' ? [] : await this.db.q(
      `SELECT i.id, i.code, i.title, i.event_date, i.incident_type, i.water_body, i.latitude::float8 AS latitude, i.longitude::float8 AS longitude,
              (SELECT count(*)::int FROM stories s WHERE s.incident_id = i.id AND s.status = 'published') AS stories
         FROM incidents i WHERE i.status = 'published' AND i.latitude IS NOT NULL AND i.longitude BETWEEN $1 AND $3 AND i.latitude BETWEEN $2 AND $4`, box);
    return { stories, incidents, clustered: !!cell };
  }
  /** Stories and incidents by decade and year of the event. */
  async timeline(viewer?: AuthUser | null) {
    const years = await this.db.q(`SELECT extract(year FROM s.event_date)::int AS year, count(*)::int AS stories FROM stories s LEFT JOIN users au ON au.id = s.author_id WHERE ${VISIBLE('$1::uuid')} AND s.event_date IS NOT NULL GROUP BY 1 ORDER BY 1`, [viewer?.id ?? null]);
    const incidents = await this.db.q(`SELECT id, code, title, event_date, extract(year FROM event_date)::int AS year, incident_type, water_body FROM incidents WHERE status = 'published' AND event_date IS NOT NULL ORDER BY event_date`);
    const decades = new Map<number, { decade: number; stories: number; years: Array<{ year: number; stories: number }>; incidents: Row[] }>();
    const d = (y: number) => { const k = Math.floor(y / 10) * 10; if (!decades.has(k)) decades.set(k, { decade: k, stories: 0, years: [], incidents: [] }); return decades.get(k)!; };
    for (const y of years) { const e = d(y.year); e.stories += y.stories; e.years.push({ year: y.year, stories: y.stories }); }
    for (const i of incidents) d(i.year).incidents.push(i);
    return [...decades.values()].sort((a, b) => a.decade - b.decade);
  }

  // ---------- incidents ----------
  private incidentSelect = `i.id, i.code, i.title, i.event_date, i.date_approximate, i.place_id, i.place_name, i.latitude::float8 AS latitude, i.longitude::float8 AS longitude, i.water_body, i.vessel, i.incident_type, i.summary, i.outcome, i.sources, i.status, i.created_at, i.updated_at,
    (SELECT count(*)::int FROM stories s WHERE s.incident_id = i.id AND s.status = 'published') AS stories`;
  async incidents(q: Record<string, string | undefined>, viewer?: AuthUser | null) {
    const params: unknown[] = []; const where: string[] = [];
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    const admin = viewer?.role === 'admin';
    where.push(admin && q.status ? `i.status = ${p(q.status)}` : `i.status = 'published'`);
    if (q.q?.trim()) where.push(`(i.title ILIKE ${p(`%${q.q.trim().replace(/[%_]/g, '')}%`)} OR i.vessel ILIKE ${p(`%${q.q.trim().replace(/[%_]/g, '')}%`)} OR i.place_name ILIKE ${p(`%${q.q.trim().replace(/[%_]/g, '')}%`)} OR similarity(i.title, ${p(q.q.trim())}) > 0.3)`);
    if (q.year) where.push(`extract(year FROM i.event_date) = ${p(Number(q.year))}`);
    if (q.waterBody) where.push(`i.water_body = ${p(q.waterBody)}`);
    if (q.type) where.push(`i.incident_type = ${p(q.type)}`);
    return this.db.q(`SELECT ${this.incidentSelect} FROM incidents i WHERE ${where.join(' AND ')} ORDER BY i.event_date DESC NULLS LAST, i.title LIMIT 200`, params);
  }
  /** The incident page: what happened, the outcome, its sources, a map position, and everything linked to it. */
  async incident(idOrCode: string, viewer?: AuthUser | null) {
    const byId = /^[0-9a-f]{8}-/i.test(idOrCode);
    const i = await this.db.one(`SELECT ${this.incidentSelect} FROM incidents i WHERE ${byId ? 'i.id = $1::uuid' : 'upper(i.code) = upper($1)'}`, [idOrCode]);
    if (!i || (i.status !== 'published' && viewer?.role !== 'admin')) return fail(404, 'not_found');
    const linked = await this.stories.feed({ incidentId: i.id, limit: '50' }, viewer);
    return { ...i, permalink: `${config.siteUrl}/incidents/${i.code}`, linked: linked.items };
  }
  /** Incident records form a structured dataset that can be exported for research and policy work. */
  async incidentsCsv(): Promise<string> {
    const rows = await this.db.q(`SELECT i.code, i.title, i.event_date, i.date_approximate, i.place_name, i.water_body, i.latitude, i.longitude, i.vessel, i.incident_type, i.summary, i.outcome, i.sources,
      (SELECT count(*)::int FROM stories s WHERE s.incident_id = i.id AND s.status = 'published') AS linked_items FROM incidents i WHERE i.status = 'published' ORDER BY i.event_date NULLS LAST`);
    const cols = ['code', 'title', 'eventDate', 'dateApproximate', 'placeName', 'waterBody', 'latitude', 'longitude', 'vessel', 'incidentType', 'summary', 'outcome', 'sources', 'linkedItems'];
    const cell = (v: unknown) => { const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return '\uFEFF' + [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n';
  }

  async saveIncident(admin: AuthUser, dto: Row, id: string | undefined, meta: RequestMeta) {
    let place: Row | null = null;
    if (dto.placeId) place = await this.db.one(`SELECT * FROM places WHERE id = $1`, [dto.placeId]);
    const v = [dto.title.trim(), dto.eventDate || null, !!dto.dateApproximate, dto.placeId ?? null, place?.name ?? dto.placeName ?? '', dto.latitude ?? place?.latitude ?? null, dto.longitude ?? place?.longitude ?? null,
      dto.waterBody ?? place?.waterBody ?? '', dto.vessel ?? '', dto.incidentType ?? '', dto.summary ?? '', dto.outcome ?? '', dto.sources ?? '', dto.status ?? 'published'];
    const row = id
      ? await this.db.one(`UPDATE incidents SET title=$2, event_date=$3, date_approximate=$4, place_id=$5, place_name=$6, latitude=$7, longitude=$8, water_body=$9, vessel=$10, incident_type=$11, summary=$12, outcome=$13, sources=$14, status=$15, updated_at=now() WHERE id=$1 RETURNING id, code, suggested_by, status`, [id, ...v])
      : await this.db.one(`INSERT INTO incidents (title, event_date, date_approximate, place_id, place_name, latitude, longitude, water_body, vessel, incident_type, summary, outcome, sources, status, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id, code, suggested_by, status`, [...v, admin.id]);
    if (!row) return fail(404, 'not_found');
    if (Array.isArray(dto.storyIds)) {
      await this.db.q(`UPDATE stories SET incident_id = NULL WHERE incident_id = $1 AND NOT (id = ANY($2::uuid[]))`, [row.id, dto.storyIds]);
      await this.db.q(`UPDATE stories SET incident_id = $1 WHERE id = ANY($2::uuid[])`, [row.id, dto.storyIds]);
    }
    if (!id) await this.track.bump(['incidents']);
    if (row.suggestedBy && row.status === 'published' && id) await this.notify.send(row.suggestedBy, { group: 'engagement', kind: 'incident.added', title: 'The incident you suggested has been added', body: dto.title.trim(), link: `/incidents/${row.code}` });
    await this.audit.record({ actor: admin, action: id ? 'incident.update' : 'incident.create', entityType: 'incident', entityId: row.id, summary: `${admin.name} saved incident record ${row.code}: ${dto.title.trim()}`, ip: meta.ip });
    return { ...(await this.incident(row.id, admin)), message: text('incident_saved', meta.lang) };
  }
  async declineIncident(admin: AuthUser, id: string, meta: RequestMeta) {
    await this.db.q(`UPDATE incidents SET status = 'declined' WHERE id = $1 AND status = 'suggested'`, [id]);
    await this.audit.record({ actor: admin, action: 'incident.decline', entityType: 'incident', entityId: id, summary: `${admin.name} declined a suggested incident`, ip: meta.ip });
    return { ok: true };
  }
  /** AI-style incident matching: when a story names a place, date or vessel that matches an incident record, the link is suggested for a person to confirm. */
  async matchIncident(textIn: string, eventDate?: string, vessel?: string) {
    const t = `${textIn} ${vessel ?? ''}`.toLowerCase();
    const rows = await this.db.q(`SELECT id, code, title, event_date, vessel, place_name, water_body FROM incidents WHERE status = 'published'`);
    const year = eventDate ? Number(eventDate.slice(0, 4)) : null;
    return rows.map((i) => {
      let score = 0;
      if (i.vessel && t.includes(i.vessel.toLowerCase())) score += 3;
      if (i.placeName && t.includes(i.placeName.toLowerCase())) score += 1;
      const y = i.eventDate ? Number(String(i.eventDate).slice(0, 4)) : null;
      if (y && (year === y || t.includes(String(y)))) score += 2;
      for (const w of i.title.toLowerCase().split(/[^a-z0-9]+/).filter((x: string) => x.length > 4)) if (t.includes(w)) score += 1;
      return { ...i, score };
    }).filter((i) => i.score >= 3).sort((a, b) => b.score - a.score).slice(0, 3);
  }

  // ---------- collections and online exhibitions ----------
  async collections(viewer?: AuthUser | null, kind?: string) {
    const admin = viewer?.role === 'admin';
    return this.db.q(`SELECT c.id, c.kind, c.title, c.description, c.status, c.published_at, c.cover_media_id, (SELECT count(*)::int FROM collection_items ci WHERE ci.collection_id = c.id) AS stories
      FROM collections c WHERE ($1 OR c.status = 'published') AND ($2::text IS NULL OR c.kind = $2) ORDER BY c.published_at DESC NULLS FIRST, c.created_at DESC`, [admin, kind ?? null]);
  }
  async collection(id: string, viewer?: AuthUser | null) {
    const c = await this.db.one(`SELECT * FROM collections WHERE id = $1`, [id]);
    if (!c || (c.status !== 'published' && viewer?.role !== 'admin')) return fail(404, 'not_found');
    const items = await this.db.q(`SELECT ci.story_id, ci.note, ci.position FROM collection_items ci WHERE ci.collection_id = $1 ORDER BY ci.position`, [id]);
    const stories = [];
    for (const it of items) { try { stories.push({ note: it.note, story: await this.stories.get(it.storyId, viewer) }); } catch { /* a story that is no longer visible is skipped */ } }
    const cover = c.coverMediaId ? await this.media.byId(c.coverMediaId) : null;
    return { id: c.id, kind: c.kind, title: c.title, description: c.description, status: c.status, publishedAt: c.publishedAt, cover: cover ? this.media.view(cover) : null, items: stories };
  }
  /** Collections represent the project team: they are published once the other admins approve. */
  async saveCollection(admin: AuthUser, dto: Row, id: string | undefined, meta: RequestMeta) {
    const row = id
      ? await this.db.one(`UPDATE collections SET title=$2, description=$3, kind=$4, cover_media_id=$5, updated_at=now() WHERE id=$1 RETURNING id, status`, [id, dto.title.trim(), dto.description ?? '', dto.kind ?? 'collection', dto.coverMediaId ?? null])
      : await this.db.one(`INSERT INTO collections (title, description, kind, cover_media_id, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id, status`, [dto.title.trim(), dto.description ?? '', dto.kind ?? 'collection', dto.coverMediaId ?? null, admin.id]);
    if (!row) return fail(404, 'not_found');
    if (Array.isArray(dto.items)) {
      await this.db.q(`DELETE FROM collection_items WHERE collection_id = $1`, [row.id]);
      let pos = 0;
      for (const it of dto.items) await this.db.q(`INSERT INTO collection_items (collection_id, story_id, position, note) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [row.id, it.storyId, pos++, (it.note ?? '').slice(0, 1000)]);
    }
    let message = text('settings_saved', meta.lang);
    if (dto.submit && row.status !== 'awaiting_approval') {
      await this.db.q(`UPDATE collections SET status = 'awaiting_approval' WHERE id = $1`, [row.id]);
      await this.approvals.propose({ type: 'collection', targetId: row.id, title: `${dto.kind === 'exhibition' ? 'Exhibition' : 'Collection'}: ${dto.title.trim()}`, proposer: admin, justification: dto.justification || 'Facts checked, sources credited and consent confirmed.' }, meta);
      message = text('submitted_for_approval', meta.lang);
    }
    await this.audit.record({ actor: admin, action: id ? 'collection.update' : 'collection.create', entityType: 'collection', entityId: row.id, summary: `${admin.name} saved the collection “${dto.title.trim()}”`, ip: meta.ip });
    return { ...(await this.collection(row.id, admin)), message };
  }

  // ---------- learning resources ----------
  async resources(q: Record<string, string | undefined>, viewer?: AuthUser | null) {
    const params: unknown[] = [isTeam(viewer?.role)]; const where = [`($1 OR r.status = 'published')`];
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.type) where.push(`r.type = ${p(q.type)}`);
    if (q.audience) where.push(`r.audience = ${p(q.audience)}`);
    if (q.language) where.push(`r.language = ${p(q.language)}`);
    if (q.q?.trim()) where.push(`(r.title ILIKE ${p(`%${q.q.trim().replace(/[%_]/g, '')}%`)} OR r.summary ILIKE ${p(`%${q.q.trim().replace(/[%_]/g, '')}%`)})`);
    const rows = await this.db.q(`SELECT r.id, r.slug, r.title, r.type, r.summary, r.audience, r.language, r.status, r.published_at, r.views, r.downloads, r.media_id, r.collection_id FROM resources r WHERE ${where.join(' AND ')} ORDER BY r.published_at DESC NULLS LAST LIMIT 200`, params);
    return rows.map((r) => this.resourceShape(r));
  }
  private resourceShape(r: Row) {
    const year = r.publishedAt ? new Date(r.publishedAt).getFullYear() : new Date().getFullYear();
    return { ...r, typeLabel: RESOURCE_TYPES[r.type], hasFile: !!r.mediaId, permalink: `${config.siteUrl}/resources/${r.slug}`,
      citation: `Remembering the Waters. (${year}). ${r.title} [${RESOURCE_TYPES[r.type]}]. ${config.siteUrl}/resources/${r.slug}` };
  }
  async resource(slugOrId: string, viewer: AuthUser | undefined | null, visitor: string) {
    const byId = /^[0-9a-f]{8}-/i.test(slugOrId);
    const r = await this.db.one(`SELECT * FROM resources r WHERE ${byId ? 'r.id = $1::uuid' : 'r.slug = $1'}`, [slugOrId]);
    if (!r || (r.status !== 'published' && !isTeam(viewer?.role))) return fail(404, 'not_found');
    await this.db.q(`UPDATE resources SET views = views + 1 WHERE id = $1`, [r.id]);
    await this.track.event('resource.view', this.track.actor(viewer, visitor), { meta: { resource: r.slug } });
    const file = r.mediaId ? await this.media.byId(r.mediaId) : null;
    return { ...this.resourceShape(r), body: r.body, file: file ? this.media.view(file, { original: true }) : null, exhibition: r.collectionId ? await this.collection(r.collectionId, viewer).catch(() => null) : null };
  }
  async resourceDownloaded(id: string, viewer: AuthUser | undefined | null, visitor: string) {
    const r = await this.db.one(`UPDATE resources SET downloads = downloads + 1 WHERE id = $1 AND status = 'published' RETURNING slug, media_id`, [id]);
    if (!r?.mediaId) return fail(404, 'not_found');
    await this.track.event('resource.download', this.track.actor(viewer, visitor), { meta: { resource: r.slug } });
    return { url: `${this.media.link(r.mediaId, 'original')}&download=1` };
  }
  async saveResource(admin: AuthUser, dto: Row, id: string | undefined, meta: RequestMeta) {
    if (!RESOURCE_TYPES[dto.type]) return fail(400, 'invalid_input');
    const status = dto.status === 'draft' ? 'draft' : 'published';
    let row: Row | null;
    if (id) row = await this.db.one(`UPDATE resources SET title=$2, type=$3, summary=$4, body=$5, media_id=$6, collection_id=$7, audience=$8, language=$9, status=$10, published_at=coalesce(published_at, CASE WHEN $10='published' THEN now() END), updated_at=now() WHERE id=$1 RETURNING id, slug`,
      [id, dto.title.trim(), dto.type, dto.summary ?? '', dto.body ?? '', dto.mediaId ?? null, dto.collectionId ?? null, dto.audience ?? '', dto.language ?? 'en', status]);
    else {
      let slug = slugify(dto.title) || 'resource';
      while (await this.db.one(`SELECT 1 AS x FROM resources WHERE slug = $1`, [slug])) slug = `${slugify(dto.title).slice(0, 70)}-${Math.random().toString(36).slice(2, 6)}`;
      row = await this.db.one(`INSERT INTO resources (slug, title, type, summary, body, media_id, collection_id, audience, language, status, published_at, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, CASE WHEN $10='published' THEN now() END, $11) RETURNING id, slug`,
        [slug, dto.title.trim(), dto.type, dto.summary ?? '', dto.body ?? '', dto.mediaId ?? null, dto.collectionId ?? null, dto.audience ?? '', dto.language ?? 'en', status, admin.id]);
      await this.track.bump(['resources']);
    }
    if (!row) return fail(404, 'not_found');
    await this.audit.record({ actor: admin, action: id ? 'resource.update' : 'resource.create', entityType: 'resource', entityId: row.id, summary: `${admin.name} saved the resource “${dto.title.trim()}”`, ip: meta.ip });
    return { ...(await this.resource(row.id, admin, '')), message: text(status === 'published' ? 'resource_published' : 'draft_saved', meta.lang) };
  }
  async removeResource(admin: AuthUser, id: string, meta: RequestMeta) {
    const r = await this.db.q(`DELETE FROM resources WHERE id = $1 RETURNING title`, [id]);
    if (!r.length) return fail(404, 'not_found');
    await this.audit.record({ actor: admin, action: 'resource.delete', entityType: 'resource', entityId: id, summary: `${admin.name} removed the resource “${r[0].title}”`, ip: meta.ip });
    return { ok: true };
  }

  // ---------- safety concerns (not content reports, and not an emergency service) ----------
  private async humanCheck(token: string | undefined, honeypot: string | undefined, ip: string) {
    if (honeypot) return fail(400, 'human_check_failed');
    if (!config.turnstileSecret) return;
    try {
      const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: new URLSearchParams({ secret: config.turnstileSecret, response: token ?? '', remoteip: ip }), signal: AbortSignal.timeout(8000) });
      if (!((await r.json()) as { success?: boolean }).success) return fail(400, 'human_check_failed');
    } catch (e) { if ((e as { code?: string }).code === 'human_check_failed') throw e; }
  }
  async raiseConcern(viewer: AuthUser | undefined, dto: Row, meta: RequestMeta) {
    if (!dto.description?.trim()) return fail(400, 'safety_empty');
    await this.humanCheck(dto.humanToken, dto.website, meta.ip);
    if (dto.photoMediaId && !(await this.db.one(`SELECT 1 AS x FROM media_files WHERE id = $1 AND purpose = 'concern' AND kind = 'image'`, [dto.photoMediaId]))) return fail(400, 'invalid_input');
    const c = (await this.db.one(`INSERT INTO safety_concerns (reporter_id, contact, place_name, latitude, longitude, description, photo_media_id, share_identity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, code`,
      [viewer?.id ?? null, (dto.contact ?? '').slice(0, 160), (dto.placeName ?? '').slice(0, 160), dto.latitude ?? null, dto.longitude ?? null, dto.description.trim().slice(0, 4000), dto.photoMediaId ?? null, !!dto.shareIdentity]))!;
    await this.track.event('safety_concern', this.track.actor(viewer, meta.visitor), { metrics: ['safety_concerns'], meta: { place: dto.placeName ?? '' } });
    await this.notify.admins({ group: 'moderation', kind: 'safety.new', title: 'New safety concern', body: `${c.code}: ${(dto.placeName ?? '').slice(0, 80)}`, link: `/admin/safety?open=${c.id}`, priority: true, actionKey: `safety:${c.id}` });
    this.live.toAdmins('safety', { id: c.id });
    if (viewer) await this.inbox.system(viewer.id, `Safety concern ${c.code}`, 'safety', `safety:${c.id}`, `${text('safety_sent', viewer.language)} ${text('safety_notice', viewer.language)}`);
    return { code: c.code, message: text('safety_sent', meta.lang), notice: text('safety_notice', meta.lang), emergencyNumbers: EMERGENCY_NUMBERS };
  }
  async concerns(status?: string) {
    const rows = await this.db.q(`SELECT c.*, u.username AS reporter_username FROM safety_concerns c LEFT JOIN users u ON u.id = c.reporter_id WHERE ($1::text IS NULL OR c.status = $1) ORDER BY (c.status = 'new') DESC, c.created_at DESC LIMIT 300`, [status ?? null]);
    const out = [];
    for (const c of rows) { const photo = c.photoMediaId ? await this.media.byId(c.photoMediaId) : null; out.push({ ...c, overdue: c.status === 'new' && Date.now() - new Date(c.createdAt).getTime() > 24 * 3600_000, photo: photo ? this.media.view(photo) : null }); }
    return out;
  }
  /** Acknowledge, add notes, record a referral to the responsible authority, or close. The sender is told when it is acknowledged. */
  async updateConcern(admin: AuthUser, id: string, dto: { status?: string; note?: string; referral?: string }, meta: RequestMeta) {
    const c = await this.db.one(`SELECT * FROM safety_concerns WHERE id = $1`, [id]);
    if (!c) return fail(404, 'not_found');
    const notes = dto.note?.trim() ? [...c.notes, { by: admin.name, at: new Date().toISOString(), note: dto.note.trim() }] : c.notes;
    const status = dto.referral?.trim() && (!dto.status || dto.status === 'acknowledged') ? 'referred' : dto.status ?? c.status;
    await this.db.q(`UPDATE safety_concerns SET status = $2, notes = $3, referral = coalesce(nullif($4, ''), referral), acknowledged_at = coalesce(acknowledged_at, CASE WHEN $2 <> 'new' THEN now() END) WHERE id = $1`, [id, status, JSON.stringify(notes), dto.referral?.trim() ?? '']);
    let message = text('settings_saved', meta.lang);
    if (c.status === 'new' && status !== 'new') {
      await this.notify.done(`safety:${id}`);
      if (c.reporterId) {
        const u = await this.db.one(`SELECT language FROM users WHERE id = $1`, [c.reporterId]);
        await this.inbox.system(c.reporterId, `Safety concern ${c.code}`, 'safety', `safety:${id}`, u?.language === 'sw' ? 'Timu ya mradi imepokea hoja yako ya usalama. Asante kwa kutujulisha.' : 'The project team has acknowledged your safety concern. Thank you for telling us.');
        await this.notify.send(c.reporterId, { group: 'moderation', kind: 'safety.acknowledged', title: 'Your safety concern was acknowledged', link: '/inbox' });
      }
      message = text('safety_acknowledged', meta.lang);
    }
    await this.audit.record({ actor: admin, action: 'safety.update', entityType: 'safety_concern', entityId: id, summary: `${admin.name} updated safety concern ${c.code} (${status})${dto.referral ? `; referral: ${dto.referral}` : ''}`, ip: meta.ip });
    return { message };
  }

  async feedback(viewer: AuthUser | undefined, body: string, extra: { website?: string; humanToken?: string }, meta: RequestMeta) {
    if (!body?.trim()) return fail(400, 'invalid_input');
    await this.humanCheck(extra.humanToken, extra.website, meta.ip);
    await this.db.q(`INSERT INTO feedback (user_id, body) VALUES ($1,$2)`, [viewer?.id ?? null, body.trim().slice(0, 4000)]);
    await this.track.bump(['feedback']);
    return { message: text('feedback_sent', meta.lang) };
  }
  listFeedback() { return this.db.q(`SELECT f.id, f.body, f.created_at, u.username FROM feedback f LEFT JOIN users u ON u.id = f.user_id ORDER BY f.created_at DESC LIMIT 300`); }

  // ---------- announcements ----------
  /** Most recent first, by when each was created or last edited: an edited announcement moves back up and is labelled "Edited". */
  async announcements(viewer?: AuthUser | null) {
    const rows = await this.db.q(
      `SELECT a.id, a.title, a.summary, a.description, a.dates, a.created_at, a.edited_at, a.sort_at,
              ($1::uuid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM announcement_reads r WHERE r.announcement_id = a.id AND r.user_id = $1 AND r.read_at >= a.sort_at)) AS unread
         FROM announcements a WHERE a.deleted_at IS NULL ORDER BY a.sort_at DESC LIMIT 100`, [viewer?.id ?? null]);
    return rows.map((a) => ({ ...a, edited: !!a.editedAt }));
  }
  async readAnnouncement(viewer: AuthUser, id: string) {
    await this.db.q(`INSERT INTO announcement_reads (announcement_id, user_id) VALUES ($1,$2) ON CONFLICT (announcement_id, user_id) DO UPDATE SET read_at = now()`, [id, viewer.id]);
    return this.notify.counts(viewer.id);
  }
  async saveAnnouncement(admin: AuthUser, dto: Row, id: string | undefined, meta: RequestMeta) {
    // Dates are stored as structured dates for the animated calendar.
    const dates = (Array.isArray(dto.dates) ? dto.dates : []).filter((d: any) => /^\d{4}-\d{2}-\d{2}$/.test(d?.date ?? '')).slice(0, 20).map((d: any) => ({ date: d.date, endDate: /^\d{4}-\d{2}-\d{2}$/.test(d.endDate ?? '') ? d.endDate : null, label: String(d.label ?? '').slice(0, 120) }));
    const row = id
      ? await this.db.one(`UPDATE announcements SET title=$2, summary=$3, description=$4, dates=$5, edited_at=now(), sort_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id`, [id, dto.title.trim(), dto.summary ?? '', dto.description ?? '', JSON.stringify(dates)])
      : await this.db.one(`INSERT INTO announcements (title, summary, description, dates, send_push, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [dto.title.trim(), dto.summary ?? '', dto.description ?? '', JSON.stringify(dates), !!dto.sendPush, admin.id]);
    if (!row) return fail(404, 'not_found');
    await this.audit.record({ actor: admin, action: id ? 'announcement.update' : 'announcement.create', entityType: 'announcement', entityId: row.id, summary: `${admin.name} ${id ? 'edited' : 'published'} the announcement “${dto.title.trim()}”`, ip: meta.ip });
    this.live.toAll('announcement', { id: row.id, edited: !!id });
    if (dto.sendPush) {
      const users = await this.db.q(`SELECT id FROM users WHERE status IN ('active','warned') AND profile_complete LIMIT 20000`);
      void this.notify.sendMany(users.map((u) => u.id).filter((u) => u !== admin.id), { group: 'announcements', kind: 'announcement', title: dto.title.trim(), body: dto.summary ?? '', link: `/announcements?open=${row.id}` });
    }
    return { id: row.id, message: text('announcement_published', meta.lang) };
  }
  async removeAnnouncement(admin: AuthUser, id: string, meta: RequestMeta) {
    await this.db.q(`UPDATE announcements SET deleted_at = now() WHERE id = $1`, [id]);
    await this.audit.record({ actor: admin, action: 'announcement.delete', entityType: 'announcement', entityId: id, summary: `${admin.name} deleted an announcement`, ip: meta.ip });
    return { ok: true };
  }

  // ---------- full archive export ----------
  /** The whole archive in a standard, open form (JSON and CSV with Dublin Core descriptions, plus the original files), for transfer to a future system or partner institution. */
  async requestArchiveExport(user: AuthUser, includeMedia: boolean, meta: RequestMeta) {
    const e = (await this.db.one(`INSERT INTO data_exports (user_id, kind) VALUES ($1, 'archive') RETURNING id`, [user.id]))!;
    await this.jobs.add('archive.export', { exportId: e.id, includeMedia });
    await this.audit.record({ actor: user, action: 'archive.export', entityType: 'archive', entityId: e.id, summary: `${user.name} requested a full archive export${includeMedia ? ' with media' : ''}`, ip: meta.ip });
    return { id: e.id, message: text('export_preparing', meta.lang) };
  }
  async archiveExports() {
    const rows = await this.db.q(`SELECT id, status, media_id, created_at FROM data_exports WHERE kind = 'archive' ORDER BY created_at DESC LIMIT 10`);
    return rows.map((e) => ({ id: e.id, status: e.status, createdAt: e.createdAt, url: e.status === 'ready' && e.mediaId ? `${this.media.link(e.mediaId, 'original')}&download=1` : null }));
  }
  private async buildArchiveExport(exportId: string, includeMedia: boolean) {
    const e = await this.db.one(`SELECT * FROM data_exports WHERE id = $1 AND status = 'preparing'`, [exportId]);
    if (!e) return;
    try {
      const path = join(tmpdir(), `msh-archive-${exportId}.zip`);
      const zip = new ZipWriter(path);
      const json = (v: unknown) => Buffer.from(JSON.stringify(v, null, 1), 'utf8');
      const ids = await this.db.q(`SELECT id FROM stories WHERE status = 'published' ORDER BY published_at`);
      const items = [];
      for (const { id } of ids) {
        const s = await this.stories.get(id, null).catch(() => null);
        if (!s) continue;
        const cite = await this.stories.cite(id, null);
        const consent = await this.db.one(`SELECT storyteller, consent_type, consent_date, restrictions, validated_at FROM consent_records WHERE story_id = $1`, [id]);
        items.push({ ...cite.dublinCore, story: { ...s, media: s.media.map((m: any) => ({ name: m.name, kind: m.kind, mimeType: m.mimeType, sizeBytes: m.sizeBytes, transcript: m.transcript, altText: m.altText })) }, consent });
      }
      await zip.add('archive/README.txt', Buffer.from(`Remembering the Waters: full archive export, ${new Date().toISOString()}\n\nstories.json   every published item with Dublin Core metadata (dc: and dcterms: fields), its full record and its consent record\nincidents.csv  the incident records dataset\nresources.json learning resources\ncollections.json curated collections and exhibitions\nplaces.json    the places list\nmedia/<story ID>/  the original files as uploaded${includeMedia ? '' : ' (not included in this export)'}\n`, 'utf8'));
      await zip.add('archive/stories.json', json(items));
      await zip.add('archive/incidents.csv', Buffer.from(await this.incidentsCsv(), 'utf8'));
      await zip.add('archive/resources.json', json(await this.db.q(`SELECT slug, title, type, summary, body, audience, language, published_at FROM resources WHERE status = 'published'`)));
      await zip.add('archive/collections.json', json(await this.db.q(`SELECT c.id, c.kind, c.title, c.description, c.published_at, (SELECT coalesce(json_agg(s.code ORDER BY ci.position), '[]') FROM collection_items ci JOIN stories s ON s.id = ci.story_id WHERE ci.collection_id = c.id) AS stories FROM collections c WHERE c.status = 'published'`)));
      await zip.add('archive/places.json', json(await this.db.q(`SELECT name, alt_names, type, county, water_body, latitude, longitude FROM places ORDER BY name`)));
      if (includeMedia) {
        for (const m of await this.db.q(`SELECT m.*, s.code FROM media_files m JOIN stories s ON s.id = m.story_id WHERE s.status = 'published' ORDER BY s.code, m.position`)) {
          await zip.add(`archive/media/${m.code}/${m.originalName}`, (await this.media.openKey(m.storageKey, m.encrypted)).stream);
        }
      }
      await zip.close();
      const file = await this.media.storeGenerated(path, { ownerId: e.userId, purpose: 'export', name: `archive-export-${new Date().toISOString().slice(0, 10)}.zip`, mime: 'application/zip' });
      await this.db.q(`UPDATE data_exports SET status = 'ready', media_id = $2 WHERE id = $1`, [exportId, file.id]);
      await this.notify.send(e.userId, { group: 'account', kind: 'export.ready', title: 'The archive export is ready', link: '/admin/export' });
    } catch (err) { await this.db.q(`UPDATE data_exports SET status = 'failed' WHERE id = $1`, [exportId]); throw err; }
  }

  // ---------- search ----------
  /** Full-text and fuzzy search across stories, transcripts, contributors, places and incidents, in all supported languages. */
  async search(q: string, viewer?: AuthUser | null) {
    const term = (q ?? '').trim();
    if (term.length < 2) return { stories: [], incidents: [], places: [], contributors: [], resources: [] };
    const like = `%${term.replace(/[%_]/g, '')}%`;
    const [stories, incidents, places, contributors, resources] = await Promise.all([
      this.stories.feed({ q: term, tab: 'recent', limit: '20' }, viewer),
      this.db.q(`SELECT id, code, title, event_date, water_body FROM incidents WHERE status = 'published' AND (title ILIKE $1 OR vessel ILIKE $1 OR place_name ILIKE $1 OR similarity(title, $2) > 0.3) ORDER BY similarity(title, $2) DESC LIMIT 10`, [like, term]),
      this.places(term),
      this.db.q(`SELECT u.id, u.username FROM users u WHERE u.role = 'contributor' AND u.status IN ('active','warned') AND (u.username ILIKE $1 OR similarity(u.username, $2) > 0.35) AND EXISTS (SELECT 1 FROM stories s WHERE s.author_id = u.id AND s.status = 'published' AND s.posted_as IN ('self','told_by')) ORDER BY similarity(u.username, $2) DESC LIMIT 10`, [like, term]),
      this.db.q(`SELECT id, slug, title, type FROM resources WHERE status = 'published' AND (title ILIKE $1 OR summary ILIKE $1) LIMIT 10`, [like]),
    ]);
    await this.track.bump(['searches']);
    return { stories: stories.items, incidents, places: places.slice(0, 10), contributors, resources };
  }
}
