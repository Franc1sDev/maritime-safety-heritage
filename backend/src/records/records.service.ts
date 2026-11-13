import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { AuthUser, RequestMeta } from '../common/decorators';
import { pageOf } from '../common/pagination';
import { buildSearchText } from '../common/search-text';
import { config } from '../config/config';
import { ArchiveRecord, RecordView, TranscriptSegment } from '../database/entities';
import { MediaService } from '../media/media.service';
import { TYPE_LABELS, VocabService } from '../vocab/vocab.service';
import { RecordInputDto, RecordQuery, RecordUpdateDto } from './record.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Highlight markers in search snippets. Clients escape the text, then turn these into <mark> tags. */
export const MARK_START = '⟦', MARK_END = '⟧';

/** Builds a prefix-matching query from plain words, or uses web-search syntax when the user typed quotes, "or" or "-". */
function tsQuery(q: string): { sql: string; value: string } | null {
  if (/["]|\bor\b|(^|\s)-\w/i.test(q)) return { sql: `websearch_to_tsquery('simple', :tsq)`, value: q };
  const words = q.toLowerCase().split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean).slice(0, 12);
  if (!words.length) return null;
  return { sql: `to_tsquery('simple', :tsq)`, value: words.map((w) => `${w}:*`).join(' & ') };
}

@Injectable()
export class RecordsService {
  constructor(
    @InjectRepository(ArchiveRecord) private readonly records: Repository<ArchiveRecord>,
    @InjectRepository(RecordView) private readonly views: Repository<RecordView>,
    private readonly ds: DataSource,
    private readonly vocab: VocabService,
    private readonly media: MediaService,
    private readonly activity: ActivityService,
  ) {}

  private summary(r: ArchiveRecord, snippet?: string | null) {
    return {
      id: r.id, identifier: r.identifier, type: r.type, typeLabel: TYPE_LABELS[r.type], format: r.format, title: r.title, summary: r.summary,
      year: r.year, yearApproximate: r.yearApproximate, waterBody: r.waterBody ? { id: r.waterBody.id, name: r.waterBody.name } : null,
      county: r.county, place: r.place, latitude: r.latitude, longitude: r.longitude, durationSeconds: r.durationSeconds,
      subjects: (r.subjects ?? []).map((s) => ({ id: s.id, slug: s.slug, label: s.label })), status: r.status, views: r.views,
      publishedAt: r.publishedAt, createdAt: r.createdAt, updatedAt: r.updatedAt, ...(snippet != null && { snippet }),
    };
  }

  async search(q: RecordQuery, user: AuthUser) {
    const qb = this.records.createQueryBuilder('r').select('r.id');
    if (user.role === 'admin' && q.status) qb.andWhere('r.status = :status', { status: q.status });
    else if (user.role !== 'admin') qb.andWhere(`r.status = 'published'`);
    if (q.type?.length) qb.andWhere('r.type IN (:...types)', { types: q.type });
    if (q.format?.length) qb.andWhere('r.format IN (:...formats)', { formats: q.format });
    if (q.waterBodyId) qb.andWhere('r.waterBodyId = :wb', { wb: q.waterBodyId });
    if (q.county) qb.andWhere('r.county ILIKE :county', { county: q.county });
    if (q.yearFrom) qb.andWhere('r.year >= :yf', { yf: q.yearFrom });
    if (q.yearTo) qb.andWhere('r.year <= :yt', { yt: q.yearTo });
    if (q.subject) qb.andWhere('EXISTS (SELECT 1 FROM record_subjects rs JOIN subjects s ON s.id = rs.subject_id WHERE rs.record_id = r.id AND s.slug = :subj)', { subj: q.subject });

    const ts = q.q ? tsQuery(q.q) : null;
    if (q.q && !ts) return pageOf([], 0, q);
    if (ts) {
      qb.andWhere(`r.search @@ ${ts.sql}`, { tsq: ts.value });
      qb.addSelect(`ts_rank_cd(r.search, ${ts.sql})`, 'rank');
      qb.addSelect(`ts_headline('simple', r.summary || ' ' || coalesce(r.body, '') || ' ' || coalesce((SELECT string_agg(t.text, ' ' ORDER BY t.position) FROM transcript_segments t WHERE t.record_id = r.id), ''), ${ts.sql},
        'StartSel=${MARK_START}, StopSel=${MARK_END}, MaxFragments=2, MaxWords=22, MinWords=8, FragmentDelimiter=" … "')`, 'snippet');
    }
    const sort = q.sort ?? (ts ? 'relevance' : 'added');
    const order: Record<string, [string, 'ASC' | 'DESC', ('NULLS LAST' | 'NULLS FIRST')?]> = {
      relevance: ts ? ['rank', 'DESC'] : ['r.createdAt', 'DESC'], newest: ['r.year', 'DESC', 'NULLS LAST'], oldest: ['r.year', 'ASC', 'NULLS LAST'],
      title: ['r.title', 'ASC'], popular: ['r.views', 'DESC'], added: ['r.createdAt', 'DESC'],
    };
    const [col, dir, nulls] = order[sort];
    qb.orderBy(col, dir, nulls).addOrderBy('r.id', 'ASC');

    const total = await qb.clone().orderBy().getCount();
    const raw: Array<{ r_id: string; snippet?: string }> = await qb.offset((q.page - 1) * q.pageSize).limit(q.pageSize).getRawMany();
    if (!raw.length) return pageOf([], total, q);
    const full = await this.records.find({ where: raw.map((x) => ({ id: x.r_id })) });
    const byId = new Map(full.map((r) => [r.id, r]));
    const items = raw.map((x) => byId.get(x.r_id)).filter((r): r is ArchiveRecord => !!r).map((r, i) => this.summary(r, raw[i].snippet ?? null));
    return { ...pageOf(items, total, q), query: q.q ?? '', markers: ts ? { start: MARK_START, end: MARK_END } : undefined };
  }

  async mapPoints(user: AuthUser) {
    const qb = this.records.createQueryBuilder('r').leftJoinAndSelect('r.waterBody', 'wb')
      .where('r.latitude IS NOT NULL AND r.longitude IS NOT NULL');
    if (user.role !== 'admin') qb.andWhere(`r.status = 'published'`);
    const rows = await qb.orderBy('r.year', 'ASC', 'NULLS LAST').getMany();
    return rows.map((r) => ({ id: r.id, identifier: r.identifier, title: r.title, type: r.type, year: r.year, place: r.place, county: r.county,
      waterBody: r.waterBody?.name ?? null, latitude: r.latitude, longitude: r.longitude, status: r.status }));
  }

  /** Values to offer in the search filters, from published items only. */
  async facets() {
    const q = (sql: string) => this.ds.query(sql);
    const [counties, decades, years] = await Promise.all([
      q(`SELECT county AS value, count(*)::int AS count FROM records WHERE status = 'published' AND deleted_at IS NULL AND county <> '' GROUP BY county ORDER BY county`),
      q(`SELECT (year / 10) * 10 AS value, count(*)::int AS count FROM records WHERE status = 'published' AND deleted_at IS NULL AND year IS NOT NULL GROUP BY 1 ORDER BY 1`),
      q(`SELECT min(year) AS min, max(year) AS max FROM records WHERE status = 'published' AND deleted_at IS NULL`),
    ]);
    return { counties, decades, years: years[0] };
  }

  /** Up to 3 published items sharing a subject or water body, most shared subjects first. */
  private async related(r: ArchiveRecord) {
    const rows: Array<{ id: string }> = await this.ds.query(
      `SELECT r.id FROM records r
       LEFT JOIN record_subjects rs ON rs.record_id = r.id AND rs.subject_id = ANY($2::int[])
       WHERE r.status = 'published' AND r.deleted_at IS NULL AND r.id <> $1
       GROUP BY r.id HAVING count(rs.subject_id) > 0 OR bool_or(r.water_body_id = $3)
       ORDER BY count(rs.subject_id) DESC, r.views DESC LIMIT 3`,
      [r.id, (r.subjects ?? []).map((s) => s.id), r.waterBodyId ?? -1]);
    if (!rows.length) return [];
    const found = await this.records.find({ where: rows.map((x) => ({ id: x.id })) });
    return rows.map((x) => found.find((f) => f.id === x.id)).filter((f): f is ArchiveRecord => !!f).map((f) => this.summary(f));
  }

  private async load(idOrIdentifier: string, withDeleted = false) {
    const where = UUID.test(idOrIdentifier) ? { id: idOrIdentifier } : { identifier: idOrIdentifier.toUpperCase() };
    const r = await this.records.findOne({ where, relations: { transcript: true }, order: { transcript: { position: 'ASC' } }, withDeleted });
    if (!r) throw new NotFoundException('That archive item does not exist.');
    return r;
  }

  citation(r: ArchiveRecord) {
    const who = r.creator || r.narrator || 'Remembering the Waters';
    const when = r.year ? `${r.yearApproximate ? 'c. ' : ''}${r.year}` : 'n.d.';
    const link = `${config.mail.webBaseUrl.replace(/\/$/, '')}/#/record/${r.identifier}`;
    return `${who}. "${r.title}" (${when}). ${TYPE_LABELS[r.type]}, ${r.identifier}. Maritime Safety Heritage Archive, Remembering the Waters. ${link}`;
  }

  async detail(idOrIdentifier: string, user: AuthUser, countView = true) {
    const r = await this.load(idOrIdentifier);
    if (r.status !== 'published' && user.role !== 'admin') throw new NotFoundException('That archive item does not exist.');
    if (countView && r.status === 'published' && user.role !== 'admin') {
      await this.records.increment({ id: r.id }, 'views', 1);
      await this.views.insert({ recordId: r.id, userId: user.id });
      r.views += 1;
    }
    const media = await this.media.forRecord(r.id);
    return {
      ...this.summary(r), body: r.body, creator: r.creator, narrator: r.narrator, interviewer: r.interviewer, photographer: r.photographer,
      language: r.language, rights: r.rights, consent: r.consent,
      transcript: r.transcript.map((t) => ({ startSeconds: t.startSeconds, text: t.text })),
      media: media.map((m) => this.media.describe(m)), citation: this.citation(r),
      related: await this.related(r),
    };
  }

  private async apply(r: ArchiveRecord, dto: RecordUpdateDto) {
    const scalar = ['type', 'format', 'title', 'summary', 'body', 'year', 'yearApproximate', 'county', 'place', 'latitude', 'longitude',
      'creator', 'narrator', 'interviewer', 'photographer', 'language', 'rights', 'consent', 'durationSeconds'] as const;
    for (const k of scalar) if (dto[k] !== undefined) (r as unknown as Record<string, unknown>)[k] = dto[k];
    if (dto.waterBodyId !== undefined) {
      r.waterBody = await this.vocab.waterBody(dto.waterBodyId);
      r.waterBodyId = r.waterBody?.id ?? null;
    }
    if (dto.subjects) r.subjects = await this.vocab.ensureSubjects(dto.subjects);
    if (dto.transcript) r.transcript = dto.transcript.map((t, i) => Object.assign(new TranscriptSegment(), { position: i, startSeconds: t.startSeconds, text: t.text }));
    r.searchText = buildSearchText(r);
  }

  private async save(r: ArchiveRecord, replaceTranscript: boolean) {
    return this.ds.transaction(async (m) => {
      if (replaceTranscript && r.id) await m.delete(TranscriptSegment, { recordId: r.id });
      const saved = await m.save(ArchiveRecord, r);
      // identifier comes from the database; refresh it and keep it in the search text
      const ident = (await m.findOneByOrFail(ArchiveRecord, { id: saved.id })).identifier;
      await m.update(ArchiveRecord, saved.id, { searchText: buildSearchText({ ...r, identifier: ident }) });
      return saved.id;
    });
  }

  async create(dto: RecordInputDto, user: AuthUser, meta: RequestMeta) {
    const r = this.records.create({ status: 'draft', createdById: user.id, updatedById: user.id, subjects: [], transcript: [] });
    await this.apply(r, dto);
    const id = await this.save(r, false);
    const fresh = await this.load(id);
    await this.activity.record({ actor: user, action: 'record.create', entityType: 'record', entityId: id, summary: `Created draft ${fresh.identifier} "${fresh.title}"`, ip: meta.ip });
    return this.detail(id, user, false);
  }

  async update(id: string, dto: RecordUpdateDto, user: AuthUser, meta: RequestMeta) {
    const r = await this.load(id);
    await this.apply(r, dto);
    r.updatedById = user.id;
    if (r.status === 'published') this.assertPublishable(r);
    await this.save(r, !!dto.transcript);
    await this.activity.record({ actor: user, action: 'record.update', entityType: 'record', entityId: r.id, summary: `Edited ${r.identifier} "${r.title}"`, details: { fields: Object.keys(dto) }, ip: meta.ip });
    return this.detail(r.id, user, false);
  }

  private assertPublishable(r: ArchiveRecord) {
    const missing = [!r.summary && 'a summary', !r.rights && 'rights', !r.consent && 'consent'].filter(Boolean);
    if (missing.length) throw new BadRequestException(`Add ${missing.join(', ')} before publishing.`);
  }

  async setStatus(id: string, status: 'published' | 'unpublished', user: AuthUser, meta: RequestMeta) {
    const r = await this.load(id);
    if (status === 'published') this.assertPublishable(r);
    await this.records.update(r.id, { status, updatedById: user.id, ...(status === 'published' && !r.publishedAt && { publishedAt: new Date() }) });
    await this.activity.record({ actor: user, action: status === 'published' ? 'record.publish' : 'record.unpublish', entityType: 'record', entityId: r.id,
      summary: `${status === 'published' ? 'Published' : 'Unpublished'} ${r.identifier} "${r.title}"`, ip: meta.ip });
    return this.detail(r.id, user, false);
  }

  /** Hides the item and takes it offline. It stays in the database and can be restored. */
  async remove(id: string, user: AuthUser, meta: RequestMeta) {
    const r = await this.load(id);
    await this.records.update(r.id, { status: 'unpublished', updatedById: user.id });
    await this.records.softDelete(r.id);
    await this.activity.record({ actor: user, action: 'record.delete', entityType: 'record', entityId: r.id, summary: `Deleted ${r.identifier} "${r.title}"`, ip: meta.ip });
  }

  async restore(id: string, user: AuthUser, meta: RequestMeta) {
    const r = await this.load(id, true);
    await this.records.restore(r.id);
    await this.activity.record({ actor: user, action: 'record.restore', entityType: 'record', entityId: r.id, summary: `Restored ${r.identifier} as unpublished`, ip: meta.ip });
    return this.detail(r.id, user, false);
  }

  async deleted() {
    const rows = await this.records.createQueryBuilder('r').withDeleted().leftJoinAndSelect('r.waterBody', 'wb').leftJoinAndSelect('r.subjects', 's')
      .where('r.deletedAt IS NOT NULL').orderBy('r.deletedAt', 'DESC').getMany();
    return rows.map((r) => ({ ...this.summary(r), deletedAt: r.deletedAt }));
  }
}
