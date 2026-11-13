import { Logger } from '@nestjs/common';
import { createReadStream } from 'fs';
import { Socket } from 'net';
import { config } from '../config/config';

export type ScanResult = { clean: true } | { clean: false; signature: string } | { clean: null; error: string };

const log = new Logger('VirusScan');

/**
 * Scans a file with ClamAV (clamd) using the INSTREAM command. Turned on by setting CLAMAV_HOST.
 * Returns clean: null when no scanner is configured or it cannot be reached.
 */
export function scanFile(path: string): Promise<ScanResult> {
  if (!config.clamav.host) return Promise.resolve({ clean: null, error: 'not configured' });
  return new Promise((resolve) => {
    const sock = new Socket();
    let reply = '';
    let settled = false;
    const done = (r: ScanResult) => { if (!settled) { settled = true; sock.destroy(); resolve(r); } };
    sock.setTimeout(config.clamav.timeoutMs, () => done({ clean: null, error: 'timed out' }));
    sock.on('error', (e) => done({ clean: null, error: e.message }));
    sock.on('data', (d) => { reply += d.toString('utf8'); });
    sock.on('end', () => {
      const text = reply.replace(/\0/g, '').trim();
      if (/:\s*OK$/.test(text)) done({ clean: true });
      else if (/FOUND$/.test(text)) done({ clean: false, signature: text.replace(/^stream:\s*/, '').replace(/\s*FOUND$/, '') });
      else done({ clean: null, error: text || 'no answer' });
    });
    sock.connect(config.clamav.port, config.clamav.host, () => {
      sock.write('zINSTREAM\0');
      const file = createReadStream(path, { highWaterMark: 64 * 1024 });
      file.on('data', (chunk: string | Buffer) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(buf.length, 0);
        if (!sock.write(Buffer.concat([len, buf]))) { file.pause(); sock.once('drain', () => file.resume()); }
      });
      file.on('end', () => sock.write(Buffer.alloc(4)));
      file.on('error', (e) => { log.error(`Could not read upload for scanning: ${e.message}`); done({ clean: null, error: e.message }); });
    });
  });
}
