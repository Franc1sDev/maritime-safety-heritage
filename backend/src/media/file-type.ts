import { open } from 'fs/promises';
import type { RecordFormat } from '../database/entities';

export interface Detected { mime: string; ext: string; format: RecordFormat }

const ascii = (b: Buffer, start: number, end: number) => b.subarray(start, end).toString('latin1');

/**
 * Works out a file's real type from its first bytes, ignoring the name and the type the browser claimed.
 * Only archive formats are accepted: audio, video, images, PDF and plain UTF-8 text.
 */
export function detect(b: Buffer): Detected | null {
  if (b.length < 4) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg', format: 'image' };
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png', format: 'image' };
  if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') return { mime: 'image/gif', ext: 'gif', format: 'image' };
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a)) return { mime: 'image/tiff', ext: 'tif', format: 'image' };
  if (ascii(b, 0, 5) === '%PDF-') return { mime: 'application/pdf', ext: 'pdf', format: 'document' };
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp', format: 'image' };
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WAVE') return { mime: 'audio/wav', ext: 'wav', format: 'audio' };
  if (ascii(b, 0, 4) === 'OggS') return { mime: 'audio/ogg', ext: 'ogg', format: 'audio' };
  if (ascii(b, 0, 4) === 'fLaC') return { mime: 'audio/flac', ext: 'flac', format: 'audio' };
  if (ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0)) return { mime: 'audio/mpeg', ext: 'mp3', format: 'audio' };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { mime: 'video/webm', ext: 'webm', format: 'video' };
  if (b.length >= 12 && ascii(b, 4, 8) === 'ftyp') {
    const brand = ascii(b, 8, 12);
    if (['M4A ', 'M4B ', 'F4A '].includes(brand)) return { mime: 'audio/mp4', ext: 'm4a', format: 'audio' };
    if (brand === 'qt  ') return { mime: 'video/quicktime', ext: 'mov', format: 'video' };
    if (['heic', 'heix', 'mif1', 'msf1'].includes(brand)) return { mime: 'image/heic', ext: 'heic', format: 'image' };
    if (brand.startsWith('3g')) return { mime: 'video/3gpp', ext: '3gp', format: 'video' };
    return { mime: 'video/mp4', ext: 'mp4', format: 'video' };
  }
  // Plain text: valid UTF-8 with no control bytes other than tab, newline and carriage return
  if (!b.some((c) => c < 9 || (c > 13 && c < 32) || c === 0x7f)) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(0, Math.max(0, b.length - 4)));
      return { mime: 'text/plain; charset=utf-8', ext: 'txt', format: 'text' };
    } catch { /* not text */ }
  }
  return null;
}

export async function detectFile(path: string): Promise<Detected | null> {
  const fh = await open(path, 'r');
  try {
    const buf = Buffer.alloc(4100);
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
    return detect(buf.subarray(0, bytesRead));
  } finally {
    await fh.close();
  }
}
