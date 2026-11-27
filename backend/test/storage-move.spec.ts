import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { MovingStorage, Storage } from '../src/media/storage';

/** A store kept in memory, behaving like S3 (404 when missing) for the test. */
class MemoryStore implements Storage {
  files = new Map<string, Buffer>();
  failPuts = false;
  private get(key: string) { const f = this.files.get(key); if (!f) throw Object.assign(new Error('missing'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } }); return f; }
  async putFile(key: string, localPath: string) { if (this.failPuts) throw new Error('storage is down'); this.files.set(key, readFileSync(localPath)); }
  async size(key: string) { return this.get(key).length; }
  async read(key: string) { const f = this.get(key); return { stream: Readable.from([f]), size: f.length }; }
  async remove(key: string) { this.files.delete(key); }
}
const text = async (s: Readable) => { const parts: Buffer[] = []; for await (const c of s) parts.push(c as Buffer); return Buffer.concat(parts).toString(); };

describe('Moving media to object storage without downtime', () => {
  const dir = mkdtempSync(join(tmpdir(), 'move-'));
  it('reads files not yet moved from the old store, and writes new files to the new one', async () => {
    const target = new MemoryStore(), old = new MemoryStore();
    old.files.set('a', Buffer.from('old file'));
    const s = new MovingStorage(target, old);
    expect(await text((await s.read('a')).stream)).toBe('old file');
    expect(await s.size('a')).toBe(8);
    writeFileSync(join(dir, 'new'), 'new file');
    await s.putFile('b', join(dir, 'new'), 'text/plain');
    expect(target.files.has('b')).toBe(true);
    expect(old.files.has('b')).toBe(false);
    await expect(s.read('nowhere')).rejects.toThrow();
  });
  it('moves every file, byte for byte, and removes the old copy only after checking', async () => {
    const target = new MemoryStore(), old = new MemoryStore();
    old.files.set('a', Buffer.from('first')); old.files.set('b', Buffer.from('second, longer'));
    target.files.set('b', Buffer.from('partial')); // a copy cut short by an earlier attempt is replaced
    const s = new MovingStorage(target, old);
    expect(await s.moveAll(['a', 'b'], dir)).toEqual({ moved: 2, failed: 0 });
    expect(target.files.get('a')!.toString()).toBe('first');
    expect(target.files.get('b')!.toString()).toBe('second, longer');
    expect(old.files.size).toBe(0);
  });
  it('keeps the old copy when the new store fails', async () => {
    const target = new MemoryStore(), old = new MemoryStore();
    old.files.set('a', Buffer.from('precious'));
    target.failPuts = true;
    const s = new MovingStorage(target, old);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await s.moveAll(['a'], dir)).toEqual({ moved: 0, failed: 1 });
    warn.mockRestore();
    expect(old.files.get('a')!.toString()).toBe('precious');
    expect(await text((await s.read('a')).stream)).toBe('precious');
  });
});
