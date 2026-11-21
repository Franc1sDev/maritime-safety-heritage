/**
 * What the website keeps on the device (IndexedDB): drafts of stories being written, and actions made while offline
 * (reactions, favourites, comments, messages) that are sent when the connection returns. Section 8.3.
 */
import { api, newKey } from './api';

const DB = 'waters', VERSION = 1;
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VERSION);
    r.onupgradeneeded = () => { const d = r.result; for (const s of ['drafts', 'queue', 'kv']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await open();
  return new Promise((res, rej) => { const r = fn(d.transaction(store, mode).objectStore(store)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
export const store = {
  all: <T = any>(s: string) => tx<T[]>(s, 'readonly', (o) => o.getAll()).catch(() => [] as T[]),
  get: <T = any>(s: string, id: string) => tx<T | undefined>(s, 'readonly', (o) => o.get(id)).catch(() => undefined),
  put: (s: string, v: { id: string } & Record<string, any>) => tx(s, 'readwrite', (o) => o.put(v)).catch(() => undefined),
  del: (s: string, id: string) => tx(s, 'readwrite', (o) => o.delete(id)).catch(() => undefined),
};

export interface Queued { id: string; label: string; path: string; method: string; body?: unknown; at: number }
const subs = new Set<() => void>();
export const onQueue = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
const changed = () => subs.forEach((f) => f());
export const queued = () => store.all<Queued>('queue');

/** Sends now if possible. If the device is offline the action is kept, labelled "waiting to send", and sent later. Returns null when queued. */
export async function sendOrQueue<T = any>(label: string, path: string, method: string, body?: unknown): Promise<T | null> {
  const id = newKey();
  if (navigator.onLine) {
    try { return await api<T>(path, { method, body, key: id }); }
    catch (e: any) { if (e.code !== 'offline') throw e; }
  }
  await store.put('queue', { id, label, path, method, body, at: Date.now() });
  changed();
  return null;
}
let flushing = false;
export async function flushQueue() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    for (const q of (await queued()).sort((a, b) => a.at - b.at)) {
      try { await api(q.path, { method: q.method, body: q.body, key: q.id }); await store.del('queue', q.id); }
      catch (e: any) { if (e.code === 'offline') break; await store.del('queue', q.id); }
      changed();
    }
  } finally { flushing = false; }
}
if (typeof window !== 'undefined') window.addEventListener('online', () => void flushQueue());
