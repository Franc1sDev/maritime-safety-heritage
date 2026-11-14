import { GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { dirname, resolve, sep } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { DataSource } from 'typeorm';
import { config } from '../config/config';

export interface ReadResult { stream: Readable; size: number }

/** Where media files live. Keys look like "records/2026/11/<uuid>.mp3" and never contain user input. */
export interface Storage {
  putFile(key: string, localPath: string, mimeType: string): Promise<void>;
  read(key: string, range?: { start: number; end: number }): Promise<ReadResult>;
  size(key: string): Promise<number>;
  remove(key: string): Promise<void>;
}

export class LocalStorage implements Storage {
  private readonly root = resolve(config.storage.localDir);
  private path(key: string) {
    const p = resolve(this.root, key);
    if (!p.startsWith(this.root + sep)) throw new Error('Invalid storage key');
    return p;
  }
  async putFile(key: string, localPath: string) {
    const target = this.path(key);
    await fs.mkdir(dirname(target), { recursive: true });
    await pipeline(createReadStream(localPath), createWriteStream(target, { flags: 'wx', mode: 0o640 }));
  }
  async size(key: string) { return (await fs.stat(this.path(key))).size; }
  async read(key: string, range?: { start: number; end: number }) {
    const size = await this.size(key);
    return { stream: createReadStream(this.path(key), range), size };
  }
  async remove(key: string) { await fs.rm(this.path(key), { force: true }); }
}

/** Any S3-compatible service: Cloudflare R2, AWS S3, Backblaze B2, DigitalOcean Spaces, MinIO. */
export class S3Storage implements Storage {
  private readonly s3 = new S3Client({
    region: config.storage.s3.region, endpoint: config.storage.s3.endpoint || undefined, forcePathStyle: !!config.storage.s3.endpoint,
    credentials: { accessKeyId: config.storage.s3.accessKeyId, secretAccessKey: config.storage.s3.secretAccessKey },
    // Backblaze B2, R2 and others don't accept every newer AWS checksum header; only send checksums when required.
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
  });
  private readonly bucket = config.storage.s3.bucket;
  async putFile(key: string, localPath: string, mimeType: string) {
    await new Upload({ client: this.s3, params: { Bucket: this.bucket, Key: key, Body: createReadStream(localPath), ContentType: mimeType } }).done();
  }
  async size(key: string) {
    return Number((await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))).ContentLength ?? 0);
  }
  async read(key: string, range?: { start: number; end: number }) {
    const size = await this.size(key);
    const out = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: range ? `bytes=${range.start}-${range.end}` : undefined }));
    return { stream: out.Body as Readable, size };
  }
  async remove(key: string) { await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })); }
}

/**
 * Files kept inside PostgreSQL in 1 MB chunks. For small hosted setups with no object storage (for example a free
 * Render or Neon plan). Each chunk is written as it is read, so large uploads never sit in memory.
 */
export class DatabaseStorage implements Storage {
  static readonly CHUNK = 1024 * 1024;
  constructor(private readonly ds: DataSource) {}
  async putFile(key: string, localPath: string) {
    await this.ds.transaction(async (m) => {
      await m.query(`INSERT INTO media_objects (storage_key, size_bytes) VALUES ($1, 0)`, [key]);
      let n = 0, size = 0;
      for await (const chunk of createReadStream(localPath, { highWaterMark: DatabaseStorage.CHUNK })) {
        const buf = chunk as Buffer;
        await m.query(`INSERT INTO media_chunks (storage_key, chunk_no, data) VALUES ($1, $2, $3)`, [key, n++, buf]);
        size += buf.length;
      }
      await m.query(`UPDATE media_objects SET size_bytes = $2 WHERE storage_key = $1`, [key, size]);
    });
  }
  async size(key: string) {
    const [row] = await this.ds.query(`SELECT size_bytes FROM media_objects WHERE storage_key = $1`, [key]);
    if (!row) throw new Error('Stored file not found');
    return Number(row.size_bytes);
  }
  async read(key: string, range?: { start: number; end: number }) {
    const size = await this.size(key);
    const start = range?.start ?? 0, end = Math.min(range?.end ?? size - 1, size - 1);
    const C = DatabaseStorage.CHUNK, first = Math.floor(start / C), last = Math.floor(end / C);
    const ds = this.ds;
    async function* chunks() {
      for (let n = first; n <= last; n++) {
        const [row] = await ds.query(`SELECT data FROM media_chunks WHERE storage_key = $1 AND chunk_no = $2`, [key, n]);
        if (!row) return;
        const buf: Buffer = row.data;
        const from = n === first ? start - n * C : 0;
        const to = n === last ? end - n * C + 1 : buf.length;
        yield buf.subarray(from, to);
      }
    }
    return { stream: size === 0 ? Readable.from([]) : Readable.from(chunks()), size };
  }
  async remove(key: string) { await this.ds.query(`DELETE FROM media_objects WHERE storage_key = $1`, [key]); }
}

export const STORAGE = Symbol('STORAGE');
export const createStorage = (ds: DataSource): Storage =>
  config.storage.driver === 's3' ? new S3Storage() : config.storage.driver === 'database' ? new DatabaseStorage(ds) : new LocalStorage();
