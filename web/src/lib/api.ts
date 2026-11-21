/**
 * The one way the website talks to the server: the versioned API under /api/v1.
 * - Keeps the short-lived access token in memory and renews it with the httpOnly refresh cookie.
 * - Retries requests that fail because of the network, with increasing waits.
 * - Adds an idempotency key to submissions, so a retry on a weak connection never creates a duplicate.
 */
export interface ApiError extends Error { status: number; code: string; details?: any }
export type Person = { id: string | null; role: 'contributor' | 'admin'; username: string | null; name: string; avatar: string; badge: string | null };

const BASE = '/api/v1';
let token: string | null = null;
let refreshing: Promise<boolean> | null = null;
let language = 'en';
const listeners = new Set<(signedIn: boolean) => void>();

export const setLanguageHeader = (l: string) => { language = l; };
export const getToken = () => token;
export const onSession = (fn: (signedIn: boolean) => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export function setSession(accessToken: string | null) { token = accessToken; listeners.forEach((l) => l(!!accessToken)); }
export const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function fail(status: number, body: any): ApiError {
  const e = new Error(body?.message ?? 'Something went wrong. Please try again.') as ApiError;
  e.status = status; e.code = body?.code ?? 'general_error'; e.details = body?.details;
  return e;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const r = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: '{}' });
      if (!r.ok) { setSession(null); return false; }
      setSession((await r.json()).accessToken);
      return true;
    } catch { return false; } finally { setTimeout(() => { refreshing = null; }, 0); }
  })();
  return refreshing;
}

interface Options { method?: string; body?: unknown; form?: FormData; key?: string; retries?: number; signal?: AbortSignal }
export async function api<T = any>(path: string, o: Options = {}): Promise<T> {
  const method = o.method ?? (o.body !== undefined || o.form ? 'POST' : 'GET');
  // Reads are always safe to retry; writes only when they carry an idempotency key.
  const retries = o.retries ?? (method === 'GET' || o.key ? 3 : 0);
  let renewed = false;
  for (let attempt = 0; ; attempt++) {
    const headers: Record<string, string> = { 'X-Language': language, 'X-Requested-With': 'XMLHttpRequest' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (o.body !== undefined) headers['Content-Type'] = 'application/json';
    if (o.key) headers['Idempotency-Key'] = o.key;
    let res: Response;
    try {
      res = await fetch(BASE + path, { method, headers, credentials: 'same-origin', signal: o.signal, body: o.form ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined) });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      if (attempt < retries) { await sleep(600 * 2 ** attempt); continue; }
      throw fail(0, { code: 'offline', message: navigator.onLine ? 'Something went wrong. Please try again.' : 'You are offline. Some features are unavailable.' });
    }
    if (res.status === 401 && token && !renewed) { renewed = true; if (await refreshSession()) continue; }
    if (res.status >= 502 && res.status <= 504 && attempt < retries) { await sleep(800 * 2 ** attempt); continue; }
    const text = res.status === 204 ? '' : await res.text();
    const ct = res.headers.get('content-type') ?? '';
    const body = text && ct.includes('json') ? JSON.parse(text) : text;
    if (!res.ok) throw fail(res.status, body);
    return body as T;
  }
}
export const get = <T = any>(path: string, params?: Record<string, string | number | boolean | undefined | null>) => {
  const q = params ? Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : '';
  return api<T>(q ? `${path}?${q}` : path);
};
export const post = <T = any>(path: string, body: unknown = {}, key?: string) => api<T>(path, { method: 'POST', body, key });
export const put = <T = any>(path: string, body: unknown = {}) => api<T>(path, { method: 'PUT', body });
export const patch = <T = any>(path: string, body: unknown = {}) => api<T>(path, { method: 'PATCH', body });
export const del = <T = any>(path: string) => api<T>(path, { method: 'DELETE' });

/** Picture address for a person: the platform logo, a preset avatar, an uploaded photo, or their Google or Apple picture. */
export function avatarUrl(avatar: string | undefined): { kind: 'logo' | 'preset' | 'image'; value: string } {
  if (!avatar || avatar === 'logo') return { kind: 'logo', value: '' };
  if (avatar.startsWith('avatar:')) return { kind: 'preset', value: avatar.slice(7) };
  if (avatar.startsWith('media:')) return { kind: 'image', value: `${BASE}/media/avatar/${avatar.slice(6)}` };
  return { kind: 'image', value: avatar };
}
