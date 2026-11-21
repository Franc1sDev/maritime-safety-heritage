import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get } from '../lib/api';
import { useApp } from '../lib/app';
import { ago, Empty, fmtDate } from '../components/ui';
import { Notifications, Reminders } from './Profile';

/** MY RESPONSIBILITIES (admins): reminders, notifications, and the approvals waiting for this admin's decision. */
export default function Responsibilities() {
  const { t, i18n } = useTranslation();
  const { me } = useApp();
  const q = useQuery({ queryKey: ['approvals', 'waiting'], queryFn: () => get<any[]>('/admin/approvals/waiting'), enabled: me?.role === 'admin' });
  if (me?.role !== 'admin') return <Empty icon="tasks" title={t('This area is for admins.')} />;
  return (
    <div className="stack">
      <div className="panel-head"><h1 style={{ margin: 0 }}>{t('My Responsibilities')}</h1></div>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>{t('Approvals waiting for my decision')} {q.data ? `(${q.data.length})` : ''}</h2>
        {!q.data?.length ? <p className="dim">{t('Nothing is waiting for you.')}</p> : (
          <ul className="list">{q.data.map((r) => <li key={r.id}><span className="kind">{t(r.typeLabel)}</span> <Link to={`/admin/approvals?open=${r.id}`}><b>{r.title}</b></Link><div className="meta">{r.proposerName} · {ago(r.createdAt, t)} · {t('Decide by {date}', { date: fmtDate(r.deadline, i18n.language) })} · {r.progress}</div></li>)}</ul>
        )}
        <p className="small">{t('Messages from Contributors arrive in')} <Link to="/inbox">{t('INBOX')}</Link>.</p>
      </section>
      <section className="card"><Reminders /></section>
      <section className="card"><Notifications /></section>
    </div>
  );
}
