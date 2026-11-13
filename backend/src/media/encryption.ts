import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { config } from '../config/config';

/**
 * Media files are encrypted at rest with AES-256-CTR. The stored object is a 16-byte random IV
 * followed by the ciphertext. Counter mode lets the server decrypt any byte range, so audio and
 * video can still seek. Integrity is checked separately with the SHA-256 checksum of the original.
 */
export const IV_BYTES = 16;
const BLOCK = 16;
const key = () => createHash('sha256').update(config.media.encryptionKey).digest();

/** The IV for block n: the stored IV treated as a 128-bit big-endian counter, plus n. */
export function ivAt(iv: Buffer, block: number): Buffer {
  const out = Buffer.from(iv);
  let carry = BigInt(block);
  for (let i = 15; i >= 0 && carry > 0n; i--) {
    const sum = BigInt(out[i]) + (carry & 0xffn);
    out[i] = Number(sum & 0xffn);
    carry = (carry >> 8n) + (sum >> 8n);
  }
  return out;
}

/** Writes an encrypted copy of a file. */
export async function encryptFile(src: string, dest: string): Promise<void> {
  const iv = randomBytes(IV_BYTES);
  const out = createWriteStream(dest, { mode: 0o600 });
  await new Promise<void>((res, rej) => out.write(iv, (e) => (e ? rej(e) : res())));
  await pipeline(createReadStream(src), createCipheriv('aes-256-ctr', key(), iv), out);
}

/** Byte range of the stored object needed to decrypt plaintext bytes start..end (inclusive). */
export function storedRange(start: number, end: number) {
  const alignedStart = Math.floor(start / BLOCK) * BLOCK;
  return { start: IV_BYTES + alignedStart, end: IV_BYTES + end, skip: start - alignedStart, block: alignedStart / BLOCK };
}

/** Decrypts a stream of stored bytes that begins at block `block`, dropping `skip` leading bytes. */
export function decryptStream(iv: Buffer, block: number, skip: number): Transform {
  const d = createDecipheriv('aes-256-ctr', key(), ivAt(iv, block));
  let toSkip = skip;
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      let out = d.update(chunk);
      if (toSkip > 0) {
        const n = Math.min(toSkip, out.length);
        out = out.subarray(n);
        toSkip -= n;
      }
      cb(null, out);
    },
    flush(cb) { cb(null, d.final()); },
  });
}

export async function readAll(stream: Readable): Promise<Buffer> {
  const parts: Buffer[] = [];
  for await (const c of stream) parts.push(Buffer.from(c));
  return Buffer.concat(parts);
}
