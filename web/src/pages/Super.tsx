import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get, post } from '../lib/api';
import { useApp } from '../lib/app';
import { Icon } from '../components/Icon';
import { ago, Confirm, Dialog, Empty, Problem, Skeleton, Spinner } from '../components/ui';
import { Approvals, AuditLog } from './Admin';
import { PdfReports } from './Analytics';

const Analytics = lazy(() => import('./Analytics'));
/** The Super Admin areas: LIVE ANALYTICS, REPORTS (PDF) and MANAGE ADMINS. Super Admins do not moderate stories. */
export default function Super({ wide, setWide }: { wide: boolean; setWide: (w: boolean) => void }) {
  const { t } = useTranslation();
  const { me } = useApp();
  const { pathname } = useLocation();
  const area = pathname.startsWith('/reports') ? 'reports' : pathname.split('/')[2] || 'analytics';
  const charts = useQuery({ queryKey: ['analytics', 'charts'], queryFn: () => get<Array<{ key: string; title: string }>>('/admin/analytics/charts'), enabled: me?.role === 'super_admin', staleTime: 600_000 });
  if (me?.role !== 'super_admin') return <Empty icon="shield" title={t('This area is for Super Admins.')}><Link className="btn primary" to="/admin/sign-in">{t('Admin sign-in')}</Link></Empty>;
  const tabs: Array<[string, string, string]> = [['analytics', 'chart', t('Live analytics')], ['reports', 'document', t('Reports (PDF)')], ['admins', 'shield', t('Manage admins')], ['approvals', 'check', t('Overdue approvals')], ['audit', 'rules', t('Audit log')], ['system', 'settings', t('System')]];
  return (
    <div>
      <div className="panel-head blue"><h2>{t('SUPER ADMIN')}</h2><button className="btn small" onClick={() => setWide(!wide)} aria-pressed={wide}><Icon name="expand" size={15} />{wide ? t('Half screen') : t('Full screen')}</button></div>
      <nav className="subtabs">{tabs.map(([k, icon, label]) => <Link key={k} to={`/super/${k}`} className={`tab ${area === k ? 'on' : ''}`} aria-current={area === k ? 'page' : undefined}><Icon name={icon} />{label}</Link>)}</nav>
      <Suspense fallback={<Spinner label={t('Loading…')} />}>
        {area === 'analytics' && <Analytics canCalibrate />}
        {area === 'reports' && <PdfReports charts={charts.data ?? []} />}
        {area === 'admins' && <ManageAdmins />}
        {area === 'approvals' && <><p className="dim small">{t('Requests that passed their deadline without a decision come to you.')}</p><Approvals superAdmin /></>}
        {area === 'audit' && <AuditLog all />}
        {area === 'system' && <System />}
      </Suspense>
    </div>
  );
}

function ManageAdmins() {
  const { t } = useTranslation();
  const { toast, me } = useApp();
  const q = useQuery({ queryKey: ['admins'], queryFn: () => get<any[]>('/super/admins') });
  const [invite, setInvite] = useState<null | { email: string; fullName: string }>(null);
  const [ask, setAsk] = useState<null | { kind: 'remove' | 'promote' | 'approve' | 'decline'; a: any }>(null);
  const [ids, setIds] = useState<Record<string, string>>({});
  const run = async (fn: () => Promise<any>) => { try { const r = await fn(); toast(r?.message ?? t('Done.')); void q.refetch(); } catch (e: any) { toast(e.message, 'error'); } };
  if (q.isLoading) return <Skeleton />;
  if (q.error) return <Problem error={q.error} retry={() => q.refetch()} />;
  const pending = q.data!.filter((a) => a.status === 'pending'), rest = q.data!.filter((a) => a.status !== 'pending');
  const row = (a: any) => (
    <li key={a.id}>
      <div className="row between">
        <span><b>{a.name}</b> <span className="kind">{a.role === 'super_admin' ? t('Super Admin') : t('Admin')}</span> {a.status !== 'active' && <span className="flag none">{t(a.invited ? 'Invited' : a.status)}</span>}
          <span className="meta" style={{ display: 'block' }}>{[a.adminName, a.adminId, a.email, a.phone, a.staffNumber && `${t('Staff no.')} ${a.staffNumber}`].filter(Boolean).join(' · ')}</span>
          <span className="meta" style={{ display: 'block' }}>{a.lastLoginAt ? t('Last signed in {when}', { when: ago(a.lastLoginAt, t) }) : t('Has not signed in yet')} · {t('{n} actions in 30 days', { n: a.actions30Days })} · {a.mfaTotpEnabled ? t('Authenticator app') : t('Email codes')}
            {a.idNumberMasked && <> · {t('ID')}: {ids[a.id] ?? a.idNumberMasked} {!ids[a.id] && <button className="linkbtn" onClick={async () => { try { const r = await get(`/super/admins/${a.id}/id-number`); setIds({ ...ids, [a.id]: r.idNumber }); } catch (e: any) { toast(e.message, 'error'); } }}>{t('Show (recorded in the audit log)')}</button>}</>}</span></span>
        <span className="row">
          {a.status === 'pending' && <><button className="btn small primary" onClick={() => setAsk({ kind: 'approve', a })}>{t('Approve')}</button><button className="btn small" onClick={() => setAsk({ kind: 'decline', a })}>{t('Decline')}</button></>}
          {a.status === 'active' && a.role === 'admin' && <button className="btn small" onClick={() => setAsk({ kind: 'promote', a })}>{t('Make Super Admin')}</button>}
          {a.id !== me!.id && a.status !== 'pending' && a.status !== 'removed' && <button className="btn small quiet" onClick={() => setAsk({ kind: 'remove', a })}>{t('Remove')}</button>}
        </span>
      </div>
    </li>
  );
  return (
    <div>
      <div className="row between"><h2>{t('Manage admins')}</h2><button className="btn primary small" onClick={() => setInvite({ email: '', fullName: '' })}><Icon name="plus" size={15} />{t('Add an admin by invitation')}</button></div>
      {pending.length > 0 && <section className="note warn"><h3 style={{ marginTop: 0 }}>{t('Registrations waiting for approval')} ({pending.length})</h3><ul className="list">{pending.map(row)}</ul></section>}
      <ul className="list">{rest.map(row)}</ul>
      {invite && (
        <Dialog title={t('Add an admin by invitation')} onClose={() => setInvite(null)}>
          <p className="small dim">{t('The invited person completes registration and sets up their second sign-in step. The link works for 7 days.')}</p>
          <label className="field"><span>{t('Work email')}</span><input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} required /></label>
          <label className="field"><span>{t('Full name (optional)')}</span><input type="text" value={invite.fullName} onChange={(e) => setInvite({ ...invite, fullName: e.target.value })} /></label>
          <div className="actions"><button className="btn quiet" onClick={() => setInvite(null)}>{t('Cancel')}</button><button className="btn primary" disabled={!/.+@.+\..+/.test(invite.email)} onClick={async () => { await run(() => post('/super/admins/invite', { email: invite.email.trim(), fullName: invite.fullName.trim() || undefined })); setInvite(null); }}>{t('Send invitation')}</button></div>
        </Dialog>
      )}
      {ask?.kind === 'approve' && <Confirm title={t('Approve {name} as an admin?', { name: ask.a.name })} yes={t('Approve')} onClose={() => setAsk(null)} onYes={() => run(() => post(`/super/admins/${ask.a.id}/decision`, { approve: true }))} />}
      {ask?.kind === 'decline' && <Confirm title={t('Decline this registration?')} yes={t('Decline')} danger onClose={() => setAsk(null)} onYes={() => run(() => post(`/super/admins/${ask.a.id}/decision`, { approve: false }))} />}
      {ask?.kind === 'promote' && <Confirm title={t('Make {name} a Super Admin?', { name: ask.a.name })} text={t('Super Admins manage admins and see all analytics and the full audit log. They no longer moderate stories.')} yes={t('Make Super Admin')} onClose={() => setAsk(null)} onYes={() => run(() => post(`/super/admins/${ask.a.id}/promote`))} />}
      {ask?.kind === 'remove' && <Confirm title={t('Remove {name}?', { name: ask.a.name })} text={t('They will lose access immediately.')} needReason={t('Reason')} yes={t('Remove')} danger onClose={() => setAsk(null)} onYes={(reason) => run(() => post(`/super/admins/${ask.a.id}/remove`, { reason }))} />}
    </div>
  );
}

function System() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['jobs'], queryFn: () => get('/super/jobs'), refetchInterval: 10_000 });
  if (!q.data) return <Skeleton lines={2} />;
  const j = q.data;
  return (
    <div>
      <h2>{t('Background work')}</h2>
      <p className="dim small">{t('Media processing, AI review, notifications, exports and reports run in the background.')} ({j.driver})</p>
      <div className="statgrid"><div className="stat"><b>{j.waiting}</b><span>{t('Waiting')}</span></div><div className="stat"><b>{j.active}</b><span>{t('Working')}</span></div><div className="stat"><b>{j.completed}</b><span>{t('Completed')}</span></div><div className="stat"><b>{j.failed}</b><span>{t('Failed')}</span></div></div>
      {j.recentFailures?.length > 0 && <><h3>{t('Recent failures')}</h3><ul className="list small">{j.recentFailures.map((f: any, i: number) => <li key={i}><b>{f.name}</b> · {f.error ?? f.lastError} <span className="meta">{f.failedAt ? ago(f.failedAt, t) : ''}</span></li>)}</ul></>}
      <Performance />
    </div>
  );
}

/** Response times, errors, server load, slow queries and real-user page speed (Section 9.4). */
function Performance() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['performance'], queryFn: () => get<any>('/super/performance'), refetchInterval: 15_000 });
  if (!q.data) return <Skeleton lines={3} />;
  const p = q.data;
  const ok = (v: number | null, target: number) => (v === null ? '' : v <= target ? 'good' : 'bad');
  const fmt = (m: string, v: number | null) => (v === null ? '—' : m === 'CLS' ? v.toFixed(2) : `${Math.round(v)} ms`);
  return (
    <section aria-labelledby="perf-h">
      <h2 id="perf-h">{t('Performance')}</h2>
      <p className="dim small">{t('The last 5 minutes on this server. The target is 95% of responses within 300 ms.')}{p.busy && <> <b className="bad">{t('The server is busy: live analytics are updated every 10 seconds and exports wait.')}</b></>}</p>
      <div className="statgrid">
        <div className="stat"><b className={ok(p.last5.p95, p.targets.p95Ms)}>{p.last5.p95} ms</b><span>{t('95% of responses within')}</span></div>
        <div className="stat"><b>{p.last5.p50} ms</b><span>{t('Typical response')}</span></div>
        <div className="stat"><b>{p.last5.perMinute}</b><span>{t('Requests per minute')}</span></div>
        <div className="stat"><b className={p.last5.errorRate > p.targets.alertErrorPct ? 'bad' : ''}>{p.last5.errorRate}%</b><span>{t('Server errors')}</span></div>
        <div className="stat"><b className={p.eventLoopLagMs.p99 > p.eventLoopLagMs.busyAbove ? 'bad' : ''}>{p.eventLoopLagMs.p99} ms</b><span>{t('Server load (delay)')}</span></div>
        <div className="stat"><b>{p.memoryMb.rss} MB</b><span>{t('Memory')}</span></div>
      </div>
      <h3>{t('Page speed for visitors (last 7 days)')}</h3>
      <p className="dim small">{t('Measured in visitors’ own browsers; 75% of visits were at least this fast.')}</p>
      <table className="table small"><thead><tr><th scope="col">{t('Measure')}</th><th scope="col">{t('Result')}</th><th scope="col">{t('Target')}</th><th scope="col">{t('Visits measured')}</th></tr></thead>
        <tbody>{p.webVitals.map((v: any) => <tr key={v.metric}><th scope="row">{v.metric}</th><td className={ok(v.p75, v.target)}>{fmt(v.metric, v.p75)}</td><td>{fmt(v.metric, v.target)}</td><td>{v.samples}</td></tr>)}</tbody></table>
      {p.slowRoutes.length > 0 && <><h3>{t('Slow requests (over 1 second)')}</h3><ul className="list small">{p.slowRoutes.map((r: any) => <li key={r.what}><code>{r.what}</code> · {r.ms} ms · ×{r.count}</li>)}</ul></>}
      {p.slowQueries.length > 0 && <><h3>{t('Slow database queries')}</h3><ul className="list small">{p.slowQueries.map((r: any) => <li key={r.what}><code>{r.what}</code> · {r.ms} ms · ×{r.count}</li>)}</ul></>}
      {p.statements.available && p.statements.rows.length > 0 && <><h3>{t('Slowest queries on average')}</h3><ul className="list small">{p.statements.rows.map((r: any, i: number) => <li key={i}><code>{r.query}</code> · {r.meanMs} ms · ×{r.calls}</li>)}</ul></>}
    </section>
  );
}
