import { GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { dirname, resolve, sep } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
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

export const STORAGE = Symbol('STORAGE');
export const createStorage = (): Storage => (config.storage.driver === 's3' ? new S3Storage() : new LocalStorage());
