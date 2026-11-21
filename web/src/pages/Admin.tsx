import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, get, Person, post } from '../lib/api';
import { useApp } from '../lib/app';
import { AdminBar } from '../components/AdminBar';
import { Icon } from '../components/Icon';
import type { Story } from '../components/Story';
import { ago, Avatar, Confirm, Dialog, Empty, fmtDate, Problem, Skeleton, Spinner } from '../components/ui';

const Content = lazy(() => import('./AdminContent'));
const Analytics = lazy(() => import('./Analytics'));
type Wide = { wide: boolean; setWide: (w: boolean) => void };
const TABS: Array<[string, string, string]> = [['moderation', 'shield', 'Moderation'], ['reports', 'flag', 'Reports'], ['safety', 'warning', 'Safety concerns'], ['approvals', 'check', 'Approvals'], ['company', 'stories', 'Company stories'], ['collections', 'collection', 'Collections'],
  ['incidents', 'incident', 'Incidents'], ['import', 'upload', 'Import'], ['resources', 'book', 'Resources'], ['announcements', 'megaphone', 'Announcements'], ['analytics', 'chart', 'Analytics'], ['audit', 'rules', 'Audit log']];

/** The administrative controls panel: one side of the admin's screen, expandable to full screen and back. */
export default function Admin({ wide, setWide }: Wide) {
  const { t } = useTranslation();
  const { me } = useApp();
  const { pathname } = useLocation();
  const seg = pathname.startsWith('/reports') ? 'analytics' : pathname.split('/')[2] || 'moderation';
  const tab = seg === 'export' ? 'import' : seg;
  if (me?.role !== 'admin') return <Empty icon="shield" title={t('This area is for admins.')}><Link className="btn primary" to="/admin/sign-in">{t('Admin sign-in')}</Link></Empty>;
  return (
    <div>
      <div className="panel-head blue"><h2>{t('ADMINISTRATIVE CONTROLS')}</h2>
        <button className="btn small" onClick={() => setWide(!wide)} aria-pressed={wide}><Icon name="expand" size={15} />{wide ? t('Half screen') : t('Full screen')}</button></div>
      <nav className="subtabs" aria-label={t('Administrative controls')}>{TABS.map(([k, icon, label]) => <Link key={k} to={`/admin/${k}`} className={`tab ${tab === k ? 'on' : ''}`} aria-current={tab === k ? 'page' : undefined}><Icon name={icon} />{t(label)}</Link>)}</nav>
      <Suspense fallback={<Spinner label={t('Loading…')} />}>
        {tab === 'moderation' ? <Moderation /> : tab === 'reports' ? <Reports /> : tab === 'safety' ? <Safety /> : tab === 'approvals' ? <Approvals /> : tab === 'audit' ? <AuditLog /> : tab === 'analytics' ? <Analytics /> : <Content tab={tab} />}
      </Suspense>
    </div>
  );
}

// ---------- Moderation ----------
function Moderation() {
  const { t, i18n } = useTranslation();
  const { toast } = useApp();
  const [sp, setSp] = useSearchParams();
  const sub = sp.get('tab') ?? 'stories';
  const [f, setF] = useState({ flag: '', filter: '', sort: 'recent', q: sp.get('open') && sub === 'stories' ? sp.get('open')! : '' });
  const q = useQuery({ queryKey: ['moderation', f], queryFn: () => get<{ items: Array<Story & { authorId: string }>; counts: Record<string, number>; overrideWarning: string }>('/admin/moderation', f), enabled: sub === 'stories' });
  const [history, setHistory] = useState<Story | null>(null);
  const [validate, setValidate] = useState<Story | null>(null);
  const [account, setAccount] = useState<{ id: string; name: string } | null>(null);
  const c = q.data?.counts;
  return (
    <div>
      <div className="row" role="tablist" style={{ marginBottom: '.6rem' }}>
        {[['stories', t('Stories')], ['comments', t('Held comments')], ['messages', t('Held messages')]].map(([k, label]) => <button key={k} role="tab" aria-selected={sub === k} className={`chip ${sub === k ? 'on' : ''}`} onClick={() => setSp(k === 'stories' ? {} : { tab: k })}>{label}</button>)}
      </div>
      {sub !== 'stories' ? <Held kind={sub as 'comments' | 'messages'} /> : (
        <>
          {c && <div className="row small" style={{ marginBottom: '.5rem' }}><span className="flag GREEN">{c.green} GREEN</span><span className="flag YELLOW">{c.yellow} YELLOW</span><span className="flag RED">{c.red} RED</span><span>{t('{n} pending review', { n: c.pending })} · {t('{n} blocked', { n: c.blocked })} · {t('{n} overridden', { n: c.overridden })}</span></div>}
          <div className="grid2" style={{ marginBottom: '.6rem' }}>
            <label className="field"><span>{t('AI flag')}</span><select value={f.flag} onChange={(e) => setF({ ...f, flag: e.target.value })}><option value="">{t('All flags')}</option><option value="green">{t('Green')}</option><option value="yellow">{t('Yellow')}</option><option value="red">{t('Red')}</option></select></label>
            <label className="field"><span>{t('Show')}</span><select value={f.filter} onChange={(e) => setF({ ...f, filter: e.target.value })}><option value="">{t('All stories')}</option><option value="pending">{t('Pending review')}</option><option value="blocked">{t('AI-blocked, not overridden')}</option><option value="overridden">{t('AI-blocked, overridden')}</option><option value="awaiting">{t('Waiting for approval or validation')}</option><option value="removed">{t('Removed')}</option></select></label>
            <label className="field"><span>{t('Order')}</span><select value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}><option value="recent">{t('Most recent')}</option><option value="oldest">{t('Oldest')}</option></select></label>
            <label className="field"><span>{t('Story ID or words')}</span><input type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="MS-2026-00001" /></label>
          </div>
          {q.isLoading ? <Skeleton /> : q.error ? <Problem error={q.error} retry={() => q.refetch()} /> : q.data!.items.length === 0 ? <Empty icon="shield" title={t('Nothing here')} /> : (
            <ul className="list">{q.data!.items.map((s) => (
              <li key={s.id}>
                <AdminBar story={s} full onChanged={() => q.refetch()} />
                <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', marginTop: '.3rem' }}>
                  <Avatar person={s.author} size="sm" />
                  <div style={{ minWidth: 0 }}>
                    <Link to={`/stories/${s.code}`}><b>{s.title || s.text.slice(0, 70) || s.code}</b></Link> <span className="kind">{t(s.typeLabel)}</span>
                    <div className="meta">{[s.author?.username ? `@${s.author.username}` : s.author?.name, s.postedAs !== 'self' && t(`posted ${s.postedAs.replace('_', ' ')}`), s.place.name, s.languageName, fmtDate(s.createdAt, i18n.language), `${s.media.length} ${t('files')}`].filter(Boolean).join(' · ')}</div>
                    {s.text && <p className="small" style={{ margin: '.2rem 0' }}>{s.text.slice(0, 260)}{s.text.length > 260 ? '…' : ''}</p>}
                    {s.moderation?.aiExplanation?.summary && <p className={`note small ${s.moderation.aiFlag === 'RED' ? 'bad' : s.moderation.aiFlag === 'YELLOW' ? 'warn' : ''}`} style={{ margin: '.2rem 0' }}><b>AI ({s.moderation.aiScore}):</b> {s.moderation.aiExplanation.summary}
                      {(s.moderation.aiExplanation.guidelines ?? []).filter((g: any) => g.score >= 20).map((g: any) => <span key={g.key}> · {g.key} {g.score}</span>)}</p>}
                    {s.moderation?.removedReason && <p className="small dim">{t('Reason')}: {s.moderation.removedReason}</p>}
                    <div className="row small">
                      <button className="linkbtn" onClick={() => setHistory(s)}>{t('Moderation history')}</button>
                      {s.type === 'testimony' && !s.moderation?.validated && <button className="linkbtn" onClick={() => setValidate(s)}>{t('Record validation with the storyteller')}</button>}
                      {(s.type === 'testimony' || s.postedAs === 'told_by') && s.status === 'published' && <WithdrawConsent story={s} onDone={() => q.refetch()} />}
                      {s.author?.role === 'contributor' && s.authorId && <button className="linkbtn" onClick={() => setAccount({ id: s.authorId, name: s.author?.username ?? '' })}>{t('Account actions')}</button>}
                    </div>
                  </div>
                </div>
              </li>
            ))}</ul>
          )}
        </>
      )}
      {history && <History story={history} onClose={() => setHistory(null)} />}
      {validate && <ValidateDialog story={validate} onClose={() => setValidate(null)} onDone={() => { toast(t('Saved.')); void q.refetch(); }} />}
      {account && <AccountAction id={account.id} name={account.name} onClose={() => setAccount(null)} />}
    </div>
  );
}
function WithdrawConsent({ story, onDone }: { story: Story; onDone: () => void }) {
  const { t } = useTranslation();
  const { toast } = useApp();
  const [ask, setAsk] = useState(false);
  return <><button className="linkbtn" onClick={() => setAsk(true)}>{t('Withdraw consent')}</button>
    {ask && <Confirm title={t('Withdraw consent for this story?')} text={t('Use this when the storyteller asks for their story to be taken down. It is removed from public view at once.')} needReason={t('Note')} yes={t('Withdraw and remove')} danger onClose={() => setAsk(false)} onYes={async (reason) => { try { await post(`/admin/stories/${story.id}/withdraw-consent`, { reason }); toast(t('Consent withdrawn.')); onDone(); } catch (e: any) { toast(e.message, 'error'); } }} />}</>;
}
function History({ story, onClose }: { story: Story; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const q = useQuery({ queryKey: ['history', story.id], queryFn: () => get<any[]>(`/admin/stories/${story.id}/history`) });
  return (
    <Dialog title={`${t('Moderation history')} · ${story.code}`} onClose={onClose} wide>
      {q.isLoading ? <Skeleton lines={3} /> : !q.data?.length ? <p className="dim">{t('No decisions recorded yet.')}</p> : (
        <ul className="list">{q.data.map((h, i) => <li key={h.id ?? i}><b>{h.action ?? h.decision ?? h.kind}</b> {h.flag && <span className={`flag ${h.flag}`}>{h.flag}</span>} <span className="meta">{h.adminName ?? h.actorName ?? (h.byAi || h.source === 'ai' ? 'AI' : '')} · {fmtDate(h.createdAt, i18n.language, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>{(h.reason || h.justification || h.summary) && <p className="small" style={{ margin: 0 }}>{h.reason || h.justification || h.summary}</p>}</li>)}</ul>
      )}
    </Dialog>
  );
}
function ValidateDialog({ story, onClose, onDone }: { story: Story; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const { toast } = useApp();
  const [f, setF] = useState({ storyteller: story.toldBy ?? '', consentType: 'written', consentDate: new Date().toISOString().slice(0, 10), noDownloads: false });
  return (
    <Dialog title={t('Validation with the storyteller')} onClose={onClose}>
      <p className="small dim">{t('A testimony is published only when its consent record is complete and the storyteller has confirmed how their contribution is represented.')}</p>
      <label className="field"><span>{t('Storyteller')}</span><input type="text" value={f.storyteller} onChange={(e) => setF({ ...f, storyteller: e.target.value })} /></label>
      <div className="grid2">
        <label className="field"><span>{t('Type of consent')}</span><select value={f.consentType} onChange={(e) => setF({ ...f, consentType: e.target.value })}><option value="written">{t('Written')}</option><option value="recorded">{t('Recorded')}</option><option value="guardian">{t('Parent or guardian')}</option></select></label>
        <label className="field"><span>{t('Date of consent')}</span><input type="date" value={f.consentDate} onChange={(e) => setF({ ...f, consentDate: e.target.value })} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={f.noDownloads} onChange={(e) => setF({ ...f, noDownloads: e.target.checked })} /><span>{t('The storyteller does not want downloads')}</span></label>
      <div className="actions"><button className="btn quiet" onClick={onClose}>{t('Cancel')}</button><button className="btn primary" onClick={async () => { try { await post(`/admin/stories/${story.id}/validate`, { storyteller: f.storyteller.trim() || undefined, consentType: f.consentType, consentDate: f.consentDate || undefined, restrictions: { noDownloads: f.noDownloads } }); onDone(); onClose(); } catch (e: any) { toast(e.message, 'error'); } }}>{t('Confirm validation')}</button></div>
    </Dialog>
  );
}
function Held({ kind }: { kind: 'comments' | 'messages' }) {
  const { t } = useTranslation();
  const { toast } = useApp();
  const q = useQuery({ queryKey: ['moderation', 'held', kind], queryFn: () => get<any[]>(`/admin/held/${kind}`) });
  const [block, setBlock] = useState<any>(null);
  const decide = async (id: string, allow: boolean, reason?: string) => { try { await post(`/admin/held/${kind}/${id}`, { allow, reason }); toast(allow ? t('Allowed.') : t('Blocked.')); void q.refetch(); } catch (e: any) { toast(e.message, 'error'); } };
  if (q.isLoading) return <Skeleton lines={3} />;
  if (q.error) return <Problem error={q.error} retry={() => q.refetch()} />;
  return q.data!.length === 0 ? <Empty icon="comment" title={kind === 'comments' ? t('No comments are waiting') : t('No messages are waiting')} /> : (
    <ul className="list">{q.data!.map((x) => (
      <li key={x.id}><span className={`flag ${x.aiFlag ?? 'none'}`}>{x.aiFlag ?? '—'}</span> <b>{x.author?.username ? `@${x.author.username}` : x.author?.name}</b> <span className="meta">{ago(x.createdAt, t)}{x.storyCode && <> · <Link to={`/stories/${x.storyCode}`}>{x.storyCode}</Link></>}</span>
        <p style={{ margin: '.2rem 0', whiteSpace: 'pre-wrap' }}>{x.body}</p>{x.aiExplanation?.summary && <p className="small dim" style={{ margin: 0 }}>AI: {x.aiExplanation.summary}</p>}
        <div className="row"><button className="btn small primary" onClick={() => void decide(x.id, true)}>{t('Allow')}</button><button className="btn small" onClick={() => setBlock(x)}>{t('Keep blocked')}</button></div></li>
    ))}{block && <Confirm title={t('Keep this blocked?')} needReason={t('Reason (shown to the sender)')} yes={t('Keep blocked')} onClose={() => setBlock(null)} onYes={(reason) => decide(block.id, false, reason)} />}</ul>
  );
}

// ---------- Reports queue and account actions ----------
export function AccountAction({ id, name, onClose, report }: { id: string; name: string; onClose: () => void; report?: { type: string; targetId: string; onDone: () => void; allowDrop: boolean } }) {
  const { t } = useTranslation();
  const { toast } = useApp();
  const [action, setAction] = useState(report ? 'dismiss' : 'warn'); const [reason, setReason] = useState(''); const [days, setDays] = useState(7); const [busy, setBusy] = useState(false);
  const options: Array<[string, string]> = [...(report ? [['dismiss', t('Dismiss the report')] as [string, string]] : []), ['warn', t('Warn the account holder')], ...(report?.allowDrop ? [['drop', t('Drop the story')] as [string, string]] : []), ['suspend', t('Suspend for a set period')], ['delete', t('Delete the account permanently (needs approval)')]];
  return (
    <Dialog title={report ? t('Act on this report') : t('Account actions for {name}', { name: name ? `@${name}` : '' })} onClose={onClose}>
      <fieldset style={{ border: 0, padding: 0 }}><legend className="sr">{t('Action')}</legend>{options.map(([k, label]) => <label key={k} className="check"><input type="radio" name="act" checked={action === k} onChange={() => setAction(k)} /><span>{label}</span></label>)}</fieldset>
      {action === 'suspend' && <label className="field"><span>{t('Days')}</span><input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} /></label>}
      <label className="field"><span>{action === 'dismiss' ? t('Reason (internal)') : t('Reason (the account holder is told)')}</span><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <div className="actions"><button className="btn quiet" onClick={onClose}>{t('Cancel')}</button>
        <button className={`btn primary ${action === 'delete' ? 'danger' : ''}`} disabled={busy || reason.trim().length < 3} onClick={async () => {
          setBusy(true);
          try { const body = { action, reason: reason.trim(), days: action === 'suspend' ? days : undefined }; const r = report ? await post(`/admin/reports/${report.type}/${report.targetId}/action`, body) : await post(`/admin/accounts/${id}/action`, body); toast(r?.message ?? t('Done.')); report?.onDone(); onClose(); }
          catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
        }}>{t('Confirm')}</button></div>
    </Dialog>
  );
}
function Reports() {
  const { t } = useTranslation();
  const { toast } = useApp();
  const [status, setStatus] = useState('open');
  const q = useQuery({ queryKey: ['reports', status], queryFn: () => get<any[]>('/admin/reports', { status }) });
  const [act, setAct] = useState<any>(null); const [note, setNote] = useState<Record<string, string>>({});
  return (
    <div>
      <div className="row" style={{ marginBottom: '.6rem' }}>{[['open', t('Open')], ['resolved', t('Resolved')], ['dismissed', t('Dismissed')]].map(([k, label]) => <button key={k} className={`chip ${status === k ? 'on' : ''}`} aria-pressed={status === k} onClick={() => setStatus(k)}>{label}</button>)}</div>
      {q.isLoading ? <Skeleton /> : q.error ? <Problem error={q.error} retry={() => q.refetch()} /> : q.data!.length === 0 ? <Empty icon="flag" title={t('No reports here')} /> : (
        <ul className="list">{q.data!.map((r) => {
          const k = `${r.targetType}:${r.targetId}`;
          return (
            <li key={k}>
              <div className="row between"><span><span className="kind">{t(r.targetType === 'user' ? 'Contributor' : r.targetType === 'story' ? 'Story' : 'Comment')}</span> <b>{r.targetType === 'story' ? <Link to={`/stories/${r.target?.code}`}>{r.target?.title || r.target?.code}</Link> : r.targetType === 'user' ? `@${r.target?.username ?? r.target?.name ?? ''}` : r.target?.excerpt}</b> {r.urgent && <span className="flag RED">{t('Urgent')}</span>} {r.escalated && <span className="flag YELLOW">{t('Escalated')}</span>}</span><span className="meta">{t('{n} reports', { n: r.count })} · {ago(r.lastAt, t)}</span></div>
              {r.target?.excerpt && r.targetType !== 'comment' && <p className="small" style={{ margin: '.2rem 0' }}>{r.target.excerpt}</p>}
              <ul className="small">{r.reports.map((x: any) => <li key={x.id}><b>{x.reporter?.username ? `@${x.reporter.username}` : x.reporter?.name ?? t('Someone')}</b>: {(x.reasons ?? []).map((y: string) => t(y)).join(', ')}{x.description && <> · “{x.description}”</>}{x.action && <> · <i>{x.action}</i></>}</li>)}</ul>
              {r.notes?.length > 0 && <ul className="small dim">{r.notes.map((n: any, i: number) => <li key={i}>{n.adminName ?? n.by ?? ''}: {n.note ?? n.text}</li>)}</ul>}
              <div className="row">
                {status === 'open' && <button className="btn small primary" onClick={() => setAct(r)}>{t('Act on this report')}</button>}
                <input type="text" className="grow" value={note[k] ?? ''} onChange={(e) => setNote({ ...note, [k]: e.target.value })} placeholder={t('Internal note')} aria-label={t('Internal note')} />
                <button className="btn small" disabled={!(note[k] ?? '').trim()} onClick={async () => { try { await post(`/admin/reports/${r.targetType}/${r.targetId}/notes`, { note: note[k].trim() }); setNote({ ...note, [k]: '' }); void q.refetch(); } catch (e: any) { toast(e.message, 'error'); } }}>{t('Add note')}</button>
              </div>
            </li>
          );
        })}</ul>
      )}
      {act && <AccountAction id={act.target?.authorId ?? act.targetId} name="" onClose={() => setAct(null)} report={{ type: act.targetType, targetId: act.targetId, allowDrop: act.targetType === 'story', onDone: () => q.refetch() }} />}
    </div>
  );
}

// ---------- Safety concerns ----------
function Safety() {
  const { t, i18n } = useTranslation();
  const { toast } = useApp();
  const q = useQuery({ queryKey: ['safety'], queryFn: () => get<any[]>('/admin/safety-concerns') });
  const [edit, setEdit] = useState<Record<string, { note: string; referral: string }>>({});
  const upd = async (id: string, body: Record<string, any>) => { try { await api(`/admin/safety-concerns/${id}`, { method: 'PATCH', body }); toast(t('Saved.')); setEdit({ ...edit, [id]: { note: '', referral: '' } }); void q.refetch(); } catch (e: any) { toast(e.message, 'error'); } };
  if (q.isLoading) return <Skeleton />;
  if (q.error) return <Problem error={q.error} retry={() => q.refetch()} />;
  return q.data!.length === 0 ? <Empty icon="warning" title={t('No safety concerns')} /> : (
    <ul className="list">{q.data!.map((c) => {
      const e = edit[c.id] ?? { note: '', referral: '' };
      return (
        <li key={c.id}>
          <div className="row between"><span><b>{c.code}</b> · {c.placeName || t('No place given')} {c.overdue && <span className="flag RED">{t('Overdue')}</span>}</span>
            <select value={c.status} onChange={(ev) => void upd(c.id, { status: ev.target.value })} aria-label={t('Status')}><option value="new">{t('New')}</option><option value="acknowledged">{t('Acknowledged')}</option><option value="referred">{t('Referred')}</option><option value="closed">{t('Closed')}</option></select></div>
          <p style={{ margin: '.2rem 0', whiteSpace: 'pre-wrap' }}>{c.description}</p>
          <div className="meta">{fmtDate(c.createdAt, i18n.language, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}{c.reporterUsername && c.shareIdentity && <> · @{c.reporterUsername}</>}{c.contact && <> · {c.contact}</>}{c.latitude != null && <> · {c.latitude}, {c.longitude}</>}</div>
          {c.photo?.urls && <img src={c.photo.urls.medium ?? c.photo.urls.thumb} alt={t('Photo sent with the concern')} style={{ maxWidth: 240, borderRadius: 10, display: 'block', margin: '.3rem 0' }} loading="lazy" />}
          {c.referral && <p className="note small" style={{ margin: '.2rem 0' }}><b>{t('Referred to')}:</b> {c.referral}</p>}
          {(c.notes ?? []).length > 0 && <ul className="small dim">{c.notes.map((n: any, i: number) => <li key={i}>{n.by ?? n.adminName ?? ''} {n.at ? `(${fmtDate(n.at, i18n.language)})` : ''}: {n.note ?? n.text}</li>)}</ul>}
          <div className="grid2">
            <input type="text" value={e.note} onChange={(ev) => setEdit({ ...edit, [c.id]: { ...e, note: ev.target.value } })} placeholder={t('Internal note')} aria-label={t('Internal note')} />
            <input type="text" value={e.referral} onChange={(ev) => setEdit({ ...edit, [c.id]: { ...e, referral: ev.target.value } })} placeholder={t('Referred to (authority, date, reference)')} aria-label={t('Record of referral')} />
          </div>
          <button className="btn small" style={{ marginTop: '.3rem' }} disabled={!e.note.trim() && !e.referral.trim()} onClick={() => void upd(c.id, { note: e.note.trim() || undefined, referral: e.referral.trim() || undefined, status: e.referral.trim() && c.status !== 'closed' ? 'referred' : undefined })}>{t('Save')}</button>
        </li>
      );
    })}</ul>
  );
}

// ---------- Approvals ----------
export function Approvals({ superAdmin }: { superAdmin?: boolean }) {
  const { t, i18n } = useTranslation();
  const { toast } = useApp();
  const qc = useQueryClient();
  const [status, setStatus] = useState('open');
  const q = useQuery({ queryKey: ['approvals', status], queryFn: () => get<any[]>('/admin/approvals', { status }) });
  const [act, setAct] = useState<null | { r: any; vote: 'approve' | 'reject' | 'changes' | 'resubmit' | 'decide-yes' | 'decide-no' }>(null);
  const [why, setWhy] = useState(''); const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!act) return; setBusy(true);
    try {
      const j = { justification: why.trim() };
      const r = act.vote === 'resubmit' ? await post(`/admin/approvals/${act.r.id}/resubmit`, j) : act.vote.startsWith('decide') ? await post(`/super/approvals/${act.r.id}/decide`, { approve: act.vote === 'decide-yes', ...j }) : await post(`/admin/approvals/${act.r.id}/vote`, { vote: act.vote, ...j });
      toast(r?.message ?? t('Recorded.')); setAct(null); setWhy(''); void qc.invalidateQueries({ queryKey: ['approvals'] }); void qc.invalidateQueries({ queryKey: ['notifications'] });
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <div>
      <div className="row" style={{ marginBottom: '.6rem' }}>{[['open', t('Waiting')], ['approved', t('Approved')], ['rejected', t('Rejected')]].map(([k, label]) => <button key={k} className={`chip ${status === k ? 'on' : ''}`} aria-pressed={status === k} onClick={() => setStatus(k)}>{label}</button>)}</div>
      {q.isLoading ? <Skeleton /> : q.error ? <Problem error={q.error} retry={() => q.refetch()} /> : q.data!.length === 0 ? <Empty icon="check" title={t('No approval requests here')} /> : (
        <ul className="list">{q.data!.map((r) => (
          <li key={r.id}>
            <div className="row between"><span><span className="kind">{t(r.typeLabel)}</span> <b>{r.title}</b></span><span className="meta">{r.progress} · {t(r.status.replace('_', ' '))}</span></div>
            <p className="small" style={{ margin: '.2rem 0' }}><b>{r.proposerName}</b>: {r.justification}</p>
            <div className="meta">{t('Asked {when}', { when: ago(r.createdAt, t) })} · {t('Decide by {date}', { date: fmtDate(r.deadline, i18n.language) })} · {t(r.rule === 'unanimous' ? 'All admins must approve' : 'Two-thirds of admins must approve')}</div>
            {r.votes.length > 0 && <ul className="small">{r.votes.map((v: any, i: number) => <li key={i}><b>{v.adminName}</b>: {t(v.vote === 'approve' ? 'Approved' : v.vote === 'reject' ? 'Rejected' : 'Asked for changes')} · “{v.justification}”</li>)}</ul>}
            <div className="row" style={{ marginTop: '.3rem' }}>
              {!superAdmin && r.status === 'pending' && !r.mine && !r.myVote && <><button className="btn small primary" onClick={() => setAct({ r, vote: 'approve' })}>{t('Approve')}</button><button className="btn small" onClick={() => setAct({ r, vote: 'reject' })}>{t('Reject')}</button><button className="btn small quiet" onClick={() => setAct({ r, vote: 'changes' })}>{t('Request changes')}</button></>}
              {!superAdmin && r.mine && r.status === 'changes_requested' && <button className="btn small primary" onClick={() => setAct({ r, vote: 'resubmit' })}>{t('Answer and restart voting')}</button>}
              {r.mine && r.status === 'pending' && <span className="small dim">{t('Your request. Waiting for the other admins.')}</span>}
              {r.myVote && <span className="small dim">{t('You voted')}: {t(r.myVote)}</span>}
              {superAdmin && r.status === 'overdue' && <><button className="btn small primary" onClick={() => setAct({ r, vote: 'decide-yes' })}>{t('Approve')}</button><button className="btn small" onClick={() => setAct({ r, vote: 'decide-no' })}>{t('Reject')}</button></>}
            </div>
          </li>
        ))}</ul>
      )}
      {act && (
        <Dialog title={`${t({ approve: 'Approve', reject: 'Reject', changes: 'Request changes', resubmit: 'Answer and restart voting', 'decide-yes': 'Approve', 'decide-no': 'Reject' }[act.vote])}: ${act.r.title}`} onClose={() => setAct(null)}>
          {act.r.type === 'override' && act.vote === 'approve' && <p className="note bad small"><b>{t('Overrides are irreversible.')}</b> {t('They feed into the AI review guidance and may weaken it. Override only when you are certain.')}</p>}
          <label className="field"><span>{t('Written justification (required)')}</span><textarea rows={3} value={why} onChange={(e) => setWhy(e.target.value)} /></label>
          <div className="actions"><button className="btn quiet" onClick={() => setAct(null)}>{t('Cancel')}</button><button className="btn primary" disabled={busy || why.trim().length < 3} onClick={send}>{t('Confirm')}</button></div>
        </Dialog>
      )}
    </div>
  );
}

// ---------- Audit log ----------
export function AuditLog({ all }: { all?: boolean }) {
  const { t, i18n } = useTranslation();
  const [f, setF] = useState({ q: '', action: '' });
  const q = useQuery({ queryKey: ['audit', f], queryFn: () => get<{ items: any[] }>('/admin/audit-log', f) });
  const actions = useMemo(() => [...new Set((q.data?.items ?? []).map((x) => x.action))].sort(), [q.data]);
  useEffect(() => undefined, []);
  return (
    <div>
      <p className="dim small">{all ? t('Every recorded action. The log cannot be edited or deleted.') : t('Your own actions. The log cannot be edited or deleted.')}</p>
      <div className="grid2" style={{ marginBottom: '.6rem' }}>
        <label className="field"><span>{t('Search')}</span><input type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></label>
        <label className="field"><span>{t('Action')}</span><select value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })}><option value="">{t('All actions')}</option>{actions.map((a) => <option key={a}>{a}</option>)}</select></label>
      </div>
      {q.isLoading ? <Skeleton /> : q.error ? <Problem error={q.error} retry={() => q.refetch()} /> : (
        <div className="scroll-x"><table className="table"><thead><tr><th>{t('When')}</th><th>{t('Who')}</th><th>{t('Action')}</th><th>{t('What happened')}</th></tr></thead>
          <tbody>{q.data!.items.map((x) => <tr key={x.id} style={{ cursor: 'default' }}><td className="small">{fmtDate(x.createdAt, i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td className="small">{x.actorName}</td><td className="small"><code>{x.action}</code></td><td className="small">{x.summary}{x.reason && <span className="dim"> · {x.reason}</span>}</td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}
export type { Person };
export const useGo = () => useNavigate();
