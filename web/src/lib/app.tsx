import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { api, get, getToken, hint, onSession, post, refreshSession, sessionHint, setSession } from './api';
import i18n, { detectLanguage, setLanguage } from './i18n';
import { flushQueue } from './offline';

export interface Me {
  id: string; role: 'contributor' | 'admin' | 'super_admin'; status: string; username: string | null; name: string; avatar: string; badge: string | null; email: string | null;
  provider: string; providerName: string; providerPicture: string; useProviderIdentity: boolean; language: string; theme: 'light' | 'dark' | 'auto'; settings: Settings; profileComplete: boolean;
  warnings: number; followers: number; following: number; storyCount: number; admin?: { adminName: string; adminId: string; staffNumber: string; phone: string; mfaAuthenticator: boolean };
}
export interface Settings {
  highContrast: boolean; textSize: 'small' | 'medium' | 'large' | 'xlarge'; reducedMotion: boolean; lowData: boolean; wifiOnly: boolean; readReceipts: boolean;
  notifications: Record<string, { inApp: boolean; push: boolean; email: boolean }>; quietHours: { from: string; to: string };
}
export interface Config {
  name: string; siteUrl: string; languages: Array<{ code: string; name: string; launch: boolean; rtl: boolean }>; categories: string[]; rights: string[]; incidentTypes: string[];
  resourceTypes: Record<string, string>; audiences: string[]; avatars: string[]; reportReasons: Array<{ key: string; label: string }>; deletionReasons: Array<{ key: string; label: string }>;
  rules: string[]; moderationNote: string; emergencyNumbers: string[]; safetyNotice: string; sensitiveNotice: string; supportInfo: string;
  limits: { videoMb: number; videoMinutes: number; audioMb: number; imageMb: number; documentMb: number; images: number; documents: number };
  minAge: number; turnstileSiteKey: string | null; vapidPublicKey: string | null; mapsKey: string | null;
}
export interface Counts { notifications: number; priority: number; announcements: number; inbox: number }
type Local = Partial<Pick<Settings, 'highContrast' | 'textSize' | 'reducedMotion' | 'lowData'>> & { theme?: Me['theme'] };

interface Ctx {
  me: Me | null; ready: boolean; config: Config | null; counts: Counts; online: boolean; lowData: boolean; reducedMotion: boolean;
  setMe: (m: Me | null) => void; reloadMe: () => Promise<void>; signedIn: (session: { accessToken: string; user: Me }) => void; signOut: () => Promise<void>;
  toast: (text: string, kind?: 'ok' | 'error' | 'info') => void; toasts: Array<{ id: number; text: string; kind: string }>;
  /** Asks a visitor to sign in before an action that needs an account. Returns true when signed in. */
  need: () => boolean; prompt: boolean; closePrompt: () => void;
  local: Local; setLocal: (l: Local) => void; socket: Socket | null; refreshCounts: () => void;
}
const C = createContext<Ctx>(null as never);
export const useApp = () => useContext(C);

const readLocal = (): Local => { try { return JSON.parse(localStorage.getItem('look') ?? '{}'); } catch { return {}; } };

export function AppProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [me, setMeState] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [counts, setCounts] = useState<Counts>({ notifications: 0, priority: 0, announcements: 0, inbox: 0 });
  const [online, setOnline] = useState(navigator.onLine);
  const [toasts, setToasts] = useState<Ctx['toasts']>([]);
  const [prompt, setPrompt] = useState(false);
  const [local, setLocalState] = useState<Local>(readLocal);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [slow, setSlow] = useState(false);
  const meRef = useRef<Me | null>(null);
  meRef.current = me;

  const toast = useCallback((text: string, kind: 'ok' | 'error' | 'info' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3800);
  }, []);
  const setLocal = useCallback((l: Local) => setLocalState((cur) => { const n = { ...cur, ...l }; localStorage.setItem('look', JSON.stringify(n)); return n; }), []);
  const setMe = useCallback((m: Me | null) => { setMeState(m); if (m) void setLanguage(m.language); }, []);
  const refreshCounts = useCallback(() => { if (getToken()) void get('/me/notifications').then((r) => setCounts(r.counts)).catch(() => undefined); }, []);
  const reloadMe = useCallback(async () => { if (getToken()) setMe(await get<Me>('/auth/me')); }, [setMe]);
  const signedIn = useCallback((s: { accessToken: string; user: Me }) => { setSession(s.accessToken); setMe(s.user); setPrompt(false); void qc.invalidateQueries(); refreshCounts(); }, [qc, setMe, refreshCounts]);
  const signOut = useCallback(async () => {
    await api('/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
    try { sessionStorage.removeItem('floated'); } catch { /* private mode */ }
    setSession(null); hint('0'); setMeState(null); setCounts({ notifications: 0, priority: 0, announcements: 0, inbox: 0 }); qc.clear();
  }, [qc]);

  // Start-up: language, lists and standard texts, then the saved session if there is one.
  useEffect(() => {
    void (async () => {
      const lang = detectLanguage(['en', 'sw', 'luo']);
      await setLanguage(lang);
      get<Config>('/config').then(setConfig).catch(() => undefined);
      const restore = async () => { if (await refreshSession()) { try { setMe(await get<Me>('/auth/me')); void qc.invalidateQueries(); } catch { setSession(null); } } };
      const known = sessionHint();
      // A browser with a saved sign-in waits for it, so nobody sees the visitor view flash by. A visitor's browser
      // does not wait: one that is known to have no sign-in skips the check, one not yet known checks in the background.
      if (known === '1') await restore(); else if (known === null) void restore();
      setReady(true);
    })();
    // The lists and standard texts come from the server in the reader's language.
    const relang = () => { get<Config>('/config').then(setConfig).catch(() => undefined); };
    i18n.on('languageChanged', relang);
    const off = onSession((s) => { if (!s && meRef.current) { setMeState(null); toast(i18n.t('Your session has expired. Please sign in again.'), 'info'); } });
    return () => { off(); i18n.off('languageChanged', relang); };
  }, [setMe, toast]);

  useEffect(() => {
    const on = () => { setOnline(true); toast(i18n.t('Back online.')); void flushQueue(); void qc.invalidateQueries(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    const c = (navigator as any).connection;
    let told = false;
    const speed = () => {
      const isSlow = !!c && (c.saveData || ['slow-2g', '2g'].includes(c.effectiveType));
      setSlow(isSlow);
      // Said once: low-data mode has been turned on because the connection is slow.
      if (isSlow && !told) { told = true; toast(i18n.t('Your connection looks slow, so low-data mode is on: pictures and video load only when you select them.'), 'info'); }
    };
    speed(); c?.addEventListener?.('change', speed);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); c?.removeEventListener?.('change', speed); };
  }, [qc, toast]);

  // Live updates. The connection reconnects by itself after drops and then fetches anything missed; if live connections are blocked, updates are checked at intervals instead.
  useEffect(() => {
    if (!ready) return;
    let s: Socket | null = null;
    let closed = false;
    refreshCounts();
    // The live connection (and its code) is fetched once the first story is on screen, so it never delays it.
    const start = window.setTimeout(() => {
      void import('socket.io-client').then(({ io }) => {
        if (closed) return;
        const live = io({ auth: { token: getToken() ?? undefined }, transports: ['websocket', 'polling'], reconnectionDelayMax: 15_000 });
        s = live;
        setSocket(live);
        live.on('counts', (c: Counts) => setCounts(c));
        live.on('notification', () => { void qc.invalidateQueries({ queryKey: ['notifications'] }); });
        live.on('notification.done', () => { void qc.invalidateQueries({ queryKey: ['notifications'] }); });
        live.on('message', () => { void qc.invalidateQueries({ queryKey: ['inbox'] }); });
        live.on('message.read', () => { void qc.invalidateQueries({ queryKey: ['inbox'] }); });
        live.on('announcement', () => { void qc.invalidateQueries({ queryKey: ['announcements'] }); refreshCounts(); });
        live.on('approval', () => { void qc.invalidateQueries({ queryKey: ['approvals'] }); });
        live.on('moderation', () => { void qc.invalidateQueries({ queryKey: ['moderation'] }); });
        live.on('report', () => { void qc.invalidateQueries({ queryKey: ['reports'] }); });
        live.on('safety', () => { void qc.invalidateQueries({ queryKey: ['safety'] }); });
        live.on('story.review', () => { void qc.invalidateQueries({ queryKey: ['my-stories'] }); });
        live.io.on('reconnect', () => { void qc.invalidateQueries(); refreshCounts(); });
      }).catch(() => undefined);
    }, 1500);
    const poll = setInterval(() => { if (!s?.connected) { refreshCounts(); void qc.invalidateQueries({ queryKey: ['inbox'] }); } }, 45_000);
    return () => { closed = true; clearTimeout(start); clearInterval(poll); s?.close(); setSocket(null); };
  }, [ready, me?.id, qc, refreshCounts]);

  // Look: theme (Light, Dark or Auto), high contrast, text size and reduced motion. Saved to the account when signed in, on the device otherwise.
  const look = { theme: me?.theme ?? local.theme ?? 'auto', highContrast: me?.settings.highContrast ?? local.highContrast ?? false, textSize: me?.settings.textSize ?? local.textSize ?? 'medium',
    reducedMotion: me?.settings.reducedMotion ?? local.reducedMotion ?? false, lowData: me?.settings.lowData ?? local.lowData ?? false };
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const [systemCalm, setSystemCalm] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const d = matchMedia('(prefers-color-scheme: dark)'), m = matchMedia('(prefers-reduced-motion: reduce)');
    const fd = () => setSystemDark(d.matches), fm = () => setSystemCalm(m.matches);
    d.addEventListener('change', fd); m.addEventListener('change', fm);
    return () => { d.removeEventListener('change', fd); m.removeEventListener('change', fm); };
  }, []);
  const reducedMotion = look.reducedMotion || systemCalm;
  useEffect(() => {
    const r = document.documentElement;
    r.dataset.theme = look.theme === 'auto' ? (systemDark ? 'dark' : 'light') : look.theme;
    r.dataset.contrast = look.highContrast ? 'high' : 'normal';
    r.dataset.text = look.textSize; r.dataset.motion = reducedMotion ? 'reduced' : 'full';
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', r.dataset.theme === 'dark' ? '#071426' : '#0b5fbf');
  }, [look.theme, look.highContrast, look.textSize, reducedMotion, systemDark]);

  const need = useCallback(() => { if (meRef.current) return true; setPrompt(true); return false; }, []);
  const value = useMemo<Ctx>(() => ({ me, ready, config, counts, online, lowData: look.lowData || slow, reducedMotion, setMe, reloadMe, signedIn, signOut, toast, toasts, need, prompt, closePrompt: () => setPrompt(false), local, setLocal, socket, refreshCounts }),
    [me, ready, config, counts, online, look.lowData, slow, reducedMotion, setMe, reloadMe, signedIn, signOut, toast, toasts, need, prompt, local, setLocal, socket, refreshCounts]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

/** Saves a setting to the account, or to this device for visitors. */
export function useSaveSettings() {
  const { me, setMe, setLocal, toast } = useApp();
  return async (patch: Record<string, any>, quiet = false) => {
    if (!me) { setLocal(patch); if (patch.language) await setLanguage(patch.language); return; }
    try { const r = await api('/me/settings', { method: 'PATCH', body: patch }); setMe(r.user); if (!quiet) toast(r.message); } catch (e: any) { toast(e.message, 'error'); }
  };
}
export { post };
