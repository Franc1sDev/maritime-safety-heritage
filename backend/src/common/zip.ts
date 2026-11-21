import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { crc32 } from 'zlib';

/**
 * A small ZIP writer (stored, no compression: photos, audio and video are already compressed).
 * Entries are streamed to disk, so large stories never sit in memory.
 */
export class ZipWriter {
  private readonly out;
  private offset = 0;
  private readonly entries: Array<{ name: Buffer; crc: number; size: number; offset: number; time: number; date: number }> = [];
  constructor(path: string) { this.out = createWriteStream(path); }

  private write(b: Buffer) { this.offset += b.length; return new Promise<void>((res, rej) => this.out.write(b, (e) => (e ? rej(e) : res()))); }

  async add(name: string, content: Buffer | Readable) {
    const nameBuf = Buffer.from(name.replace(/^\/+/, ''), 'utf8');
    const d = new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const offset = this.offset;
    // Bit 3: sizes and checksum follow the data, so a stream can be written without knowing them first. Bit 11: UTF-8 names.
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0808, 6); head.writeUInt16LE(0, 8);
    head.writeUInt16LE(time, 10); head.writeUInt16LE(date, 12); head.writeUInt16LE(nameBuf.length, 26);
    await this.write(Buffer.concat([head, nameBuf]));
    let crc = 0, size = 0;
    const chunks: AsyncIterable<Buffer> | Buffer[] = Buffer.isBuffer(content) ? [content] : content;
    for await (const chunk of chunks) { const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); crc = crc32(b, crc); size += b.length; await this.write(b); }
    const desc = Buffer.alloc(16);
    desc.writeUInt32LE(0x08074b50, 0); desc.writeUInt32LE(crc >>> 0, 4); desc.writeUInt32LE(size, 8); desc.writeUInt32LE(size, 12);
    await this.write(desc);
    this.entries.push({ name: nameBuf, crc: crc >>> 0, size, offset, time, date });
  }

  async close() {
    const start = this.offset;
    for (const e of this.entries) {
      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0808, 8); c.writeUInt16LE(0, 10);
      c.writeUInt16LE(e.time, 12); c.writeUInt16LE(e.date, 14); c.writeUInt32LE(e.crc, 16); c.writeUInt32LE(e.size, 20); c.writeUInt32LE(e.size, 24);
      c.writeUInt16LE(e.name.length, 28); c.writeUInt32LE(e.offset, 42);
      await this.write(Buffer.concat([c, e.name]));
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(this.entries.length, 8); end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(this.offset - start, 12); end.writeUInt32LE(start, 16);
    await this.write(end);
    await new Promise<void>((res) => this.out.end(res));
  }
}
