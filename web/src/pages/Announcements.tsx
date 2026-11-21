import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get, post } from '../lib/api';
import { useApp } from '../lib/app';
import { Empty, fmtDate, Problem, Skeleton } from '../components/ui';

export interface Announcement { id: string; title: string; summary: string; description: string; dates: Array<{ date: string; endDate: string | null; label: string }>; createdAt: string; editedAt: string | null; sortAt: string; unread: boolean; edited: boolean }

/** The animated calendar shown with an announcement that includes dates: the month, with the announced days marked. */
export function MiniCalendar({ dates }: { dates: Announcement['dates'] }) {
  const { i18n } = useTranslation();
  const months = [...new Set(dates.flatMap((d) => [d.date.slice(0, 7), (d.endDate ?? d.date).slice(0, 7)]))].sort().slice(0, 3);
  const hit = (iso: string) => dates.find((d) => iso >= d.date && iso <= (d.endDate ?? d.date));
  const loc = i18n.language === 'luo' ? 'en-GB' : i18n.language;
  const names = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(loc, { weekday: 'narrow' })); // 1 Jan 2024 is a Monday
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      {months.map((m) => {
        const [y, mo] = m.split('-').map(Number);
        const first = (new Date(y, mo - 1, 1).getDay() + 6) % 7, days = new Date(y, mo, 0).getDate();
        return (
          <div className="calendar" key={m} role="img" aria-label={dates.map((d) => `${fmtDate(d.date, i18n.language)}${d.endDate ? ` – ${fmtDate(d.endDate, i18n.language)}` : ''}${d.label ? `: ${d.label}` : ''}`).join('; ')}>
            <span className="cap">{new Date(y, mo - 1, 1).toLocaleDateString(loc, { month: 'long', year: 'numeric' })}</span>
            {names.map((n, i) => <b key={i}>{n}</b>)}
            {Array.from({ length: first }, (_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: days }, (_, i) => { const iso = `${m}-${String(i + 1).padStart(2, '0')}`; const h = hit(iso); return <span key={iso} className={h ? 'hit' : ''} style={h ? { animationDelay: `${(i % 7) * 0.05}s` } : undefined} title={h?.label}>{i + 1}</span>; })}
          </div>
        );
      })}
    </div>
  );
}

export default function Announcements() {
  const { t, i18n } = useTranslation();
  const { me, refreshCounts } = useApp();
  const [sp] = useSearchParams();
  const [open, setOpen] = useState<string | null>(sp.get('open'));
  const q = useQuery({ queryKey: ['announcements'], queryFn: () => get<Announcement[]>('/announcements') });
  const [read, setRead] = useState<Set<string>>(new Set());
  // Opening an announcement marks it read, and the unread count goes down.
  useEffect(() => { if (open && me && !read.has(open)) { setRead((r) => new Set(r).add(open)); void post(`/announcements/${open}/read`).then(refreshCounts).catch(() => undefined); } }, [open, me]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div className="panel-head"><h1 style={{ margin: 0 }}>{t('Announcements')}</h1></div>
      {q.isLoading ? <Skeleton lines={3} /> : q.error ? <Problem error={q.error} retry={() => q.refetch()} /> : q.data!.length === 0 ? <Empty icon="megaphone" title={t('No announcements yet')} /> : (
        <ul className="list">{q.data!.map((a) => {
          const isOpen = open === a.id, unread = a.unread && !read.has(a.id);
          return (
            <li key={a.id}>
              <button className="pick" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : a.id)} style={{ alignItems: 'flex-start' }}>
                <span className="grow"><b>{unread && <span className="dot" aria-label={t('Unread')} />} {a.title}</b>{a.edited && <span className="kind" style={{ marginInlineStart: 6 }}>{t('Edited')}</span>}
                  <span className="meta" style={{ display: 'block' }}>{fmtDate(a.sortAt, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  {a.summary && <span style={{ display: 'block' }}>{a.summary}</span>}</span>
              </button>
              {isOpen && (
                <div style={{ padding: '.2rem .4rem .6rem' }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{a.description}</div>
                  {a.dates.length > 0 && <><MiniCalendar dates={a.dates} /><ul className="small">{a.dates.map((d, i) => <li key={i}><b>{fmtDate(d.date, i18n.language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{d.endDate ? ` – ${fmtDate(d.endDate, i18n.language, { day: 'numeric', month: 'long' })}` : ''}</b>{d.label ? `: ${d.label}` : ''}</li>)}</ul></>}
                </div>
              )}
            </li>
          );
        })}</ul>
      )}
    </div>
  );
}
