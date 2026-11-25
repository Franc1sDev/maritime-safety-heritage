/**
 * Real-user monitoring (Section 9.4): how fast pages appear and respond in visitors' own browsers, measured with
 * the browser's PerformanceObserver and sent once, as the page is left, in one small request. Only the measures,
 * the kind of page ("story", "map"…) and the connection type are sent: no address, account or device identifier.
 */
type Vital = { metric: 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB'; value: number };

/** Layout shifts grouped in session windows (gaps under 1 s, at most 5 s long); CLS is the worst window. */
export function clsFromShifts(shifts: Array<{ value: number; startTime: number }>): number {
  let worst = 0, current = 0, first = 0, last = 0;
  for (const s of shifts) {
    if (current && (s.startTime - last > 1000 || s.startTime - first > 5000)) { current = 0; }
    if (!current) first = s.startTime;
    current += s.value; last = s.startTime;
    worst = Math.max(worst, current);
  }
  return Math.round(worst * 1000) / 1000;
}
/** The kind of page, from the first part of its address. */
export const pageKind = (path: string) => (path.split('/')[1] || 'stories').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);

export function startVitals(endpoint = '/api/v1/rum') {
  if (typeof PerformanceObserver === 'undefined' || typeof navigator === 'undefined' || !navigator.sendBeacon) return;
  const supported = PerformanceObserver.supportedEntryTypes ?? [];
  let lcp = 0, fcp = 0, inp = 0;
  const shifts: Array<{ value: number; startTime: number }> = [];
  const watch = (type: string, fn: (e: any) => void, extra: Record<string, unknown> = {}) => {
    if (!supported.includes(type)) return;
    try { new PerformanceObserver((list) => list.getEntries().forEach(fn)).observe({ type, buffered: true, ...extra } as PerformanceObserverInit); } catch { /* not available */ }
  };
  watch('largest-contentful-paint', (e) => { lcp = e.startTime; });
  watch('paint', (e) => { if (e.name === 'first-contentful-paint') fcp = e.startTime; });
  watch('layout-shift', (e) => { if (!e.hadRecentInput) shifts.push({ value: e.value, startTime: e.startTime }); });
  watch('event', (e) => { if (e.interactionId) inp = Math.max(inp, e.duration); }, { durationThreshold: 40 });

  // The page the visit started on: that is where the first paint and LCP were measured.
  const page = pageKind(location.pathname);
  let sent = false;
  const send = (force = false) => {
    if (sent || (!force && document.visibilityState !== 'hidden')) return;
    sent = true;
    const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
    const items: Vital[] = [];
    if (lcp) items.push({ metric: 'LCP', value: Math.round(lcp) });
    if (fcp) items.push({ metric: 'FCP', value: Math.round(fcp) });
    if (nav && nav.responseStart > 0) items.push({ metric: 'TTFB', value: Math.round(nav.responseStart) });
    if (supported.includes('layout-shift')) items.push({ metric: 'CLS', value: clsFromShifts(shifts) });
    if (inp) items.push({ metric: 'INP', value: Math.round(inp) });
    if (!items.length) return;
    const connection = String((navigator as any).connection?.effectiveType ?? '').replace(/[^a-z0-9-]/gi, '').slice(0, 12);
    const body = JSON.stringify({ items: items.map((i) => ({ ...i, page, connection })) });
    try { navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' })); } catch { /* best effort */ }
  };
  document.addEventListener('visibilitychange', () => send());
  window.addEventListener('pagehide', () => send(true));
}
