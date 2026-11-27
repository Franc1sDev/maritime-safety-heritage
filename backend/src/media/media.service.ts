import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { execFile } from 'child_process';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { promisify } from 'util';
import { Db, Row } from '../common/db';
import { Jobs } from '../common/jobs.service';
import { MailService } from '../common/mail.service';
import { fail } from '../common/messages';
import { config } from '../config/config';
import { decryptStream, encryptFile, IV_BYTES, readAll, storedRange } from './encryption';
import { detectFile, MediaKind } from './file-type';
import { MovingStorage, Storage, STORAGE } from './storage';
import { scanFile } from './virus-scan';

const run = promisify(execFile);
export type Purpose = 'story' | 'comment' | 'message' | 'avatar' | 'consent' | 'resource' | 'concern' | 'import' | 'export' | 'report' | 'cover';
interface Variant { key: string; mime: string; size: number; width?: number; height?: number; encrypted: boolean; segments?: Array<{ key: string; duration: number }> }

export const sha256File = (path: string) => new Promise<string>((res, rej) => {
  const h = createHash('sha256');
  createReadStream(path).on('data', (c) => h.update(c)).on('end', () => res(h.digest('hex'))).on('error', rej);
});
const safeName = (name: string) => (Buffer.from(name, 'latin1').toString('utf8').replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 200) || 'file');

/** The archive's credit as an image laid over the corner of a photo: white text with a soft shadow, readable on any picture. */
export function watermarkSvg(width: number, height: number, label: string): Buffer {
  // DejaVu Sans Bold is about 0.68 em per character on average; the size shrinks so the whole credit fits narrow photos.
  const em = 0.68;
  let size = Math.max(10, Math.min(34, Math.round(Math.min(width, height) * 0.035)));
  size = Math.max(8, Math.min(size, Math.floor((width * 0.9) / (label.length * em + 1.6))));
  const pad = Math.round(size * 0.8);
  const textWidth = Math.ceil(label.length * size * em);
  const w = Math.min(width, textWidth + pad * 2), h = Math.min(height, size + pad * 2);
  const safe = label.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <text x="${w - pad}" y="${h - pad}" text-anchor="end" font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}" font-weight="600"
        fill="#ffffff" fill-opacity="0.78" stroke="#000000" stroke-opacity="0.5" stroke-width="${Math.max(1, size / 14).toFixed(1)}" paint-order="stroke">${safe}</text>
</svg>`);
}

/**
 * Media pipeline (Sections 2.11, 4.6, 6.3 and 7.2): every upload is type-checked from its contents, virus-scanned,
 * checksummed and stored encrypted. The original is kept untouched for preservation and is never served to the public;
 * what people see are processed copies with hidden location and device data removed.
 */
@Injectable()
export class MediaService implements OnModuleInit {
  private readonly log = new Logger('Media');
  private ffmpeg: boolean | null = null;
  constructor(@Inject(STORAGE) readonly storage: Storage, private readonly db: Db, private readonly jobs: Jobs, private readonly mail: MailService) {}

  onModuleInit() {
    this.jobs.handle('media.process', async ({ id }) => { await this.process(id); });
    this.jobs.every('media.integrity', 6 * 3600_000, () => this.checkIntegrity());
    this.jobs.every('media.storage_alert', 12 * 3600_000, () => this.storageAlert());
    if (this.storage instanceof MovingStorage) {
      void this.moveOldFiles().catch((e) => this.log.warn(`Moving files: ${e.message}`));
      this.jobs.every('media.move', 10 * 60_000, () => this.moveOldFiles());
    }
  }

  private async hasFfmpeg() {
    if (this.ffmpeg === null) this.ffmpeg = await run('ffmpeg', ['-version']).then(() => true, () => false);
    return this.ffmpeg;
  }

  private async put(localPath: string, key: string, mime: string): Promise<{ key: string; encrypted: boolean }> {
    if (!config.media.encryptAtRest) { await this.storage.putFile(key, localPath, mime); return { key, encrypted: false }; }
    const enc = `${localPath}.enc`;
    try { await encryptFile(localPath, enc); await this.storage.putFile(`${key}.enc`, enc, 'application/octet-stream'); }
    finally { await fs.rm(enc, { force: true }).catch(() => undefined); }
    return { key: `${key}.enc`, encrypted: true };
  }

  /** Checks the file's real type and size, scans it, stores it with a SHA-256 checksum, and always removes the temporary upload. */
  async ingest(file: Express.Multer.File, t: { ownerId: string | null; purpose: Purpose; altText?: string }): Promise<Row> {
    try {
      const name = safeName(file.originalname);
      const type = await detectFile(file.path, name);
      if (!type) return fail(400, 'file_unsupported');
      const kind: MediaKind = type.format;
      if (['avatar', 'concern', 'cover'].includes(t.purpose) && kind !== 'image') return fail(400, 'file_unsupported');
      const maxMb = { video: config.limits.videoMb, audio: config.limits.audioMb, image: config.limits.imageMb, document: config.limits.documentMb }[kind];
      if (file.size > maxMb * 1024 * 1024) return fail(413, 'file_too_large', { kind: kind === 'video' ? 'a video' : kind === 'audio' ? 'an audio file' : kind === 'image' ? 'an image' : 'a document', max: maxMb });
      const scan = await scanFile(file.path);
      if (scan.clean === false) { this.log.warn(`Refused "${name}": ${scan.signature}`); return fail(400, 'file_blocked'); }
      if (scan.clean === null && config.clamav.required) { this.log.error(`Virus scanner unavailable: ${scan.error}`); return fail(503, 'general_error'); }
      let duration: number | null = null;
      if ((kind === 'video' || kind === 'audio') && (await this.hasFfmpeg())) {
        duration = await this.probeDuration(file.path);
        if (kind === 'video' && duration && duration > config.limits.videoMinutes * 60 + 5) return fail(400, 'video_too_long', { minutes: config.limits.videoMinutes });
      }
      const sha256 = await sha256File(file.path);
      const now = new Date();
      const base = `${t.purpose}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}`;
      const stored = await this.put(file.path, `${base}/original.${type.ext}`, type.mime);
      const needsWork = kind !== 'document';
      const row = await this.db.one(
        `INSERT INTO media_files (owner_id, purpose, kind, storage_key, original_name, mime_type, size_bytes, sha256, encrypted, duration_seconds, alt_text, scan_result, processing)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [t.ownerId, t.purpose, kind, stored.key, name, type.mime, file.size, sha256, stored.encrypted, duration ? Math.round(duration) : null, (t.altText ?? '').slice(0, 500),
          scan.clean === true ? 'clean' : 'not_scanned', needsWork ? 'queued' : 'done']);
      // Small images are processed at once so avatars and photos show immediately; heavier work goes to the queue.
      if (kind === 'image') await this.process(row!.id).catch((e) => this.log.warn(`Image processing failed: ${e.message}`));
      else if (needsWork) await this.jobs.add('media.process', { id: row!.id });
      return (await this.db.one(`SELECT * FROM media_files WHERE id = $1`, [row!.id]))!;
    } finally {
      await fs.rm(file.path, { force: true }).catch(() => undefined);
    }
  }

  /** Stores a file the server made itself (ZIP downloads, PDF reports, data exports). */
  async storeGenerated(localPath: string, t: { ownerId: string | null; purpose: Purpose; name: string; mime: string; kind?: MediaKind }): Promise<Row> {
    const stat = await fs.stat(localPath);
    const sha256 = await sha256File(localPath);
    const stored = await this.put(localPath, `${t.purpose}/${new Date().getUTCFullYear()}/${randomUUID()}/${safeName(t.name)}`, t.mime);
    await fs.rm(localPath, { force: true }).catch(() => undefined);
    return (await this.db.one(
      `INSERT INTO media_files (owner_id, purpose, kind, storage_key, original_name, mime_type, size_bytes, sha256, encrypted, scan_result) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'generated') RETURNING *`,
      [t.ownerId, t.purpose, t.kind ?? 'document', stored.key, safeName(t.name), t.mime, stat.size, sha256, stored.encrypted]))!;
  }

  private async probeDuration(path: string): Promise<number | null> {
    try {
      const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path], { timeout: 30_000 });
      const d = parseFloat(stdout.trim());
      return Number.isFinite(d) ? d : null;
    } catch { return null; }
  }

  private async fetchToTemp(m: Row): Promise<string> {
    const dir = await fs.mkdtemp(join(tmpdir(), 'msh-media-'));
    const path = join(dir, 'in');
    const { stream } = await this.openKey(m.storageKey, m.encrypted);
    await fs.writeFile(path, stream);
    return path;
  }

  /** Makes the copies people actually see: resized images, web video (HLS) and audio, all without hidden location data. */
  async process(id: string): Promise<void> {
    const m = await this.db.one(`UPDATE media_files SET processing = 'working' WHERE id = $1 AND processing IN ('queued','failed','working') RETURNING *`, [id]);
    if (!m) return;
    const src = await this.fetchToTemp(m);
    const dir = join(src, '..');
    const base = m.storageKey.replace(/\/original\.[^/]+$/, '');
    const variants: Record<string, Variant> = {};
    const extra: Record<string, unknown> = {};
    try {
      if (m.kind === 'image') {
        const sharp = (await import('sharp')).default;
        const meta = await sharp(src).metadata();
        extra.width = meta.width ?? null; extra.height = meta.height ?? null;
        const sizes = m.purpose === 'avatar' ? { thumb: 160, medium: 480 } : { thumb: 320, medium: 960, full: 2400 };
        for (const [name, width] of Object.entries(sizes)) {
          const out = join(dir, `${name}.webp`);
          // rotate() applies the camera orientation; sharp then drops all EXIF, GPS and device metadata by default.
          const resized = sharp(src, { limitInputPixels: 80_000_000 }).rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true });
          // The larger copies carry a small credit in the corner, so a copied photo still names the archive.
          const mark = config.media.watermark && m.purpose !== 'avatar' && name !== 'thumb';
          const info = mark
            ? await (async () => {
                const { data, info: size } = await resized.toBuffer({ resolveWithObject: true });
                return sharp(data).composite([{ input: watermarkSvg(size.width, size.height, config.media.watermarkText), gravity: 'southeast' }]).webp({ quality: name === 'full' ? 88 : 78 }).toFile(out);
              })()
            : await resized.webp({ quality: name === 'full' ? 88 : 78 }).toFile(out);
          const stored = await this.put(out, `${base}/${name}.webp`, 'image/webp');
          variants[name] = { ...stored, mime: 'image/webp', size: info.size, width: info.width, height: info.height };
        }
      } else if (await this.hasFfmpeg()) {
        if (m.kind === 'audio') {
          const out = join(dir, 'web.m4a');
          await run('ffmpeg', ['-y', '-i', src, '-vn', '-map_metadata', '-1', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out], { timeout: 600_000 });
          const stored = await this.put(out, `${base}/web.m4a`, 'audio/mp4');
          variants.web = { ...stored, mime: 'audio/mp4', size: (await fs.stat(out)).size };
        } else if (m.kind === 'video') {
          const poster = join(dir, 'poster.jpg');
          await run('ffmpeg', ['-y', '-ss', '1', '-i', src, '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '4', poster], { timeout: 120_000 })
            .catch(() => run('ffmpeg', ['-y', '-i', src, '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '4', poster], { timeout: 120_000 }));
          const p = await this.put(poster, `${base}/poster.jpg`, 'image/jpeg');
          variants.poster = { ...p, mime: 'image/jpeg', size: (await fs.stat(poster)).size };
          const mp4 = join(dir, 'web.mp4');
          await run('ffmpeg', ['-y', '-i', src, '-map_metadata', '-1', '-vf', "scale='min(1280,iw)':-2", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', mp4], { timeout: 1_800_000 });
          const w = await this.put(mp4, `${base}/web.mp4`, 'video/mp4');
          variants.web = { ...w, mime: 'video/mp4', size: (await fs.stat(mp4)).size };
          // Adaptive streaming: the player picks the rendition that suits the connection.
          for (const [name, height, rate] of [['hls360', 360, '500k'], ['hls720', 720, '1800k']] as const) {
            const hdir = join(dir, name);
            await fs.mkdir(hdir);
            await run('ffmpeg', ['-y', '-i', mp4, '-vf', `scale=-2:'min(${height},ih)'`, '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', rate, '-maxrate', rate, '-bufsize', '2M', '-c:a', 'aac', '-b:a', '64k',
              '-hls_time', '6', '-hls_playlist_type', 'vod', '-hls_segment_filename', join(hdir, 's%03d.ts'), join(hdir, 'index.m3u8')], { timeout: 1_800_000 });
            const playlist = await fs.readFile(join(hdir, 'index.m3u8'), 'utf8');
            const durations = [...playlist.matchAll(/#EXTINF:([\d.]+)/g)].map((x) => Number(x[1]));
            const files = (await fs.readdir(hdir)).filter((f) => f.endsWith('.ts')).sort();
            const segments: Array<{ key: string; duration: number }> = [];
            for (let i = 0; i < files.length; i++) {
              const s = await this.put(join(hdir, files[i]), `${base}/${name}/${files[i]}`, 'video/mp2t');
              segments.push({ key: s.key, duration: durations[i] ?? 6 });
            }
            variants[name] = { key: '', mime: 'application/vnd.apple.mpegurl', size: 0, height, encrypted: config.media.encryptAtRest, segments } as Variant;
          }
        }
      }
      await this.db.q(`UPDATE media_files SET variants = $2, processing = 'done', width = coalesce($3, width), height = coalesce($4, height) WHERE id = $1`, [id, JSON.stringify(variants), extra.width ?? null, extra.height ?? null]);
    } catch (e) {
      await this.db.q(`UPDATE media_files SET processing = 'failed' WHERE id = $1`, [id]);
      throw e;
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** Regular integrity check: each stored original is compared with its checksum to detect damage. */
  async checkIntegrity(batch = 25) {
    const rows = await this.db.q(`SELECT * FROM media_files WHERE checksum_checked_at IS NULL OR checksum_checked_at < now() - interval '30 days' ORDER BY checksum_checked_at NULLS FIRST LIMIT $1`, [batch]);
    const damaged: string[] = [];
    for (const m of rows) {
      try {
        const h = createHash('sha256');
        for await (const c of (await this.openKey(m.storageKey, m.encrypted)).stream) h.update(c as Buffer);
        if (h.digest('hex') !== m.sha256) damaged.push(m.id);
      } catch { damaged.push(m.id); }
      await this.db.q(`UPDATE media_files SET checksum_checked_at = now() WHERE id = $1`, [m.id]);
    }
    if (damaged.length) this.log.error(`Integrity check: ${damaged.length} file(s) are damaged or missing: ${damaged.join(', ')}`);
    return { checked: rows.length, damaged };
  }

  /** A readable stream of a stored object (or of a byte range), decrypting if needed. */
  async openKey(key: string, encrypted: boolean, range?: { start: number; end: number }): Promise<{ stream: Readable; size: number }> {
    if (!encrypted) return this.storage.read(key, range);
    const size = (await this.storage.size(key)) - IV_BYTES;
    if (size <= 0) return { stream: Readable.from([]), size: 0 };
    const iv = await readAll((await this.storage.read(key, { start: 0, end: IV_BYTES - 1 })).stream);
    const r = storedRange(range?.start ?? 0, range?.end ?? size - 1);
    const { stream } = await this.storage.read(key, { start: r.start, end: r.end });
    return { stream: stream.pipe(decryptStream(iv, r.block, r.skip)), size };
  }
  async sizeOfKey(key: string, encrypted: boolean) { return encrypted ? (await this.storage.size(key)) - IV_BYTES : this.storage.size(key); }

  // ----- signed links: files are never public -----
  private sign(payload: string) { return createHmac('sha256', config.media.signingSecret).update(payload).digest('base64url'); }
  verify(payload: string, exp: number, sig: string): boolean {
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
    const a = Buffer.from(this.sign(`${payload}.${exp}`)), b = Buffer.from(sig ?? '');
    return a.length === b.length && timingSafeEqual(a, b);
  }
  link(id: string, variant: string): string {
    const exp = Math.floor(Date.now() / 1000) + config.media.linkTtlSeconds;
    return `${config.publicApiUrl}/api/v1/media/file/${id}/${variant}?exp=${exp}&sig=${this.sign(`${id}.${variant}.${exp}`)}`;
  }

  /** What the website and apps need to show a file, with signed links that expire. Only call for someone allowed to see the item. */
  view(m: Row, opts: { original?: boolean } = {}) {
    const v = (m.variants ?? {}) as Record<string, Variant>;
    const urls: Record<string, string> = {};
    for (const name of Object.keys(v)) urls[name] = this.link(m.id, name.startsWith('hls') ? `${name}.m3u8` : name);
    if (v.hls360 || v.hls720) urls.hls = this.link(m.id, 'master.m3u8');
    // Documents are shown as stored. Other originals are served only where no processed copy exists (and never for images, which may hold location data).
    if (m.kind === 'document' || opts.original || (m.kind !== 'image' && !v.web)) urls.original = this.link(m.id, 'original');
    return {
      id: m.id, kind: m.kind, name: m.originalName, mimeType: m.mimeType, sizeBytes: Number(m.sizeBytes), width: m.width, height: m.height, durationSeconds: m.durationSeconds,
      altText: m.altText, transcript: m.transcript || null, segments: m.transcriptSegments ?? null, processing: m.processing, position: m.position, urls,
      sizes: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.size])),
    };
  }

  async byId(id: string) { return this.db.one(`SELECT * FROM media_files WHERE id = $1`, [id]); }

  async remove(id: string) {
    const m = await this.byId(id);
    if (!m) return;
    await this.db.q(`DELETE FROM media_files WHERE id = $1`, [id]);
    await this.removeObjects(m);
  }
  async removeObjects(m: Row) {
    const keys = [m.storageKey, ...Object.values((m.variants ?? {}) as Record<string, Variant>).flatMap((v) => [v.key, ...(v.segments ?? []).map((s) => s.key)])].filter(Boolean);
    for (const k of keys) await this.storage.remove(k).catch((e) => this.log.error(`Could not delete ${k}: ${e.message}`));
  }
  /** Storage growth is watched, with an email alert before the limit is reached (Section 7.2). */
  /** Moves files still kept in the database to the object storage, a batch at a time, until none are left. */
  async moveOldFiles() {
    if (!(this.storage instanceof MovingStorage)) return { moved: 0, failed: 0, left: 0 };
    const rows = await this.db.q<{ storageKey: string }>(`SELECT storage_key FROM media_objects ORDER BY storage_key LIMIT 200`);
    if (!rows.length) return { moved: 0, failed: 0, left: 0 };
    const r = await this.storage.moveAll(rows.map((x) => x.storageKey), tmpdir());
    const left = Number((await this.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM media_objects`))?.n ?? 0);
    this.log.log(`Moved ${r.moved} file(s) from the database to object storage; ${r.failed} failed; ${left} left`);
    return { ...r, left };
  }

  async storageAlert() {
    if (!config.alerts.storageGb || !config.alerts.emails.length) return;
    const u = await this.usage();
    const gb = Number(u?.bytes ?? 0) / 1024 ** 3;
    if (gb < config.alerts.storageGb * 0.8) return;
    for (const to of config.alerts.emails) await this.mail.send(to, 'Archive storage is filling up', `The archive now stores ${gb.toFixed(1)} GB in ${u?.files} files, which is ${Math.round((gb / config.alerts.storageGb) * 100)}% of the ${config.alerts.storageGb} GB alert level.\n`);
  }
  /** Total stored bytes, for the storage-growth alert. */
  async usage() { return this.db.one(`SELECT coalesce(sum(size_bytes),0)::bigint AS bytes, count(*)::int AS files FROM media_files`); }
}
