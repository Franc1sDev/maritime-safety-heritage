import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { avatarUrl, Person } from '../lib/api';
import { useApp } from '../lib/app';
import { Icon, Logo } from './Icon';

export function Avatar({ person, size = '' }: { person?: Pick<Person, 'avatar' | 'name'> | null; size?: '' | 'sm' | 'lg' }) {
  const a = avatarUrl(person?.avatar);
  return (
    <span className={`avatar ${size}`} aria-hidden="true">
      {a.kind === 'logo' ? <Logo size={size === 'lg' ? 84 : size === 'sm' ? 30 : 44} /> : a.kind === 'image' ? <img src={a.value} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Icon name={a.value} />}
    </span>
  );
}
export function PersonName({ person }: { person: Person }) {
  const label = <>{person.username && person.role !== 'admin' ? `@${person.username}` : person.name}{person.badge && <> <span className="badge">{person.badge}</span></>}</>;
  return person.username && person.role !== 'admin' ? <Link className="who" to={`/contributors/${person.username}`}>{label}</Link> : <span className="who">{label}</span>;
}

/** A dialog that traps focus, closes on Escape and returns focus to where it came from. On phones it slides up as a sheet. */
export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const { t } = useTranslation();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    (el.querySelector<HTMLElement>('[autofocus], input, textarea, select, button:not(.xbtn)') ?? el).focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const f = [...el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1} style={wide ? { width: 'min(820px, 100%)' } : undefined}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <h2 id={id}>{title}</h2>
          <button className="xbtn" onClick={onClose} aria-label={t('Close')}><Icon name="close" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ title, text, yes, danger, onYes, onClose, needReason }: { title: string; text?: string; yes: string; danger?: boolean; onYes: (reason: string) => Promise<void> | void; onClose: () => void; needReason?: string }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <Dialog title={title} onClose={onClose}>
      {text && <p>{text}</p>}
      {needReason && <label className="field"><span>{needReason}</span><textarea value={reason} onChange={(e) => setReason(e.target.value)} required /></label>}
      <div className="actions">
        <button className="btn quiet" onClick={onClose}>{t('Cancel')}</button>
        <button className={`btn primary ${danger ? 'danger' : ''}`} disabled={busy || (!!needReason && reason.trim().length < 3)} onClick={async () => { setBusy(true); try { await onYes(reason.trim()); onClose(); } finally { setBusy(false); } }}>{busy ? <span className="spinner" /> : yes}</button>
      </div>
    </Dialog>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  return <div className="toasts" role="status" aria-live="polite">{toasts.map((x) => <div key={x.id} className={`toast ${x.kind}`}>{x.text}</div>)}</div>;
}
export const Spinner = ({ label }: { label?: string }) => <p className="dim" role="status"><span className="spinner" /> {label}</p>;
export const Skeleton = ({ lines = 4 }: { lines?: number }) => <div aria-hidden="true">{Array.from({ length: lines }, (_, i) => <div key={i} className="skeleton" style={{ width: `${90 - i * 12}%`, minHeight: i === 3 ? 160 : 14 }} />)}</div>;
export function Empty({ icon = 'stories', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return <div className="empty"><Icon name={icon} /><p><b>{title}</b></p>{children}</div>;
}
/** The general error with Retry. */
export function Problem({ error, retry }: { error: any; retry?: () => void }) {
  const { t } = useTranslation();
  return <div className="empty" role="alert"><Icon name="warning" /><p><b>{error?.message ?? t('Something went wrong. Please try again.')}</b></p>{retry && <button className="btn" onClick={retry}>{t('Retry')}</button>}</div>;
}
export function Celebrate({ on }: { on: boolean }) {
  const { reducedMotion } = useApp();
  if (!on || reducedMotion) return null;
  const colours = ['#0b5fbf', '#5aa7ff', '#ffffff', '#1a8a4c', '#f2c94c'];
  return <div className="celebrate" aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, background: colours[i % 5], animationDelay: `${(i % 9) * 0.07}s`, border: '1px solid #0b5fbf33' }} />)}</div>;
}
export const fmtDate = (d: string | Date | null | undefined, lang: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (!d) return '';
  const date = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00`) : new Date(d);
  try { return date.toLocaleDateString(lang === 'luo' || lang === 'en' ? 'en-GB' : lang, opts); } catch { return date.toLocaleDateString('en-GB', opts); }
};
export function ago(d: string | Date, t: (k: string, o?: any) => string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return t('just now');
  if (s < 3600) return t('{n} min ago', { n: Math.floor(s / 60) });
  if (s < 86400) return t('{n} h ago', { n: Math.floor(s / 3600) });
  if (s < 30 * 86400) return t('{n} d ago', { n: Math.floor(s / 86400) });
  return new Date(d).toLocaleDateString();
}
export const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n));
