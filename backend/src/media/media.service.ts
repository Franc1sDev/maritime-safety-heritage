import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import { Readable } from 'stream';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators';
import { config } from '../config/config';
import { ArchiveRecord, MediaFile, Submission, isStaff } from '../database/entities';
import { decryptStream, encryptFile, IV_BYTES, readAll, storedRange } from './encryption';
import { detectFile } from './file-type';
import { Storage, STORAGE } from './storage';
import { scanFile } from './virus-scan';

export interface IngestTarget { recordId?: string; submissionId?: string; role?: MediaFile['role']; uploadedById: string; prefix: 'records' | 'submissions' }

const sha256File = (path: string) => new Promise<string>((res, rej) => {
  const h = createHash('sha256');
  createReadStream(path).on('data', (c) => h.update(c)).on('end', () => res(h.digest('hex'))).on('error', rej);
});

const safeName = (name: string) => (Buffer.from(name, 'latin1').toString('utf8').replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 200) || 'file');

@Injectable()
export class MediaService {
  private readonly log = new Logger('Media');
  constructor(
    @Inject(STORAGE) readonly storage: Storage,
    @InjectRepository(MediaFile) private readonly media: Repository<MediaFile>,
    @InjectRepository(ArchiveRecord) private readonly records: Repository<ArchiveRecord>,
    @InjectRepository(Submission) private readonly submissions: Repository<Submission>,
  ) {}

  /** Checks the file's real type, stores it with a SHA-256 checksum, and always removes the temporary upload. */
  async ingest(file: Express.Multer.File, t: IngestTarget): Promise<MediaFile> {
    let encPath = '';
    try {
      const type = await detectFile(file.path);
      if (!type) throw new BadRequestException(`"${safeName(file.originalname)}" is not a supported file. Use audio, video, images, PDF or plain text.`);
      await this.scan(file);
      const sha256 = await sha256File(file.path);
      const now = new Date();
      const key = `${t.prefix}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${type.ext}${config.media.encryptAtRest ? '.enc' : ''}`;
      if (config.media.encryptAtRest) {
        encPath = `${file.path}.enc`;
        await encryptFile(file.path, encPath);
        await this.storage.putFile(key, encPath, 'application/octet-stream');
      } else {
        await this.storage.putFile(key, file.path, type.mime);
      }
      return await this.media.save(this.media.create({
        recordId: t.recordId ?? null, submissionId: t.submissionId ?? null, role: t.role ?? 'original', storageKey: key, encrypted: config.media.encryptAtRest,
        originalName: safeName(file.originalname), mimeType: type.mime, sizeBytes: file.size, sha256, uploadedById: t.uploadedById,
      }));
    } finally {
      await fs.rm(file.path, { force: true }).catch(() => undefined);
      if (encPath) await fs.rm(encPath, { force: true }).catch(() => undefined);
    }
  }

  /** Virus check. Infected files are refused; if the scanner is required but unavailable, uploads are refused too. */
  private async scan(file: Express.Multer.File) {
    const r = await scanFile(file.path);
    if (r.clean === false) {
      this.log.warn(`Refused "${safeName(file.originalname)}": ${r.signature}`);
      throw new BadRequestException(`"${safeName(file.originalname)}" was refused because the virus scanner found a threat (${r.signature}).`);
    }
    if (r.clean === null && config.clamav.required) {
      this.log.error(`Virus scanner unavailable: ${r.error}`);
      throw new ServiceUnavailableException('Uploads are paused because the virus scanner is not available. Try again later or tell the archive team.');
    }
  }

  /** Size of the original file and a readable stream of it (or of a byte range), decrypting if needed. */
  async open(m: MediaFile, range?: { start: number; end: number }) {
    if (!m.encrypted) return this.storage.read(m.storageKey, range);
    const size = (await this.storage.size(m.storageKey)) - IV_BYTES;
    if (size <= 0) return { stream: Readable.from([]), size: 0 };
    const iv = await readAll((await this.storage.read(m.storageKey, { start: 0, end: IV_BYTES - 1 })).stream);
    const r = storedRange(range?.start ?? 0, range?.end ?? size - 1);
    const { stream } = await this.storage.read(m.storageKey, { start: r.start, end: r.end });
    return { stream: stream.pipe(decryptStream(iv, r.block, r.skip)), size };
  }

  async sizeOf(m: MediaFile) {
    return m.encrypted ? (await this.storage.size(m.storageKey)) - IV_BYTES : this.storage.size(m.storageKey);
  }

  async discard(files: Express.Multer.File[] = []) {
    await Promise.all(files.map((f) => fs.rm(f.path, { force: true }).catch(() => undefined)));
  }

  private sign(id: string, exp: number) {
    return createHmac('sha256', config.media.signingSecret).update(`${id}.${exp}`).digest('base64url');
  }

  verifySignature(id: string, exp: number, sig: string): boolean {
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
    const a = Buffer.from(this.sign(id, exp)), b = Buffer.from(sig ?? '');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** A link that works without a sign-in header (so audio, video and image tags can use it) and expires after an hour. */
  describe(m: MediaFile) {
    const exp = Math.floor(Date.now() / 1000) + config.media.linkTtlSeconds;
    const url = `${config.publicApiUrl}/api/v1/media/file/${m.id}?exp=${exp}&sig=${this.sign(m.id, exp)}`;
    return { id: m.id, role: m.role, originalName: m.originalName, mimeType: m.mimeType, sizeBytes: m.sizeBytes, sha256: m.sha256, createdAt: m.createdAt, url, expiresAt: new Date(exp * 1000) };
  }

  async getAccessible(id: string, user: AuthUser): Promise<MediaFile> {
    const m = await this.media.findOneBy({ id });
    if (!m) throw new NotFoundException('That file does not exist.');
    if (isStaff(user.role)) return m;
    if (m.recordId) {
      const r = await this.records.findOneBy({ id: m.recordId });
      if (r?.status === 'published') return m;
    }
    if (m.submissionId) {
      const s = await this.submissions.findOneBy({ id: m.submissionId });
      if (s?.submittedById === user.id) return m;
    }
    throw new ForbiddenException('You do not have access to this file.');
  }

  async findById(id: string) { return this.media.findOneBy({ id }); }
  async forRecord(recordId: string) { return this.media.find({ where: { recordId }, order: { createdAt: 'ASC' } }); }
  async forSubmission(submissionId: string) { return this.media.find({ where: { submissionId }, order: { createdAt: 'ASC' } }); }

  async remove(id: string): Promise<MediaFile> {
    const m = await this.media.findOneBy({ id });
    if (!m) throw new NotFoundException('That file does not exist.');
    await this.media.delete(id);
    await this.storage.remove(m.storageKey).catch((e) => this.log.error(`Could not delete ${m.storageKey}: ${e.message}`));
    return m;
  }
}
