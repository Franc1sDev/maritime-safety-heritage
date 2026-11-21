import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Ai, AiUnavailable, Review } from '../ai/ai.service';
import { Approvals } from '../approvals/approvals.service';
import { Audit } from '../common/audit.service';
import { Cache } from '../common/cache.service';
import { Db, decodeCursor, encodeCursor, intParam, pageSize, Row } from '../common/db';
import { AuthUser, isTeam, RequestMeta } from '../common/decorators';
import { Jobs } from '../common/jobs.service';
import { fail, LANGUAGE_NAMES, text } from '../common/messages';
import { Notify } from '../common/notify.service';
import { Realtime } from '../common/realtime.gateway';
import { Track } from '../common/track.service';
import { ZipWriter } from '../common/zip';
import { config } from '../config/config';
import { MediaService } from '../media/media.service';
import { ANONYMOUS_PERSON, COMPANY_PERSON, personSql } from '../users/profile';

export const CATEGORIES = [
  'Ferry and passenger transport', 'Fishing life', 'Rescue and survival', 'Accidents and disasters', 'Storms and weather', 'Boat-building and vessels',
  'Trade and port life', 'Traditions and culture', 'Safety lessons', 'Rivers and floods', 'Women on the water', 'Youth and learning', 'Wildlife and environment',
];
export const RIGHTS = ['All rights reserved', 'CC BY 4.0', 'CC BY-SA 4.0', 'CC BY-NC 4.0', 'CC BY-NC-SA 4.0', 'CC BY-NC-ND 4.0', 'Public domain (CC0)'];
export const TYPE_LABEL: Record<string, string> = { community: 'Community story', testimony: 'Testimony collected by the project', record: 'Historical record' };

export interface StoryInput {
  title?: string; text?: string; language?: string; mediaIds?: string[]; placeId?: number | null; placeName?: string; latitude?: number | null; longitude?: number | null;
  eventDate?: string | null; dateApproximate?: boolean; category?: string; vessel?: string; tags?: string[]; incidentId?: string | null;
  suggestIncident?: { title: string; details?: string }; postedAs?: 'self' | 'told_by' | 'anonymous' | 'company'; toldBy?: string; consentConfirmed?: boolean; consentFormMediaId?: string;
  rights?: string; allowDownload?: boolean; sensitive?: boolean; draft?: boolean;
  type?: 'community' | 'testimony' | 'record'; source?: Record<string, string>; consent?: Record<string, any>;
}

const SELECT = (viewer: string) => `
  s.*, ${personSql('au', 'ap')} AS author_card,
  CASE WHEN i.id IS NULL THEN NULL ELSE jsonb_build_object('id', i.id, 'code', i.code, 'title', i.title) END AS incident,
  CASE WHEN rs.story_id IS NULL THEN NULL ELSE to_jsonb(rs) - 'story_id' END AS source,
  (SELECT r.type FROM reactions r WHERE r.story_id = s.id AND r.user_id = ${viewer}) AS my_reaction,
  EXISTS (SELECT 1 FROM favourites f WHERE f.story_id = s.id AND f.user_id = ${viewer}) AS favourited,
  EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${viewer} AND f.followee_id = s.author_id) AS following_author`;
const FROM = `stories s LEFT JOIN users au ON au.id = s.author_id LEFT JOIN admin_profiles ap ON ap.user_id = au.id
  LEFT JOIN incidents i ON i.id = s.incident_id LEFT JOIN record_sources rs ON rs.story_id = s.id`;
/** Published, the author's account still exists, and neither side has blocked the other. */
export const VISIBLE = (viewer: string) => `s.status = 'published' AND (au.id IS NULL OR au.status NOT IN ('deleted','removed'))
  AND (${viewer} IS NULL OR s.author_id IS NULL OR NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id = ${viewer} AND b.target_id = s.author_id) OR (b.user_id = s.author_id AND b.target_id = ${viewer} AND b.kind = 'block')))`;

@Injectable()
export class StoriesService implements OnModuleInit {
  private readonly log = new Logger('Stories');
  constructor(
    private readonly db: Db, private readonly media: MediaService, private readonly ai: Ai, private readonly jobs: Jobs, private readonly audit: Audit,
    private readonly notify: Notify, private readonly live: Realtime, private readonly track: Track, private readonly approvals: Approvals, private readonly cache: Cache,
  ) {}

  onModuleInit() {
    this.jobs.handle('story.review', async ({ id, edit, waits }) => { await this.review(id, !!edit, Number(waits ?? 0)); });
    this.jobs.handle('story.zip', async ({ id, userId }) => { await this.buildZip(id, userId); });
    this.jobs.handle('story.transcribe', async ({ mediaId }) => { await this.transcribe(mediaId); });
    this.jobs.every('stories.trending', 5 * 60_000, () => this.recalculateTrending());
    this.jobs.every('stories.purge', 3600_000, () => this.purge());
    this.approvals.on('company_story', {
      approved: async (req) => { await this.publish(req.targetId); },
      rejected: async (req) => { await this.db.q(`UPDATE stories SET status = 'draft' WHERE id = $1 AND status = 'awaiting_approval'`, [req.targetId]); },
    });
    this.approvals.on('override', {
      approved: async (req) => {
        await this.db.q(`UPDATE stories SET ai_overridden = true WHERE id = $1`, [req.targetId]);
        await this.db.q(`UPDATE moderation_decisions SET approved = true WHERE target_type = 'story' AND target_id = $1 AND admin_action = 'override'`, [req.targetId]);
        const s = await this.publish(req.targetId);
        if (s?.authorId) await this.notify.send(s.authorId, { group: 'moderation', kind: 'story.override_approved', title: text('outcome_green', s.authorLanguage), body: text('override_approved', s.authorLanguage, { code: s.code }), link: `/stories/${s.code}` });
      },
    });
  }

  // ---------- reading ----------

  private shape(r: Row, media: Row[], viewer?: AuthUser | null) {
    const own = !!viewer && r.authorId === viewer.id;
    const team = isTeam(viewer?.role);
    const author = r.postedAs === 'company' ? COMPANY_PERSON : r.postedAs === 'anonymous' ? ANONYMOUS_PERSON : r.authorCard;
    const inside = own || team;
    return {
      id: r.id, code: r.code, type: r.type, typeLabel: TYPE_LABEL[r.type], title: r.title, text: r.body, language: r.language, languageName: LANGUAGE_NAMES[r.language] ?? r.language,
      postedAs: r.postedAs, toldBy: r.postedAs === 'told_by' ? r.toldBy : '', author,
      place: { id: r.placeId, name: r.placeName, latitude: r.latitude == null ? null : Number(r.latitude), longitude: r.longitude == null ? null : Number(r.longitude), county: r.county, waterBody: r.waterBody },
      eventDate: r.eventDate, dateApproximate: r.dateApproximate, category: r.category, vessel: r.vessel, tags: r.tags, rights: r.rights, allowDownload: r.allowDownload, sensitive: r.sensitive,
      incident: r.incident, source: r.type === 'record' ? r.source : null, consentLabel: r.type === 'testimony' && r.validated ? 'Shared with consent' : null,
      counts: { hearts: r.hearts, heartbreaks: r.heartbreaks, laughs: r.laughs, comments: r.commentsHidden && !team ? r.commentCount : r.commentCount, shares: r.shareCount, links: r.linkCount, favourites: r.favouriteCount, ...(inside ? { views: r.viewCount, downloads: r.downloadCount } : {}) },
      viewer: { reaction: r.myReaction ?? null, favourited: !!r.favourited, followingAuthor: !!r.followingAuthor, own },
      comments: { locked: r.commentsLocked, lockedReason: r.commentsLockedReason, hidden: r.commentsHidden, hiddenReason: r.commentsHiddenReason },
      media: media.filter((m) => m.storyId === r.id).sort((a, b) => a.position - b.position).map((m) => this.media.view(m)),
      status: r.status, publishedAt: r.publishedAt, createdAt: r.createdAt, edited: !!r.editedAt, editedAt: r.editedAt,
      editHistory: inside || r.editedAt ? (r.editHistory ?? []).map((h: any) => ({ at: h.at, ...(inside ? { text: h.text, title: h.title } : {}) })) : [],
      correction: r.correctionNote ? { note: r.correctionNote, link: r.correctionLink } : null,
      permalink: `${config.siteUrl}/stories/${r.code}`,
      moderation: inside ? { aiFlag: r.aiFlag, aiScore: r.aiScore == null ? null : Number(r.aiScore), aiExplanation: r.aiExplanation, overridden: r.aiOverridden, removedReason: r.removedReason, pendingEdit: !!r.pendingEdit, validated: r.validated } : undefined,
      authorId: team ? r.authorId : undefined,
    };
  }
  private async withMedia(rows: Row[], viewer?: AuthUser | null) {
    if (!rows.length) return [];
    const media = await this.db.q(`SELECT * FROM media_files WHERE story_id = ANY($1::uuid[])`, [rows.map((r) => r.id)]);
    return rows.map((r) => this.shape(r, media, viewer));
  }

  /** The "Stories by" tabs, map and timeline all read from here. Cursor pagination keeps infinite scrolling fast. */
  async feed(q: Record<string, string | undefined>, viewer?: AuthUser | null): Promise<{ items: any[]; nextCursor: string | null }> {
    // Visitors all see the same public feed, so it is cached briefly; open access does not load the database on every request.
    if (!viewer && !q.q) return this.cache.wrap(`feed:${JSON.stringify(Object.entries(q).sort())}`, 20, () => this.feedQuery(q, null));
    return this.feedQuery(q, viewer);
  }
  private async feedQuery(q: Record<string, string | undefined>, viewer?: AuthUser | null) {
    const params: unknown[] = [viewer?.id ?? null];
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    const where = [VISIBLE('$1::uuid')];
    let order = 's.trending_score DESC, s.id DESC', key: (r: Row) => unknown[] = (r) => [r.trendingScore, r.id], after = (c: any[]) => `(s.trending_score, s.id) < (${p(c[0])}, ${p(c[1])})`;
    const recent = () => { order = 's.published_at DESC, s.id DESC'; key = (r) => [r.publishedAt, r.id]; after = (c) => `(s.published_at, s.id) < (${p(c[0])}, ${p(c[1])})`; };
    const tab = q.tab ?? 'trending';
    let join = '';
    if (tab === 'following') {
      if (!viewer) return fail(401, 'sign_in_required');
      where.push(`s.author_id IN (SELECT followee_id FROM follows WHERE follower_id = $1) AND s.posted_as IN ('self','told_by')`); recent();
    } else if (tab === 'favorites') {
      if (!viewer) return fail(401, 'sign_in_required');
      join = ` JOIN favourites fav ON fav.story_id = s.id AND fav.user_id = $1`;
      order = 'fav.created_at DESC, s.id DESC'; key = (r) => [r.favAt, r.id]; after = (c) => `(fav.created_at, s.id) < (${p(c[0])}, ${p(c[1])})`;
    } else if (tab === 'recent' || tab === 'timeline') recent();
    if ((q.placeId && intParam(q.placeId) === null) || (q.year && intParam(q.year, 1, 9999) === null) || (q.decade && intParam(q.decade, 1, 9999) === null)) return fail(400, 'invalid_input');
    if (q.placeId) where.push(`s.place_id = ${p(Number(q.placeId))}`);
    if (q.place) where.push(`s.place_name ILIKE ${p(`%${q.place.replace(/[%_]/g, '')}%`)}`);
    if (q.authorId) { where.push(`s.author_id = ${p(q.authorId)} AND s.posted_as IN ('self','told_by')`); recent(); }
    if (q.incidentId) { where.push(`s.incident_id = ${p(q.incidentId)}`); recent(); }
    if (q.collectionId) { join += ` JOIN collection_items ci ON ci.story_id = s.id AND ci.collection_id = ${p(q.collectionId)}`; }
    if (q.category) where.push(`s.category = ${p(q.category)}`);
    if (q.language) where.push(`s.language = ${p(q.language)}`);
    if (q.type) where.push(`s.type = ${p(q.type)}`);
    if (q.year) where.push(`extract(year FROM s.event_date) = ${p(Number(q.year))}`);
    if (q.decade) where.push(`extract(year FROM s.event_date) >= ${p(Number(q.decade))} AND extract(year FROM s.event_date) < ${p(Number(q.decade) + 10)}`);
    if (q.q?.trim()) where.push(`(s.search @@ websearch_to_tsquery('simple', ${p(q.q.trim())}) OR (s.title || ' ' || s.place_name) ILIKE ${p(`%${q.q.trim().replace(/[%_]/g, '')}%`)})`);
    const cur = decodeCursor(q.cursor);
    if (cur) where.push(after(cur));
    const limit = pageSize(q.limit);
    const rows = await this.db.q(`SELECT ${SELECT('$1::uuid')}${tab === 'favorites' ? ', fav.created_at AS fav_at' : ''} FROM ${FROM}${join} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${limit + 1}`, params);
    const page = rows.slice(0, limit);
    return { items: await this.withMedia(page, viewer), nextCursor: rows.length > limit ? encodeCursor(key(page[page.length - 1])) : null };
  }

  private async row(idOrCode: string, viewerId: string | null) {
    const byId = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idOrCode);
    return this.db.one(`SELECT ${SELECT('$1::uuid')}, (${VISIBLE('$1::uuid')}) AS visible FROM ${FROM} WHERE ${byId ? 's.id = $2::uuid' : 'upper(s.code) = upper($2)'}`, [viewerId, idOrCode]);
  }
  /** One story. Drafts, blocked and removed items are never public: only their contributor and the project team see them. */
  async get(idOrCode: string, viewer?: AuthUser | null) {
    const r = await this.row(idOrCode, viewer?.id ?? null);
    if (!r) return fail(404, 'not_found');
    const own = viewer && r.authorId === viewer.id;
    if (!r.visible && !own && !isTeam(viewer?.role)) return fail(404, 'not_found');
    if (r.status === 'deleted' && !isTeam(viewer?.role)) return fail(404, 'not_found');
    return (await this.withMedia([r], viewer))[0];
  }

  async mine(user: AuthUser, status?: string) {
    const rows = await this.db.q(
      `SELECT ${SELECT('$1::uuid')} FROM ${FROM} WHERE s.author_id = $1 AND s.status <> 'deleted' AND s.posted_as <> 'company'
         AND ($2::text IS NULL OR s.status = $2 OR ($2 = 'drafts' AND s.status = 'draft')) ORDER BY s.created_at DESC LIMIT 200`, [user.id, status ?? null]);
    return this.withMedia(rows, user);
  }

  // ---------- writing ----------

  private async attach(storyId: string, user: AuthUser, mediaIds: string[] | undefined, draft: boolean) {
    if (mediaIds === undefined) return;
    const ids = [...new Set(mediaIds)];
    const rows = ids.length ? await this.db.q(`SELECT id, kind, owner_id, story_id FROM media_files WHERE id = ANY($1::uuid[])`, [ids]) : [];
    if (rows.length !== ids.length || rows.some((m) => m.ownerId !== user.id || (m.storyId && m.storyId !== storyId))) return fail(400, 'invalid_input');
    const n = (k: string) => rows.filter((m) => m.kind === k).length;
    if (n('image') > config.limits.images) return fail(400, 'limit_images');
    if (n('video') > 1 || n('audio') > 1 || n('document') > config.limits.documents) return fail(400, 'limit_files');
    await this.db.q(`UPDATE media_files SET story_id = NULL WHERE story_id = $1 AND NOT (id = ANY($2::uuid[]))`, [storyId, ids]);
    for (let i = 0; i < ids.length; i++) await this.db.q(`UPDATE media_files SET story_id = $1, position = $3 WHERE id = $2`, [storyId, ids[i], i]);
    void draft;
  }

  private async fields(dto: StoryInput, user: AuthUser) {
    const f: Record<string, unknown> = {};
    if (dto.title !== undefined) f.title = dto.title.trim().slice(0, 200);
    if (dto.text !== undefined) f.body = dto.text;
    if (dto.language !== undefined) f.language = dto.language.slice(0, 12);
    if (dto.placeId !== undefined) {
      f.place_id = dto.placeId;
      if (dto.placeId) {
        const pl = await this.db.one(`SELECT * FROM places WHERE id = $1`, [dto.placeId]);
        if (!pl) return fail(400, 'invalid_input');
        Object.assign(f, { place_name: pl.name, county: pl.county, water_body: pl.waterBody, latitude: pl.latitude, longitude: pl.longitude });
      }
    }
    if (dto.placeName !== undefined && !dto.placeId) f.place_name = dto.placeName.trim().slice(0, 120);
    if (dto.latitude !== undefined && dto.longitude !== undefined && dto.latitude !== null) { f.latitude = dto.latitude; f.longitude = dto.longitude; }
    if (dto.eventDate !== undefined) f.event_date = dto.eventDate || null;
    if (dto.dateApproximate !== undefined) f.date_approximate = !!dto.dateApproximate;
    if (dto.category !== undefined) { if (dto.category && !CATEGORIES.includes(dto.category)) return fail(400, 'invalid_input'); f.category = dto.category; }
    if (dto.vessel !== undefined) f.vessel = dto.vessel.trim().slice(0, 120);
    if (dto.tags !== undefined) f.tags = [...new Set(dto.tags.map((t) => t.trim().toLowerCase().replace(/^#/, '').slice(0, 30)).filter(Boolean))].slice(0, 10);
    if (dto.incidentId !== undefined) {
      if (dto.incidentId && !(await this.db.one(`SELECT 1 AS x FROM incidents WHERE id = $1 AND status = 'published'`, [dto.incidentId]))) return fail(400, 'invalid_input');
      f.incident_id = dto.incidentId;
    }
    if (dto.postedAs !== undefined) {
      if (dto.postedAs === 'company' && user.role !== 'admin') return fail(403, 'forbidden');
      f.posted_as = dto.postedAs;
    }
    if (dto.toldBy !== undefined) f.told_by = dto.toldBy.trim().slice(0, 120);
    if (dto.consentConfirmed !== undefined) f.consent_confirmed = !!dto.consentConfirmed;
    if (dto.rights !== undefined) { if (!RIGHTS.includes(dto.rights)) return fail(400, 'invalid_input'); f.rights = dto.rights; }
    if (dto.allowDownload !== undefined) f.allow_download = !!dto.allowDownload;
    if (dto.sensitive !== undefined) f.sensitive = !!dto.sensitive;
    if (dto.type !== undefined) { if (dto.type !== 'community' && user.role !== 'admin') return fail(403, 'forbidden'); f.type = dto.type; }
    return f;
  }

  private async checkComplete(id: string, ownerId?: string) {
    const s = await this.db.one(`SELECT s.*, (SELECT count(*)::int FROM media_files m WHERE m.story_id = s.id) AS files FROM stories s WHERE s.id = $1`, [id]);
    if (!s) return fail(404, 'not_found');
    // Someone else's story is refused before anything about it is said.
    if (ownerId && s.authorId !== ownerId) return fail(403, 'forbidden');
    if (!s.body.trim() && !s.files) return fail(400, 'story_empty');
    if (s.postedAs === 'told_by' && !s.consentConfirmed) return fail(400, 'consent_required');
    return s;
  }

  /** Create a story: saved as a draft, or sent for AI review. A repeated submission with the same idempotency key never creates a duplicate. */
  async create(user: AuthUser, dto: StoryInput, idempotencyKey: string | undefined, meta: RequestMeta) {
    if (idempotencyKey) {
      const dup = await this.db.one(`SELECT id FROM stories WHERE author_id = $1 AND idempotency_key = $2`, [user.id, idempotencyKey]);
      if (dup) return this.get(dup.id, user);
    }
    // Rate limits are stricter for new accounts (Section 4.7).
    const recent = await this.db.one(`SELECT count(*)::int AS n, (SELECT created_at > now() - interval '24 hours' FROM users WHERE id = $1) AS fresh FROM stories WHERE author_id = $1 AND created_at > now() - interval '24 hours'`, [user.id]);
    if (user.role === 'contributor' && (recent?.n ?? 0) >= (recent?.fresh ? config.newAccountDailyStories : 40)) return fail(429, 'rate_limited');
    const f = await this.fields({ language: user.language, ...dto }, user);
    const cols = ['author_id', 'idempotency_key', ...Object.keys(f)];
    const vals = [user.id, idempotencyKey ?? null, ...Object.values(f)];
    const s = (await this.db.one(`INSERT INTO stories (${cols.join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id, code`, vals))!;
    try {
      await this.attach(s.id, user, dto.mediaIds ?? [], !!dto.draft);
      await this.saveExtras(s.id, dto, user);
      if (!dto.draft) await this.checkComplete(s.id);
    } catch (e) {
      // A story that fails a rule is not left behind as a stray draft.
      await this.db.q(`UPDATE media_files SET story_id = NULL WHERE story_id = $1`, [s.id]);
      await this.db.q(`DELETE FROM stories WHERE id = $1`, [s.id]);
      throw e;
    }
    if (dto.suggestIncident?.title?.trim()) {
      const inc = await this.db.one(`INSERT INTO incidents (title, summary, status, suggested_by) VALUES ($1,$2,'suggested',$3) RETURNING id`, [dto.suggestIncident.title.trim().slice(0, 200), (dto.suggestIncident.details ?? '').slice(0, 2000), user.id]);
      await this.notify.admins({ group: 'moderation', kind: 'incident.suggested', title: 'New incident suggested', body: `${user.name} suggested the incident “${dto.suggestIncident.title.trim()}” with story ${s.code}.`, link: `/admin/incidents?suggested=${inc!.id}` });
    }
    if (!dto.draft) return this.submit(s.id, user, meta);
    return { ...(await this.get(s.id, user)), message: text('draft_saved', meta.lang) };
  }

  private async saveExtras(id: string, dto: StoryInput, user: AuthUser) {
    if (dto.source && user.role === 'admin') {
      const x = dto.source;
      await this.db.q(`INSERT INTO record_sources (story_id, institution, reference, original_date, creator, rights_statement, obtained) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (story_id) DO UPDATE SET institution = $2, reference = $3, original_date = $4, creator = $5, rights_statement = $6, obtained = $7`,
        [id, x.institution ?? '', x.reference ?? '', x.originalDate ?? '', x.creator ?? '', x.rightsStatement ?? '', x.obtained ?? '']);
    }
    if (dto.consent && user.role === 'admin') {
      const c = dto.consent;
      await this.db.q(`INSERT INTO consent_records (story_id, storyteller, consent_type, consent_date, form_media_id, restrictions, validated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (story_id) DO UPDATE SET storyteller = $2, consent_type = $3, consent_date = $4, form_media_id = coalesce($5, consent_records.form_media_id), restrictions = $6, validated_at = $7`,
        [id, c.storyteller ?? '', c.consentType ?? '', c.consentDate || null, c.formMediaId ?? null, JSON.stringify(c.restrictions ?? {}), c.validated ? new Date() : null]);
      await this.db.q(`UPDATE stories SET validated = $2 WHERE id = $1`, [id, !!c.validated]);
    } else if (dto.consentFormMediaId) {
      await this.db.q(`INSERT INTO consent_records (story_id, storyteller, consent_type, form_media_id) VALUES ($1,$2,'told_by',$3) ON CONFLICT (story_id) DO UPDATE SET form_media_id = $3`, [id, dto.toldBy ?? '', dto.consentFormMediaId]);
    }
  }

  /** Edit. A draft is simply saved; a published story keeps showing its current version while the changes are checked. */
  async update(id: string, user: AuthUser, dto: StoryInput, meta: RequestMeta) {
    const s = await this.db.one(`SELECT * FROM stories WHERE id = $1`, [id]);
    if (!s || s.status === 'deleted') return fail(404, 'not_found');
    if (s.authorId !== user.id) return fail(403, 'forbidden');
    const f = await this.fields(dto, user);
    if (['draft', 'awaiting_approval'].includes(s.status) || (s.status === 'pending_review' && !s.aiFlag)) {
      const keys = Object.keys(f);
      if (keys.length) await this.db.q(`UPDATE stories SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() WHERE id = $1`, [id, ...Object.values(f)]);
      await this.attach(id, user, dto.mediaIds, true);
      await this.saveExtras(id, dto, user);
      if (dto.draft === false) return this.submit(id, user, meta);
      return { ...(await this.get(id, user)), message: text('draft_saved', meta.lang) };
    }
    if (s.status !== 'published') return fail(409, 'already_exists');
    if (dto.mediaIds) await this.attach(id, user, dto.mediaIds, false);
    await this.db.q(`UPDATE stories SET pending_edit = $2, updated_at = now() WHERE id = $1`, [id, JSON.stringify(f)]);
    await this.jobs.add('story.review', { id, edit: true });
    return { ...(await this.get(id, user)), message: text('edit_under_review', meta.lang) };
  }

  /** SEND / SUBMIT: the story goes to AI review, which finishes within 3 minutes. */
  async submit(id: string, user: AuthUser, meta: RequestMeta) {
    const s = await this.checkComplete(id, user.id);
    if (!['draft', 'reviewing'].includes(s.status)) return fail(409, 'already_exists');
    await this.db.q(`UPDATE stories SET status = 'reviewing', updated_at = now() WHERE id = $1`, [id]);
    await this.jobs.add('story.review', { id });
    await this.track.event('story.submitted', this.track.actor(user), { storyId: id });
    return { ...(await this.get(id, user)), message: text('review_in_progress', meta.lang) };
  }

  /** True when this is the only published story the Contributor has posted under their own name or as told by someone. */
  private async firstStory(id: string, authorId: string | null) {
    if (!authorId) return false;
    const r = await this.db.one(`SELECT count(*)::int AS n, bool_and(id = $2) AS only FROM stories WHERE author_id = $1 AND status = 'published' AND posted_as IN ('self','told_by','anonymous')`, [authorId, id]);
    return r?.n === 1 && !!r.only;
  }

  /** Where a submitted story stands, for the progress indicator. */
  async reviewStatus(id: string, user: AuthUser, lang: string) {
    const s = await this.db.one(`SELECT id, code, status, ai_flag, ai_explanation, author_id, pending_edit FROM stories WHERE id = $1`, [id]);
    if (!s || (s.authorId !== user.id && !isTeam(user.role))) return fail(404, 'not_found');
    const done = s.status !== 'reviewing' && !s.pendingEdit;
    const first = done && s.status === 'published' && s.aiFlag !== 'YELLOW' && (await this.firstStory(s.id, s.authorId));
    const outcome = !done ? 'review_in_progress' : s.aiFlag === 'RED' ? 'outcome_red' : s.aiFlag === 'YELLOW' ? 'outcome_yellow' : s.status === 'published' ? (first ? 'first_story_live' : 'outcome_green') : 'submitted_for_approval';
    return { id: s.id, code: s.code, status: s.status, done, flag: s.aiFlag, explanation: s.aiExplanation, message: text(done && s.status === 'pending_review' && !s.aiFlag ? 'submitted_for_approval' : outcome, lang) };
  }

  // ---------- AI review pipeline ----------

  private async reviewInput(s: Row, override?: Record<string, any>, force = false) {
    const media = await this.db.q(`SELECT * FROM media_files WHERE story_id = $1 ORDER BY position`, [s.id]);
    if (!force && media.some((m) => m.processing === 'queued' || m.processing === 'working')) return null;
    const images: Array<{ mime: string; base64: string }> = [];
    if (this.ai.provider !== 'rules') {
      for (const m of media) {
        const v = m.kind === 'image' ? m.variants?.medium : m.kind === 'video' ? m.variants?.poster : null;
        if (!v || images.length >= 6) continue;
        const chunks: Buffer[] = [];
        for await (const c of (await this.media.openKey(v.key, v.encrypted)).stream) chunks.push(c as Buffer);
        images.push({ mime: v.mime, base64: Buffer.concat(chunks).toString('base64') });
      }
    }
    const title = override?.title ?? s.title, body = override?.body ?? s.body;
    const textParts = [title, body, ...media.map((m) => m.transcript).filter(Boolean), ...media.map((m) => m.altText).filter(Boolean)];
    return { kind: 'story' as const, text: textParts.filter(Boolean).join('\n\n'), language: s.language, images, context: `Story type: ${TYPE_LABEL[s.type]}. Place: ${s.placeName || 'not given'}.` };
  }

  private async review(id: string, edit: boolean, waits: number) {
    const s = await this.db.one(`SELECT s.*, u.language AS author_language FROM stories s LEFT JOIN users u ON u.id = s.author_id WHERE s.id = $1`, [id]);
    if (!s || (edit ? !s.pendingEdit : s.status !== 'reviewing')) return;
    let input = await this.reviewInput(s, edit ? s.pendingEdit : undefined);
    if (!input) {
      // Video or audio is still being converted: look again shortly. After about two and a half minutes the text is reviewed on its own, so the 3-minute limit holds.
      if (waits < 50) { await this.jobs.add('story.review', { id, edit, waits: waits + 1 }, { delayMs: config.env === 'test' ? 250 : 3000 }); return; }
      input = await this.reviewInput(s, edit ? s.pendingEdit : undefined, true);
    }
    const lang = s.authorLanguage ?? 'en';
    let result: Review | null = null;
    try { if (input) result = await this.ai.review({ ...input, language: lang }); }
    catch (e) { if (!(e instanceof AiUnavailable)) throw e; this.log.warn(`AI review unavailable for ${s.code}: ${e.message}`); }

    if (!result) {
      // Fallback: nothing is published unchecked. The item waits as "Pending review" for the admins.
      if (edit) { await this.db.q(`UPDATE stories SET pending_edit = NULL WHERE id = $1`, [id]); return; }
      await this.db.q(`UPDATE stories SET status = 'pending_review', ai_flag = NULL WHERE id = $1`, [id]);
      await this.notify.admins({ group: 'moderation', kind: 'story.pending', title: 'Story waiting for review', body: `${s.code} could not be checked by AI and is waiting for an admin.`, link: `/admin/moderation?open=${s.code}` });
      this.live.toUser(s.authorId, 'story.review', { id, status: 'pending_review', flag: null, message: text('submitted_for_approval', lang) });
      return;
    }
    await this.db.q(`INSERT INTO moderation_decisions (target_type, target_id, ai_flag, ai_score, ai_explanation, model, guidance_version) VALUES ('story',$1,$2,$3,$4,$5,$6)`,
      [id, result.flag, result.score, JSON.stringify({ summary: result.summary, guidelines: result.guidelines }), result.model, result.guidanceVersion]);
    await this.track.bump([`flag.${result.flag.toLowerCase()}`]);
    const explanation = JSON.stringify({ summary: result.summary, guidelines: result.guidelines.filter((g) => g.score > 20) });

    if (edit) {
      if (result.flag === 'RED') {
        await this.db.q(`UPDATE stories SET pending_edit = NULL WHERE id = $1`, [id]);
        if (s.authorId) await this.notify.send(s.authorId, { group: 'moderation', kind: 'story.edit_rejected', title: 'Your changes were not published', body: `${s.code}: ${result.summary}`, link: `/stories/${s.code}`, data: { explanation: result } });
      } else {
        const f = s.pendingEdit as Record<string, unknown>;
        const keys = Object.keys(f);
        const history = [...(s.editHistory ?? []), { at: new Date().toISOString(), title: s.title, text: s.body }].slice(-20);
        await this.db.q(`UPDATE stories SET ${keys.map((k, i) => `${k} = $${i + 4}`).join(', ')}${keys.length ? ',' : ''} pending_edit = NULL, edited_at = now(), edit_history = $2, ai_flag = $3, updated_at = now() WHERE id = $1`,
          [id, JSON.stringify(history), result.flag, ...Object.values(f)]);
      }
      this.live.toUser(s.authorId, 'story.review', { id, status: s.status, flag: result.flag, edit: true });
      return;
    }

    await this.db.q(`UPDATE stories SET ai_flag = $2, ai_score = $3, ai_explanation = $4 WHERE id = $1`, [id, result.flag, result.score, explanation]);
    let first = false;
    if (result.flag === 'RED') {
      await this.db.q(`UPDATE stories SET status = 'pending_review' WHERE id = $1`, [id]);
      if (s.authorId) await this.notify.send(s.authorId, { group: 'moderation', kind: 'story.red', title: text('outcome_red', lang), body: `${s.code}: ${result.summary} An admin will review it.`, link: `/profile/stories?open=${s.code}`, data: { explanation: result } });
      await this.notify.admins({ group: 'moderation', kind: 'story.red', title: 'RED story waiting for review', body: `${s.code} was blocked by AI review (${result.score}%).`, link: `/admin/moderation?open=${s.code}`, actionKey: `moderate:${id}` });
      this.live.toAdmins('moderation', { id, code: s.code, flag: 'RED' });
    } else if (s.postedAs === 'company') {
      await this.db.q(`UPDATE stories SET status = 'awaiting_approval' WHERE id = $1`, [id]);
    } else if (s.type === 'testimony' && !(await this.consentComplete(id))) {
      await this.db.q(`UPDATE stories SET status = 'awaiting_validation' WHERE id = $1`, [id]);
    } else {
      await this.publish(id);
      first = await this.firstStory(id, s.authorId);
      if (s.authorId) {
        if (result.flag === 'YELLOW') await this.notify.send(s.authorId, { group: 'moderation', kind: 'story.yellow', title: text('outcome_yellow', lang), body: `${s.code}: ${result.summary}${first ? ` ${text('first_story_thanks', lang)}` : ''}`, link: `/stories/${s.code}`, data: { explanation: result } });
        else await this.notify.send(s.authorId, { group: 'engagement', kind: 'story.green', title: text(first ? 'first_story_live' : 'outcome_green', lang), body: first ? `${s.code}: ${text('first_story_thanks', lang)}` : s.code, link: `/stories/${s.code}` });
      }
    }
    const now = await this.db.one(`SELECT status FROM stories WHERE id = $1`, [id]);
    this.live.toUser(s.authorId, 'story.review', { id, code: s.code, status: now?.status, flag: result.flag, summary: result.summary, first,
      message: text(result.flag === 'RED' ? 'outcome_red' : result.flag === 'YELLOW' ? 'outcome_yellow' : now?.status === 'published' ? (first ? 'first_story_live' : 'outcome_green') : 'submitted_for_approval', lang) });
  }

  /** A testimony collected by the project is published only when its consent record is complete and it is validated with the storyteller. */
  async consentComplete(id: string) {
    const c = await this.db.one(`SELECT c.*, s.validated FROM consent_records c JOIN stories s ON s.id = c.story_id WHERE c.story_id = $1`, [id]);
    return !!(c && c.storyteller && c.consentType && c.validatedAt && !c.withdrawnAt && c.validated);
  }

  async publish(id: string): Promise<Row | null> {
    const s = await this.db.one(`UPDATE stories SET status = 'published', published_at = coalesce(published_at, now()), updated_at = now() WHERE id = $1 RETURNING *`, [id]);
    if (!s) return null;
    const u = s.authorId ? await this.db.one(`SELECT language, role FROM users WHERE id = $1`, [s.authorId]) : null;
    await this.track.event('story.published', { actor: '', actorType: u?.role ?? 'admin' }, { storyId: id, metrics: [`stories.${s.type}`, ...(s.language !== 'en' ? ['stories.non_english'] : [])], meta: { type: s.type, county: s.county, waterBody: s.waterBody, language: s.language } });
    for (const m of await this.db.q(`SELECT id FROM media_files WHERE story_id = $1 AND kind IN ('audio','video') AND transcript = ''`, [id])) {
      if (this.ai.canTranscribe) await this.jobs.add('story.transcribe', { mediaId: m.id });
    }
    await this.cache.drop('feed:');
    this.live.toAll('story.published', { id, code: s.code });
    return { ...s, authorLanguage: u?.language ?? 'en' };
  }

  private async transcribe(mediaId: string) {
    const m = await this.media.byId(mediaId);
    if (!m || m.transcript) return;
    const v = m.variants?.web ?? { key: m.storageKey, encrypted: m.encrypted };
    const dir = await fs.mkdtemp(join(tmpdir(), 'msh-tr-'));
    const path = join(dir, m.kind === 'audio' ? 'a.m4a' : 'a.mp4');
    try {
      await fs.writeFile(path, (await this.media.openKey(v.key, v.encrypted)).stream);
      const t = await this.ai.transcribe(path, 'audio.m4a');
      if (!t) return;
      await this.db.q(`UPDATE media_files SET transcript = $2, transcript_segments = $3 WHERE id = $1`, [mediaId, t.text, JSON.stringify(t.segments)]);
      if (m.storyId) await this.db.q(`UPDATE stories SET transcript_text = (SELECT coalesce(string_agg(transcript, ' '), '') FROM media_files WHERE story_id = $1) WHERE id = $1`, [m.storyId]);
    } finally { await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined); }
  }
  /** Contributors can correct a transcript. */
  async saveTranscript(mediaId: string, user: AuthUser, transcript: string) {
    const m = await this.db.one(`SELECT m.id, m.story_id, s.author_id FROM media_files m JOIN stories s ON s.id = m.story_id WHERE m.id = $1`, [mediaId]);
    if (!m || (m.authorId !== user.id && user.role !== 'admin')) return fail(403, 'forbidden');
    await this.db.q(`UPDATE media_files SET transcript = $2, transcript_segments = NULL WHERE id = $1`, [mediaId, transcript.slice(0, 200_000)]);
    await this.db.q(`UPDATE stories SET transcript_text = (SELECT coalesce(string_agg(transcript, ' '), '') FROM media_files WHERE story_id = $1) WHERE id = $1`, [m.storyId]);
    return { ok: true };
  }

  // ---------- deleting ----------

  /** The contributor deletes their own story: hidden at once, recoverable for 30 days, then permanently erased. */
  async remove(id: string, user: AuthUser, meta: RequestMeta) {
    const s = await this.db.one(`SELECT id, code, author_id FROM stories WHERE id = $1 AND status <> 'deleted'`, [id]);
    if (!s) return fail(404, 'not_found');
    if (s.authorId !== user.id) return fail(403, 'forbidden');
    await this.db.q(`UPDATE stories SET status = 'deleted', deleted_at = now(), purge_at = now() + interval '30 days', removed_reason = 'author_deleted' WHERE id = $1`, [id]);
    await this.cache.drop('feed:');
    await this.audit.record({ actor: user, action: 'story.delete', entityType: 'story', entityId: id, summary: `${user.name} deleted their story ${s.code}`, ip: meta.ip });
    return { message: text('story_deleted', meta.lang) };
  }

  /** Scheduled purging after the recovery and retention periods (Section 7.3). */
  async purge() {
    const rows = await this.db.q(`SELECT id FROM stories WHERE purge_at IS NOT NULL AND purge_at < now() AND status IN ('deleted','removed') LIMIT 200`);
    for (const r of rows) {
      for (const m of await this.db.q(`SELECT * FROM media_files WHERE story_id = $1`, [r.id])) await this.media.removeObjects(m);
      await this.db.q(`DELETE FROM stories WHERE id = $1`, [r.id]);
    }
    // Uploads that were never attached to anything are cleared after a day.
    for (const m of await this.db.q(`SELECT * FROM media_files WHERE story_id IS NULL AND comment_id IS NULL AND message_id IS NULL AND purpose IN ('story','comment','message') AND created_at < now() - interval '24 hours' LIMIT 200`)) await this.media.remove(m.id);
    return rows.length;
  }

  // ---------- engagement ----------

  private async visibleId(id: string, viewer: AuthUser | null | undefined) {
    const r = await this.db.one(`SELECT s.id, s.code, s.author_id, s.posted_as, s.allow_download, s.title FROM stories s LEFT JOIN users au ON au.id = s.author_id WHERE s.id = $2 AND ${VISIBLE('$1::uuid')}`, [viewer?.id ?? null, id]);
    return r ?? fail(404, 'not_found');
  }
  private async counts(id: string) {
    const r = (await this.db.one(`SELECT hearts, heartbreaks, laughs, comment_count, share_count, link_count, favourite_count FROM stories WHERE id = $1`, [id]))!;
    return { hearts: r.hearts, heartbreaks: r.heartbreaks, laughs: r.laughs, comments: r.commentCount, shares: r.shareCount, links: r.linkCount, favourites: r.favouriteCount };
  }
  private recount = `UPDATE stories s SET hearts = (SELECT count(*) FROM reactions r WHERE r.story_id = s.id AND r.type = 'heart'),
      heartbreaks = (SELECT count(*) FROM reactions r WHERE r.story_id = s.id AND r.type = 'heartbreak'), laughs = (SELECT count(*) FROM reactions r WHERE r.story_id = s.id AND r.type = 'laugh'),
      favourite_count = (SELECT count(*) FROM favourites f WHERE f.story_id = s.id) WHERE s.id = $1`;

  /** Heart, Heartbreak or Laugh. Choosing the same one again removes it. */
  async react(id: string, user: AuthUser, type: 'heart' | 'heartbreak' | 'laugh' | null) {
    const s = await this.visibleId(id, user);
    const cur = await this.db.one(`SELECT type FROM reactions WHERE story_id = $1 AND user_id = $2`, [id, user.id]);
    const next = !type || cur?.type === type ? null : type;
    if (next) await this.db.q(`INSERT INTO reactions (story_id, user_id, type) VALUES ($1,$2,$3) ON CONFLICT (story_id, user_id) DO UPDATE SET type = $3, created_at = now()`, [id, user.id, next]);
    else await this.db.q(`DELETE FROM reactions WHERE story_id = $1 AND user_id = $2`, [id, user.id]);
    await this.db.q(this.recount, [id]);
    if (next && !cur) {
      await this.track.event('reaction', this.track.actor(user), { storyId: id, metrics: ['engagement'], meta: { type: next } });
      if (s.authorId && s.authorId !== user.id && s.postedAs !== 'company') {
        // The first reaction a story receives gets a word of encouragement.
        const firstReaction = (await this.db.one(`SELECT count(*)::int AS n FROM reactions WHERE story_id = $1 AND user_id <> $2`, [id, s.authorId]))?.n === 1;
        const lang = (await this.db.one(`SELECT language FROM users WHERE id = $1`, [s.authorId]))?.language ?? 'en';
        await this.notify.send(s.authorId, { group: 'engagement', kind: 'story.reaction', title: text(firstReaction ? 'first_reaction' : 'story_reaction', lang, { name: user.name }), body: s.code, link: `/stories/${s.code}` });
      }
    }
    const counts = await this.counts(id);
    this.live.toAll('story.counts', { id, counts });
    return { reaction: next, counts };
  }

  /** A story can be in a person's Favorites only once; the same action removes it again. */
  async favourite(id: string, user: AuthUser, lang: string) {
    await this.visibleId(id, user);
    const had = await this.db.q(`DELETE FROM favourites WHERE story_id = $1 AND user_id = $2 RETURNING story_id`, [id, user.id]);
    if (!had.length) {
      await this.db.q(`INSERT INTO favourites (story_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, user.id]);
      await this.track.event('favourite', this.track.actor(user), { storyId: id, metrics: ['engagement'] });
    }
    await this.db.q(this.recount, [id]);
    return { favourited: !had.length, counts: await this.counts(id), message: text(had.length ? 'favourite_removed' : 'favourite_added', lang) };
  }

  async share(id: string, user: AuthUser | undefined, kind: 'share' | 'copy_link' | 'cite', target: string, visitor: string) {
    await this.visibleId(id, user);
    await this.db.q(`INSERT INTO shares (story_id, user_id, kind, target) VALUES ($1,$2,$3,$4)`, [id, user?.id ?? null, kind, target.slice(0, 40)]);
    await this.db.q(kind === 'share' ? `UPDATE stories SET share_count = share_count + 1 WHERE id = $1` : `UPDATE stories SET link_count = link_count + 1 WHERE id = $1`, [id]);
    await this.track.event(kind, this.track.actor(user, visitor), { storyId: id, metrics: ['engagement'], meta: { target } });
    return { counts: await this.counts(id) };
  }

  /** One view per person per story per hour. */
  async view(id: string, user: AuthUser | undefined, visitor: string) {
    const who = this.track.actor(user, visitor);
    const seen = await this.db.one(`SELECT 1 AS x FROM story_views WHERE story_id = $1 AND visitor = $2 AND created_at > now() - interval '1 hour'`, [id, who.actor]);
    if (seen) return { counted: false };
    const ok = await this.db.q(`UPDATE stories SET view_count = view_count + 1 WHERE id = $1 AND status = 'published' RETURNING id`, [id]);
    if (!ok.length) return { counted: false };
    await this.db.q(`INSERT INTO story_views (story_id, user_id, visitor) VALUES ($1,$2,$3)`, [id, null, who.actor]);
    await this.track.event('view', who, { storyId: id, metrics: [`visits.${who.actorType}`] });
    return { counted: true };
  }

  /** score = weighted engagement ÷ (hours since posting + 2)^gravity, so newer stories with strong engagement rise above older ones. */
  async recalculateTrending() {
    await this.db.q(
      `UPDATE stories SET trending_score = ((hearts + heartbreaks + laughs) * 3 + comment_count * 4 + share_count * 5 + link_count * 2 + favourite_count * 4 + download_count * 2 + view_count * 0.2 + 1)
         / power(extract(epoch FROM (now() - coalesce(published_at, created_at))) / 3600 + 2, 1.5) WHERE status = 'published'`);
  }

  // ---------- cite, translate, download ----------

  async cite(idOrCode: string, viewer?: AuthUser | null) {
    const s = await this.get(idOrCode, viewer);
    const who = s.postedAs === 'told_by' && s.toldBy ? `${s.toldBy} (as told to ${s.author?.name ?? 'a contributor'})` : s.source?.creator || s.author?.name || 'Anonymous';
    const year = new Date(s.publishedAt ?? s.createdAt).getFullYear();
    const title = s.title || (s.text ?? '').split(/\s+/).slice(0, 10).join(' ') + '…';
    const accessed = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const archive = 'Remembering the Waters: Kenya’s Maritime and Inland-Water Safety Heritage Archive';
    return {
      code: s.code, permalink: s.permalink, rights: s.rights,
      // Descriptive metadata following Dublin Core, so the collection can be shared with libraries and museums.
      dublinCore: { 'dc:identifier': s.code, 'dc:title': title, 'dc:creator': who, 'dc:contributor': s.author?.name ?? '', 'dc:type': s.typeLabel, 'dc:date': s.eventDate ? String(s.eventDate).slice(0, 10) : '', 'dcterms:issued': s.publishedAt,
        'dc:coverage': [s.place.name, s.place.county, s.place.waterBody].filter(Boolean).join(', '), 'dc:subject': [s.category, ...(s.tags ?? [])].filter(Boolean), 'dc:language': s.language, 'dc:rights': s.rights,
        'dc:source': s.source ? [s.source.institution, s.source.reference].filter(Boolean).join(', ') : '', 'dc:relation': s.incident ? `${config.siteUrl}/incidents/${s.incident.code}` : '', 'dc:format': s.media.map((m: any) => m.mimeType), 'dc:publisher': archive },
      apa: `${who}. (${year}). ${title} [${s.typeLabel}, ${s.code}]. ${archive}. ${s.permalink}`,
      mla: `${who}. “${title}.” ${archive}, ${year}, ${s.permalink}. Accessed ${accessed}.`,
      chicago: `${who}. “${title}.” ${s.typeLabel} ${s.code}. ${archive}, ${year}. ${s.permalink}.`,
      harvard: `${who} (${year}) ‘${title}’, ${archive}, ${s.code}. Available at: ${s.permalink} (Accessed: ${accessed}).`,
    };
  }

  async translate(idOrCode: string, to: string, viewer?: AuthUser | null) {
    const s = await this.get(idOrCode, viewer);
    const transcript = s.media.map((m: any) => m.transcript).filter(Boolean).join('\n\n');
    const source = [s.title, s.text, transcript].filter(Boolean).join('\n\n---\n\n');
    try {
      const t = await this.ai.translate('story', s.id, source, to);
      return { language: to, from: s.language, fromName: s.languageName, machineTranslated: true, text: t.body, label: `Machine-translated from ${s.languageName}` };
    } catch (e) { if (e instanceof AiUnavailable) return fail(503, 'translation_unavailable'); throw e; }
  }

  /** Download: a ZIP of all the story's content, prepared in the background. Shown only where the contributor's usage rights allow it. */
  async requestZip(id: string, user: AuthUser | undefined, meta: RequestMeta) {
    const s = await this.visibleId(id, user);
    if (!s.allowDownload) return fail(403, 'download_not_allowed');
    const exp = await this.db.one(`INSERT INTO data_exports (user_id, kind) VALUES ($1, $2) RETURNING id`, [user?.id ?? (await this.systemUserId()), `story:${id}`]);
    await this.jobs.add('story.zip', { id, userId: user?.id ?? null, exportId: exp!.id });
    await this.db.q(`UPDATE stories SET download_count = download_count + 1 WHERE id = $1`, [id]);
    await this.db.q(`INSERT INTO shares (story_id, user_id, kind) VALUES ($1,$2,'download')`, [id, user?.id ?? null]);
    await this.track.event('download', this.track.actor(user, meta.visitor), { storyId: id, metrics: ['engagement'] });
    return { exportId: exp!.id, message: text('zip_preparing', meta.lang) };
  }
  private async systemUserId() { return (await this.db.one(`SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1`))?.id; }

  async zipStatus(exportId: string, lang: string) {
    const e = await this.db.one(`SELECT e.*, m.id AS mid FROM data_exports e LEFT JOIN media_files m ON m.id = e.media_id WHERE e.id = $1`, [exportId]);
    if (!e) return fail(404, 'not_found');
    return { status: e.status, url: e.status === 'ready' && e.mid ? `${this.media.link(e.mid, 'original')}&download=1` : null, message: text(e.status === 'ready' ? 'zip_ready' : 'zip_preparing', lang) };
  }

  private async buildZip(id: string, _userId: string | null) {
    const exp = await this.db.one(`SELECT id FROM data_exports WHERE kind = $1 AND status = 'preparing' ORDER BY created_at DESC LIMIT 1`, [`story:${id}`]);
    if (!exp) return;
    try {
      const s = await this.get(id, null);
      const rows = await this.db.q(`SELECT * FROM media_files WHERE story_id = $1 ORDER BY position`, [id]);
      const path = join(tmpdir(), `msh-${exp.id}.zip`);
      const zip = new ZipWriter(path);
      const cite = await this.cite(id, null);
      const lines = [s.title, `Story ${s.code} · ${s.typeLabel}`, `By: ${s.author?.name ?? ''}${s.toldBy ? ` (as told by ${s.toldBy})` : ''}`, s.place.name ? `Place: ${s.place.name}` : '', s.eventDate ? `Date of the event: ${s.dateApproximate ? 'about ' : ''}${String(s.eventDate).slice(0, 10)}` : '',
        `Rights: ${s.rights}`, `Permanent link: ${s.permalink}`, '', s.text, '', ...rows.filter((m) => m.transcript).map((m) => `Transcript of ${m.originalName}:\n${m.transcript}\n`), `Cite as: ${cite.apa}`];
      await zip.add(`${s.code}/story.txt`, Buffer.from(lines.filter((l) => l !== undefined).join('\n'), 'utf8'));
      let n = 0;
      for (const m of rows) {
        n++;
        // Images and video are added as the cleaned copies (no hidden location data); documents and audio as uploaded.
        const v = m.kind === 'image' ? m.variants?.full ?? m.variants?.medium : m.kind === 'video' ? m.variants?.web : m.kind === 'audio' ? m.variants?.web : null;
        const src = v ? await this.media.openKey(v.key, v.encrypted) : m.kind === 'image' ? null : await this.media.openKey(m.storageKey, m.encrypted);
        if (!src) continue;
        const ext = v ? ({ 'image/webp': 'webp', 'video/mp4': 'mp4', 'audio/mp4': 'm4a' } as Record<string, string>)[v.mime] ?? 'bin' : (m.originalName.split('.').pop() ?? 'bin');
        await zip.add(`${s.code}/${String(n).padStart(2, '0')}-${m.originalName.replace(/\.[^.]+$/, '')}.${ext}`, src.stream);
      }
      await zip.close();
      const file = await this.media.storeGenerated(path, { ownerId: null, purpose: 'export', name: `${s.code}.zip`, mime: 'application/zip' });
      await this.db.q(`UPDATE data_exports SET status = 'ready', media_id = $2 WHERE id = $1`, [exp.id, file.id]);
    } catch (e) {
      await this.db.q(`UPDATE data_exports SET status = 'failed' WHERE id = $1`, [exp.id]);
      throw e;
    }
  }

  dropFeedCache() { return this.cache.drop('feed:'); }

  async suggest(textIn: string) { return this.ai.suggest(textIn, CATEGORIES); }
}
