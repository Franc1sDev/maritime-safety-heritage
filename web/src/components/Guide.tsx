import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

/**
 * Guided on-screen hints on first use: how to browse, react, comment and share a first story.
 * Each hint points at the real control on the STORIES page. Shown once per browser, and again
 * on request from Settings.
 */
const KEY = 'guide';
const STEPS: Array<[anchor: string, icon: string, title: string, body: string]> = [
  ['browse', 'stories', 'Browse the stories', 'Choose how to browse here: trending, by place, by incident and more. Scroll, swipe or use the arrow keys to move to the next story.'],
  ['react', 'heart', 'React to a story', 'A heart, a heartbreak or a laugh tells the storyteller how their story reached you.'],
  ['comment', 'comment', 'Join the conversation', 'Open the comments to read what others have said, and add a comment or a reply of your own.'],
  ['share', 'plus', 'Share your first story', 'Select the plus to tell your own story in words, photos, audio or video.'],
];

const seen = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } };
const remember = () => { try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ } };

/** Show the hints again (from Settings). */
export function replayGuide() {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
  window.dispatchEvent(new Event('guide'));
}

/** The first visible element carrying this anchor name. */
function anchor(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-guide="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export function Guide({ ready }: { ready: boolean }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<number | null>(null);
  const [box, setBox] = useState<DOMRect | null>(null);
  const next = useRef<HTMLButtonElement>(null);

  // Start once the page has something to point at.
  useEffect(() => {
    if (!ready || step !== null) return;
    let timer: number | undefined;
    const start = () => {
      window.clearInterval(timer);
      if (seen()) return;
      let tries = 0;
      timer = window.setInterval(() => {
        tries += 1;
        if (anchor('browse') && (anchor('react') || tries > 12)) { window.clearInterval(timer); setStep(0); }
        if (tries > 40) window.clearInterval(timer);
      }, 500);
    };
    start();
    window.addEventListener('guide', start);
    return () => { window.clearInterval(timer); window.removeEventListener('guide', start); };
  }, [ready, step]);

  const finish = useCallback(() => { remember(); setStep(null); setBox(null); }, []);
  const go = useCallback((from: number) => {
    // Skip a hint whose control is not on screen (for example on a list tab).
    for (let i = from; i < STEPS.length; i++) if (anchor(STEPS[i][0])) return setStep(i);
    finish();
  }, [finish]);

  // Keep the highlight on the control as the page moves.
  useLayoutEffect(() => {
    if (step === null) return;
    const place = () => { const el = anchor(STEPS[step][0]); if (!el) return go(step + 1); setBox(el.getBoundingClientRect()); };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const timer = window.setInterval(place, 600);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.clearInterval(timer); };
  }, [step, go]);

  useEffect(() => {
    if (step === null) return;
    next.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); finish(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [step, finish]);

  if (step === null || !box) return null;
  const [, icon, title, body] = STEPS[step];
  const vw = document.documentElement.clientWidth || window.innerWidth, vh = document.documentElement.clientHeight || window.innerHeight, pad = 6, gap = 14;
  const width = Math.min(330, vw - 24);
  const tall = box.height > vh * 0.45;
  const style: React.CSSProperties = { width };
  if (tall) {
    // A tall control (the buttons beside a story): sit next to it.
    style.top = Math.max(12, Math.min(box.top + 8, vh - 230));
    if (box.left > vw / 2) style.left = Math.max(12, box.left - width - gap); else style.left = Math.min(vw - width - 12, box.right + gap);
  } else {
    style.left = Math.max(12, Math.min(box.left + box.width / 2 - width / 2, vw - width - 12));
    if (box.bottom + 210 < vh) style.top = box.bottom + gap; else style.bottom = Math.max(12, vh - box.top + gap);
  }
  const last = !STEPS.slice(step + 1).some(([a]) => anchor(a));
  return (
    <div className="guide" role="dialog" aria-modal="true" aria-labelledby="guide-title" aria-describedby="guide-body">
      <div className="guide-ring" style={{ left: box.left - pad, top: box.top - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} />
      <div className="guide-card" style={style} key={step}>
        <p className="guide-count" aria-live="polite">{t('Hint {n} of {total}', { n: step + 1, total: STEPS.length })}</p>
        <h2 id="guide-title"><Icon name={icon} size={20} /> {t(title)}</h2>
        <p id="guide-body">{t(body)}</p>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="linkbtn" onClick={finish}>{t('Skip the hints')}</button>
          <button ref={next} className="btn primary" onClick={() => (last ? finish() : go(step + 1))}>{last ? t('Got it') : t('Next')}</button>
        </div>
      </div>
    </div>
  );
}
