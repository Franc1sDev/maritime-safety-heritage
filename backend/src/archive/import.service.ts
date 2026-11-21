import { Injectable, OnModuleInit } from '@nestjs/common';
import { promises as fs } from 'fs';
import { Ai, AiUnavailable } from '../ai/ai.service';
import { Approvals } from '../approvals/approvals.service';
import { Audit } from '../common/audit.service';
import { Db, Row } from '../common/db';
import { AuthUser, RequestMeta } from '../common/decorators';
import { Jobs } from '../common/jobs.service';
import { fail, text } from '../common/messages';
import { Notify } from '../common/notify.service';
import { parseCsv, parseXlsx, toDate, yes } from '../common/spreadsheet';
import { Track } from '../common/track.service';
import { CATEGORIES, RIGHTS, StoriesService } from '../stories/stories.service';

/** The columns of the metadata spreadsheet template (Section 11.4). The first row of the spreadsheet holds these names. */
export const IMPORT_COLUMNS: Array<[string, string]> = [
  ['title', 'Title of the item'], ['type', 'testimony, record or community'], ['text', 'The story text, summary or description'], ['date', 'When it happened: YYYY-MM-DD, or just the year'],
  ['date_approximate', 'yes if the date is approximate'], ['place', 'Place name from the places list'], ['incident', 'Incident name or code (optional)'], ['language', 'Language code: en, sw, luo, …'],
  ['category', 'One of the archive categories'], ['vessel', 'Vessel name (optional)'], ['tags', 'Tags separated by ;'], ['files', 'File names separated by ; (upload the files first)'],
  ['storyteller', 'Who told or created it'], ['anonymous', 'yes to publish without the name'], ['consent_type', 'e.g. Signed form, Recorded verbal consent'], ['consent_date', 'YYYY-MM-DD'],
  ['consent_form', 'File name of the consent form (optional)'], ['no_downloads', 'yes if the storyteller does not allow downloads'], ['validated', 'yes when the storyteller has confirmed how it is represented'],
  ['rights', 'e.g. All rights reserved, CC BY-NC 4.0'], ['source_institution', 'Records: holding institution or publication'], ['source_reference', 'Records: archive reference'],
  ['source_original_date', 'Records: original date'], ['source_creator', 'Records: creator'], ['source_rights', 'Records: rights statement'], ['source_obtained', 'Records: how it was obtained'],
];

/** Bulk import of the project's collected materials from files plus a metadata spreadsheet: validation, preview, error report, and submission of the batch for approval. */
@Injectable()
export class ImportService implements OnModuleInit {
  constructor(private readonly db: Db, private readonly ai: Ai, private readonly approvals: Approvals, private readonly audit: Audit, private readonly jobs: Jobs,
    private readonly notify: Notify, private readonly track: Track, private readonly stories: StoriesService) {}

  onModuleInit() {
    this.jobs.handle('import.run', async ({ batchId }, ctx) => { await this.run(batchId, ctx.progress); });
    this.approvals.on('import_batch', {
      approved: async (req) => { await this.db.q(`UPDATE import_batches SET status = 'approved' WHERE id = $1`, [req.targetId]); await this.jobs.add('import.run', { batchId: req.targetId }); },
      rejected: async (req) => { await this.db.q(`UPDATE import_batches SET status = 'rejected' WHERE id = $1`, [req.targetId]); },
    });
  }

  template(): string {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return '﻿' + [IMPORT_COLUMNS.map(([k]) => k).join(','), IMPORT_COLUMNS.map(([, hint]) => esc(hint)).join(','),
      ['Night crossings on the Likoni channel', 'testimony', 'We used to count heads at the ramp…', '1987', 'yes', 'Likoni', 'Mtongwe ferry disaster', 'sw', 'Ferry and passenger transport', '', 'ferry;crew', 'likoni-interview.mp3', 'Retired deckhand', 'yes', 'Signed form', '2026-03-14', 'likoni-consent.pdf', 'no', 'yes', 'CC BY-NC 4.0', '', '', '', '', '', ''].map(esc).join(',')].join('\r\n') + '\r\n';
  }

  /** Checks every row (consent, validation, place, incident, files, AI review) and stores the result as a batch. Nothing is created yet. */
  async check(admin: AuthUser, file: Express.Multer.File, meta: RequestMeta) {
    let table: string[][];
    try {
      const buf = await fs.readFile(file.path);
      table = /\.xlsx$/i.test(file.originalname) || (buf[0] === 0x50 && buf[1] === 0x4b) ? parseXlsx(buf) : parseCsv(buf.toString('utf8'));
    } catch { return fail(400, 'file_unsupported'); } finally { await fs.rm(file.path, { force: true }).catch(() => undefined); }
    if (table.length < 2) return fail(400, 'invalid_input');
    const header = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const known = IMPORT_COLUMNS.map(([k]) => k);
    if (!header.includes('title') && !header.includes('text')) return fail(400, 'invalid_input', {}, { expectedColumns: known });
    let body = table.slice(1);
    // The template's second row explains each column; skip it if it was left in.
    if (body[0]?.[header.indexOf('type')]?.includes('testimony, record')) body = body.slice(1);
    if (body.length > 2000) return fail(400, 'invalid_input', {}, { hint: 'At most 2,000 rows per batch.' });
    const rows = [];
    for (let n = 0; n < body.length; n++) rows.push(await this.checkRow(Object.fromEntries(header.map((h, i) => [h, (body[n][i] ?? '').trim()])), n + 2, admin));
    const ready = rows.filter((r) => r.ready).length;
    const b = (await this.db.one(`INSERT INTO import_batches (proposer_id, spreadsheet_name, rows, ready, need_attention) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [admin.id, file.originalname.slice(0, 200), JSON.stringify(rows), ready, rows.length - ready]))!;
    await this.audit.record({ actor: admin, action: 'import.check', entityType: 'import', entityId: b.id, summary: `${admin.name} checked an import of ${rows.length} rows (${ready} ready)`, ip: meta.ip });
    return { ...(await this.batch(b.id)), message: text('import_checked', meta.lang, { ready, total: rows.length, attention: rows.length - ready }) };
  }

  private async checkRow(r: Record<string, string>, line: number, admin: AuthUser) {
    const problems: string[] = []; const notes: string[] = [];
    const type = (r.type || 'testimony').toLowerCase();
    if (!['testimony', 'record', 'community'].includes(type)) problems.push(`Type “${r.type}” is not testimony, record or community.`);
    const date = toDate(r.date ?? '');
    if (r.date && !date) problems.push(`Date “${r.date}” is not a date. Use YYYY-MM-DD or a year.`);
    let place: Row | null = null;
    if (r.place) {
      place = await this.db.one(`SELECT id, name FROM places WHERE lower(name) = lower($1) OR lower($1) = ANY(SELECT lower(x) FROM unnest(alt_names) x) ORDER BY id LIMIT 1`, [r.place]);
      if (!place) problems.push(`Place “${r.place}” is not in the places list. Add it under Incidents › Places, or correct the name.`);
    } else problems.push('No place given.');
    let incident: Row | null = null;
    if (r.incident) {
      incident = await this.db.one(`SELECT id, title FROM incidents WHERE status = 'published' AND (upper(code) = upper($1) OR lower(title) = lower($1) OR title ILIKE '%' || $1 || '%') ORDER BY (lower(title) = lower($1)) DESC LIMIT 1`, [r.incident]);
      if (!incident) problems.push(`Incident “${r.incident}” was not found. Create the incident record first, or leave the cell empty.`);
    }
    if (r.category && !CATEGORIES.includes(r.category)) problems.push(`Category “${r.category}” is not one of the archive categories.`);
    if (r.rights && !RIGHTS.includes(r.rights)) notes.push(`Rights “${r.rights}” is not a standard licence; “All rights reserved” will be used.`);
    const names = (r.files ?? '').split(';').map((x) => x.trim()).filter(Boolean);
    const mediaIds: string[] = [];
    for (const name of [...names, ...(r.consent_form ? [r.consent_form] : [])]) {
      const m = await this.db.one(`SELECT id FROM media_files WHERE owner_id = $1 AND purpose IN ('import','consent') AND story_id IS NULL AND lower(original_name) = lower($2) ORDER BY created_at DESC LIMIT 1`, [admin.id, name]);
      if (!m) problems.push(`File “${name}” has not been uploaded yet.`); else if (name !== r.consent_form || names.includes(name)) mediaIds.push(m.id);
    }
    const consentForm = r.consent_form ? (await this.db.one(`SELECT id FROM media_files WHERE owner_id = $1 AND lower(original_name) = lower($2) ORDER BY created_at DESC LIMIT 1`, [admin.id, r.consent_form]))?.id ?? null : null;
    if (!r.title && !r.text && !names.length) problems.push('The row has no title, text or files.');
    if (type === 'testimony') {
      if (!r.storyteller) problems.push('A testimony needs the storyteller’s name (it stays private if “anonymous” is yes).');
      if (!r.consent_type) problems.push('Consent type is missing.');
      if (!yes(r.validated)) problems.push('Not yet validated with the storyteller.');
    }
    if (type === 'record' && !r.source_institution && !r.source_reference) problems.push('A historical record needs its source (institution or publication) or archive reference.');
    let flag: string | null = null;
    if (!problems.length && (r.text || r.title)) {
      try { const res = await this.ai.review({ kind: 'story', text: [r.title, r.text].filter(Boolean).join('\n\n'), language: r.language || 'en', context: 'Item from the project’s own collection, checked before bulk import.' }); flag = res.flag; if (res.flag === 'RED') problems.push(`AI review flagged this item RED: ${res.summary}`); }
      catch (e) { if (!(e instanceof AiUnavailable)) throw e; notes.push('AI review was not available; the item will be reviewed when it is.'); }
    }
    return { line, data: r, type, date, placeId: place?.id ?? null, incidentId: incident?.id ?? null, mediaIds: [...new Set(mediaIds)], consentFormId: consentForm, flag, problems, notes, ready: problems.length === 0 };
  }

  async batch(id: string) {
    const b = await this.db.one(`SELECT * FROM import_batches WHERE id = $1`, [id]);
    if (!b) return fail(404, 'not_found');
    return { id: b.id, status: b.status, spreadsheet: b.spreadsheetName, ready: b.ready, needAttention: b.needAttention, itemsCreated: b.itemsCreated, createdAt: b.createdAt,
      rows: (b.rows as any[]).map((r) => ({ line: r.line, title: r.data.title, type: r.type, place: r.data.place, incident: r.data.incident, files: r.mediaIds.length, flag: r.flag, ready: r.ready, problems: r.problems, notes: r.notes })) };
  }
  list() { return this.db.q(`SELECT id, status, spreadsheet_name, ready, need_attention, items_created, created_at FROM import_batches ORDER BY created_at DESC LIMIT 50`); }

  /** Submits the ready rows of the batch for approval as one request. Rows that need attention are left out and can be fixed in a later batch. */
  async submit(admin: AuthUser, id: string, justification: string, meta: RequestMeta) {
    const b = await this.db.one(`SELECT * FROM import_batches WHERE id = $1`, [id]);
    if (!b) return fail(404, 'not_found');
    if (b.status !== 'checked' || !b.ready) return fail(409, 'already_exists');
    await this.db.q(`UPDATE import_batches SET status = 'submitted' WHERE id = $1`, [id]);
    await this.approvals.propose({ type: 'import_batch', targetId: id, title: `Bulk import: ${b.ready} items from ${b.spreadsheetName}`, proposer: admin, justification: justification || `Import of ${b.ready} catalogued items with consent and rights recorded.`, payload: { ready: b.ready } }, meta);
    return { ...(await this.batch(id)), message: text('import_submitted', meta.lang) };
  }

  private async run(batchId: string, progress: (n: number) => Promise<void>) {
    const b = await this.db.one(`SELECT * FROM import_batches WHERE id = $1 AND status = 'approved'`, [batchId]);
    if (!b) return;
    const rows = (b.rows as any[]).filter((r) => r.ready && !r.storyId);
    let created = b.itemsCreated;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; const d = r.data;
      const anonymous = yes(d.anonymous);
      const s = (await this.db.one(
        `INSERT INTO stories (type, author_id, posted_as, told_by, title, body, language, incident_id, place_id, place_name, county, water_body, latitude, longitude, event_date, date_approximate, category, vessel, tags, rights, allow_download,
                              consent_confirmed, validated, status, ai_flag, import_batch_id, published_at)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, p.id, coalesce(p.name, ''), coalesce(p.county, ''), coalesce(p.water_body, ''), p.latitude, p.longitude, $10, $11, $12, $13, $14, $15, $16, true, $17, 'published', $18, $19, now()
           FROM (SELECT 1) one LEFT JOIN places p ON p.id = $9 RETURNING id, code`,
        [r.type, b.proposerId, anonymous ? 'anonymous' : r.type === 'testimony' ? 'told_by' : 'company', anonymous ? '' : d.storyteller ?? '', d.title ?? '', d.text ?? '', d.language || 'en', r.incidentId, r.placeId, r.date, yes(d.date_approximate),
          d.category ?? '', d.vessel ?? '', (d.tags ?? '').split(';').map((t: string) => t.trim().toLowerCase()).filter(Boolean).slice(0, 10), RIGHTS.includes(d.rights) ? d.rights : 'All rights reserved', !yes(d.no_downloads), yes(d.validated), r.flag, batchId]))!;
      for (let k = 0; k < r.mediaIds.length; k++) await this.db.q(`UPDATE media_files SET story_id = $1, position = $2, purpose = 'story' WHERE id = $3 AND story_id IS NULL`, [s.id, k, r.mediaIds[k]]);
      if (r.type === 'testimony' || d.consent_type) {
        await this.db.q(`INSERT INTO consent_records (story_id, storyteller, consent_type, consent_date, form_media_id, restrictions, validated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [s.id, d.storyteller ?? '', d.consent_type ?? '', toDate(d.consent_date ?? ''), r.consentFormId, JSON.stringify({ anonymous, noDownloads: yes(d.no_downloads) }), yes(d.validated) ? new Date() : null]);
      }
      if (r.type === 'record') await this.db.q(`INSERT INTO record_sources (story_id, institution, reference, original_date, creator, rights_statement, obtained) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [s.id, d.source_institution ?? '', d.source_reference ?? '', d.source_original_date ?? '', d.source_creator ?? d.storyteller ?? '', d.source_rights ?? '', d.source_obtained ?? '']);
      r.storyId = s.id; r.code = s.code; created++;
      await this.track.event('story.published', { actor: '', actorType: 'admin' }, { storyId: s.id, metrics: [`stories.${r.type}`, 'stories.imported', ...((d.language || 'en') !== 'en' ? ['stories.non_english'] : [])] });
      if (i % 10 === 9) { await this.db.q(`UPDATE import_batches SET rows = $2, items_created = $3 WHERE id = $1`, [batchId, JSON.stringify(b.rows), created]); await progress(((i + 1) / rows.length) * 100); }
    }
    await this.db.q(`UPDATE import_batches SET rows = $2, items_created = $3 WHERE id = $1`, [batchId, JSON.stringify(b.rows), created]);
    await this.stories.recalculateTrending();
    if (b.proposerId) await this.notify.send(b.proposerId, { group: 'moderation', kind: 'import.done', title: 'Bulk import finished', body: `${created} items were published from ${b.spreadsheetName}.`, link: `/admin/import?open=${batchId}` });
  }
}
