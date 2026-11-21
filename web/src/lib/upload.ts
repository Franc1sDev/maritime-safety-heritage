/**
 * Uploads (Section 8.4). Each file is compressed on the device where possible (images), then sent in pieces with the
 * resumable (tus) protocol, so a dropped connection continues from where it stopped instead of starting again.
 * Small files go in one request. Every upload reports its progress.
 */
import * as tus from 'tus-js-client';
import { api, getToken, refreshSession } from './api';
import { MediaItem } from '../components/Media';

/** Shrinks large photos before sending (longest side 2560 px, JPEG). Also drops hidden location data, which the server removes again. */
export async function compressImage(file: File, onStep?: (pct: number) => void, blurFaces = false): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || (file.size < 600_000 && !blurFaces)) return file;
  try {
    onStep?.(10);
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext('2d')!; ctx.drawImage(bmp, 0, 0, c.width, c.height);
    onStep?.(55);
    if (blurFaces && 'FaceDetector' in window) {
      // Optional face blurring, on devices whose browser can find faces.
      try {
        const faces = await new (window as any).FaceDetector({ fastMode: true }).detect(c);
        for (const f of faces) { const b = f.boundingBox; ctx.save(); ctx.filter = `blur(${Math.max(12, Math.round(b.width / 5))}px)`; ctx.beginPath(); ctx.rect(b.x, b.y, b.width, b.height); ctx.clip(); ctx.drawImage(c, 0, 0); ctx.restore(); }
      } catch { /* not supported here */ }
    }
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
    onStep?.(100);
    if (!blob || (blob.size >= file.size && !blurFaces)) return file;
    return new File([blob], file.name.replace(/\.(png|webp|jpe?g)$/i, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return file; }
}
export const canBlurFaces = () => typeof window !== 'undefined' && 'FaceDetector' in window;

export interface UploadHandle { promise: Promise<MediaItem>; cancel: () => void }
export function uploadFile(file: File, purpose: string, onProgress: (pct: number) => void, altText = ''): UploadHandle {
  if (file.size < 4_000_000) {
    const ctl = new AbortController();
    const form = new FormData(); form.append('purpose', purpose); if (altText) form.append('altText', altText); form.append('file', file);
    onProgress(30);
    return { promise: api<MediaItem>('/media', { form, signal: ctl.signal }).then((m) => { onProgress(100); return m; }), cancel: () => ctl.abort() };
  }
  let up: tus.Upload; let mediaId = '';
  const promise = new Promise<MediaItem>((resolve, reject) => {
    up = new tus.Upload(file, {
      endpoint: '/api/v1/uploads', chunkSize: 2 * 1024 * 1024, retryDelays: [0, 1500, 4000, 9000, 20_000, 40_000], removeFingerprintOnSuccess: true,
      metadata: { filename: file.name, filetype: file.type, purpose, altText },
      onBeforeRequest: async (req) => { if (!getToken()) await refreshSession(); req.setHeader('Authorization', `Bearer ${getToken() ?? ''}`); req.setHeader('X-Requested-With', 'XMLHttpRequest'); },
      onAfterResponse: (_req, res) => { const id = res.getHeader('Upload-Media-Id'); if (id) mediaId = id; },
      onShouldRetry: (err: any) => { const s = err?.originalResponse?.getStatus?.() ?? 0; return s === 0 || s === 409 || s === 423 || s >= 500; },
      onProgress: (sent, total) => onProgress(Math.min(99, Math.round((sent / total) * 100))),
      onError: (e: any) => { let msg = ''; try { msg = JSON.parse(e?.originalResponse?.getBody?.() ?? '{}').message; } catch { /* plain */ } reject(new Error(msg || 'Upload failed. Check your connection and try again.')); },
      onSuccess: async () => {
        try {
          const id = up.url!.split('/').pop()!;
          const r = await api(`/uploads/${id}`);
          if (!r.complete && !mediaId) throw new Error('Upload failed. Check your connection and try again.');
          onProgress(100); resolve(r.media);
        } catch (e) { reject(e); }
      },
    });
    void up.findPreviousUploads().then((prev) => { if (prev.length) up.resumeFromPreviousUpload(prev[0]); up.start(); });
  });
  return { promise, cancel: () => void up?.abort(true) };
}
