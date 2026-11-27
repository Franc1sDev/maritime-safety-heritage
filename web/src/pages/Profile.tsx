import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, get, Person, post } from '../lib/api';
import { Me, Settings, useApp, useSaveSettings } from '../lib/app';
import { queued, store } from '../lib/offline';
import { Icon } from '../components/Icon';
import { replayGuide } from '../components/Guide';
import type { Story } from '../components/Story';
import { ago, Avatar, compact, Confirm, Dialog, Empty, fmtDate, Problem, Skeleton } from '../components/ui';
import { FeedbackForm } from './About';
import { ProfileSetup } from './Auth';
import { AskWhy } from './Share';

export default function Profile() {
  const { t } = useTranslation();
  const { me, need, signOut } = useApp();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const part = pathname.split('/')[2] || 'profile';
  useEffect(() => { if (!me) need(); }, [me, need]);
  if (!me) return <Empty icon="profile" title={t('Sign in to see your profile')} />;
  const team = me.role !== 'contributor', sup = me.role === 'super_admin';
  const tabs = [['profile', 'profile', t('Profile')], ...(!sup ? [['stories', 'stories', t('My Stories')], ['drafts', 'edit', t('Drafts')]] : []), ...(!team ? [['reminders', 'calendar', t('Reminders')]] : []), ['notifications', 'bell', t('Notifications')],
    ['settings', 'settings', t('Settings')], ...(team ? [['security', 'shield', t('Sign-in and security')]] : []), ['data', 'download', t('Download my data')], ['delete', 'trash', t('Delete account')]];
  return (
    <div>
      <div className="panel-head"><h1 style={{ margin: 0 }}>{t('My Profile')}</h1><button className="btn small quiet" onClick={() => void signOut().then(() => nav('/'))}><Icon name="signin" size={15} />{t('Sign out')}</button></div>
      <nav className="subtabs" aria-label={t('My Profile')}>{tabs.map(([k, icon, label]) => <Link key={k} to={k === 'profile' ? '/profile' : `/profile/${k}`} className={`tab ${part === k ? 'on' : ''}`} aria-current={part === k ? 'page' : undefined}><Icon name={icon} />{label}</Link>)}</nav>
      {part === 'profile' && <Card me={me} />}
      {part === 'stories' && <MyStories />}
      {part === 'drafts' && <Drafts />}
      {part === 'reminders' && <Reminders />}
      {part === 'notifications' && <Notifications />}
      {part === 'settings' && <SettingsPart />}
      {part === 'security' && team && <Security />}
      {part === 'data' && <MyData />}
      {part === 'delete' && <DeleteAccount />}
    </div>
  );
}

function Card({ me }: { me: Me }) {
  const { t } = useTranslation();
  const [edit, setEdit] = useState(false);
  const team = me.role !== 'contributor';
  return (
    <div>
      <div className="row" style={{ gap: '1rem' }}>
        <Avatar person={me} size="lg" />
        <div>
          <h2 style={{ margin: 0 }}>{me.username && !team ? `@${me.username}` : me.name} {me.badge && <span className="badge">{me.badge}</span>}</h2>
          <p className="meta" style={{ margin: 0 }}>{team ? [me.admin?.adminId, me.email].filter(Boolean).join(' · ') : `${t('{n} stories', { n: me.storyCount })} · ${t('{n} followers', { n: me.followers })} · ${t('{n} following', { n: me.following })}`}</p>
          {!team && <p className="meta" style={{ margin: 0 }}>{t('Signed in with {provider}', { provider: me.provider === 'apple' ? 'Apple' : 'Google' })} · {me.email}</p>}
        </div>
      </div>
      {team ? <p className="note small" style={{ marginTop: '1rem' }}>{t('Your admin name, Admin ID and profile image cannot be changed. You can change your verification email, password and second sign-in step under “Sign-in and security”.')}</p>
        : edit ? <div className="card" style={{ marginTop: '1rem' }}><h3 style={{ marginTop: 0 }}>{t('Change my profile')}</h3><ProfileSetup editing onDone={() => setEdit(false)} /></div>
        : <p style={{ marginTop: '1rem' }}><button className="btn" onClick={() => setEdit(true)}><Icon name="edit" size={17} />{t('Change my profile')}</button> {me.username && <Link className="btn quiet" to={`/contributors/${me.username}`}>{t('See my public profile')}</Link>}</p>}
      {me.warnings > 0 && <p className="note warn small">{t('Your account has {n} warning(s) from the admins.', { n: me.warnings })}</p>}
      {!team && <Following />}
    </div>
  );
}
function Following() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['following'], queryFn: () => get<Array<{ person: Person }>>('/me/following') });
  if (!q.data?.length) return null;
  return <section><h3>{t('People I follow')}</h3><div className="row">{q.data.map(({ person }) => <Link key={person.id} className="chip" to={`/contributors/${person.username}`}><Avatar person={person} size="sm" />@{person.username}</Link>)}</div></section>;
}

const STATUS: Record<string, string> = { draft: 'Draft', reviewing: 'Being checked', pending_review: 'Waiting for admin review', published: 'Published', blocked: 'Blocked', removed: 'Removed by an admin', awaiting_approval: 'Waiting for approval', awaiting_validation: 'Waiting for validation', deleted: 'Deleted' };
function MyStories() {
  const { t, i18n } = useTranslation();
  const { toast } = useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['my-stories'], queryFn: () => get<Story[]>('/me/stories') });
  const [del, setDel] = useState<Story | null>(null); const [why, setWhy] = useState<Story | null>(null);
  if (q.isLoading) return <Skeleton />;
  if (q.error) return <Problem error={q.error} retry={() => q.refetch()} />;
  const list = q.data!.filter((s) => s.status !== 'draft');
  return (
    <div>
      <div className="row between"><h2>{t('My Stories')}</h2><button className="btn primary small" onClick={() => nav('/?share=1')}><Icon name="plus" size={15} />{t('Add a new story')}</button></div>
      {list.length === 0 ? <Empty title={t('You have not shared a story yet')}><button className="btn primary" onClick={() => nav('/?share=1')}>{t('Share my story')}</button></Empty> : (
        <ul className="list">{list.map((s) => (
          <li key={s.id}>
            <div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <div style={{ minWidth: 0 }}>
                {s.status === 'published' ? <Link to={`/stories/${s.code}`}><b>{s.title || s.text.slice(0, 60) || s.code}</b></Link> : <b>{s.title || s.text.slice(0, 60) || s.code}</b>}
                <div className="meta">{s.code} · {t(STATUS[s.status] ?? s.status)}{s.moderation?.aiFlag && <> · <span className={`flag ${s.moderation.aiFlag}`}>{s.moderation.aiFlag}</span></>} · {fmtDate(s.publishedAt ?? s.createdAt, i18n.language)}{s.moderation?.pendingEdit && <> · {t('edit being checked')}</>}</div>
                <div className="row small" style={{ gap: '.8rem' }} aria-label={t('Engagement')}>
                  <span title={t('Views')}><Icon name="eye" size={14} /> {compact(s.counts.views ?? 0)}</span><span title={t('Hearts')}><Icon name="heart" size={14} /> {s.counts.hearts}</span><span title={t('Heartbreaks')}><Icon name="heartbreak" size={14} /> {s.counts.heartbreaks}</span><span title={t('Laughs')}><Icon name="laugh" size={14} /> {s.counts.laughs}</span>
                  <span title={t('Comments')}><Icon name="comment" size={14} /> {s.counts.comments}</span><span title={t('Shares')}><Icon name="share" size={14} /> {s.counts.shares + s.counts.links}</span><span title={t('Favorites')}><Icon name="star" size={14} /> {s.counts.favourites}</span><span title={t('Downloads')}><Icon name="download" size={14} /> {s.counts.downloads ?? 0}</span>
                </div>
                {['removed', 'blocked'].includes(s.status) && <p className="note bad small" style={{ margin: '.3rem 0 0' }}>{s.status === 'removed' ? t('An admin removed this story.') : t('This story was blocked.')} {s.moderation?.removedReason} <button className="btn small" onClick={() => setWhy(s)}>{t('Ask Why')}</button></p>}
                {s.status === 'pending_review' && s.moderation?.aiFlag === 'RED' && <p className="note bad small" style={{ margin: '.3rem 0 0' }}>{s.moderation.aiExplanation?.summary} <button className="btn small" onClick={() => setWhy(s)}>{t('Ask Why')}</button></p>}
                {s.status === 'published' && s.moderation?.aiFlag === 'YELLOW' && s.moderation.aiExplanation?.summary && <p className="note warn small" style={{ margin: '.3rem 0 0' }}>{s.moderation.aiExplanation.summary}</p>}
              </div>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                {['published', 'pending_review'].includes(s.status) && <button className="xbtn" onClick={() => nav(`/?share=${s.id}`)} aria-label={t('Edit story')} title={t('Edit story')}><Icon name="edit" size={17} /></button>}
                <button className="xbtn" onClick={() => setDel(s)} aria-label={t('Delete story')} title={t('Delete story')}><Icon name="trash" size={17} /></button>
              </div>
            </div>
          </li>
        ))}</ul>
      )}
      {del && <Confirm title={t('Delete this story? This cannot be undone.')} text={t('It is removed at once and erased permanently after 30 days.')} yes={t('Delete')} danger onClose={() => setDel(null)} onYes={async () => { try { const r = await api(`/stories/${del.id}`, { method: 'DELETE' }); toast(r?.message ?? t('Story deleted.')); void qc.invalidateQueries({ queryKey: ['my-stories'] }); void qc.invalidateQueries({ queryKey: ['stories'] }); } catch (e: any) { toast(e.message, 'error'); } }} />}
      {why && <AskWhy storyId={why.id} onClose={() => setWhy(null)} />}
    </div>
  );
}
function Drafts() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const { toast } = useApp();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['my-stories', 'draft'], queryFn: () => get<Story[]>('/me/stories', { status: 'draft' }) });
  const [local, setLocal] = useState<any>(null); const [waiting, setWaiting] = useState<any[]>([]);
  useEffect(() => { void store.get('drafts', 'new').then(setLocal); void queued().then(setWaiting); }, []);
  const drafts = (q.data ?? []).filter((s) => s.status === 'draft');
  return (
    <div>
      <h2>{t('Drafts')}</h2>
      {local?.form && (local.form.text || local.form.title) && <div className="card" style={{ marginBottom: '.6rem' }}><b>{local.form.title || local.form.text.slice(0, 60)}</b><div className="meta">{local.waiting ? t('Waiting to send') : t('Saved on this device')} · {ago(new Date(local.at), t)}</div>
        <div className="row"><button className="btn small primary" onClick={() => nav('/?share=1')}>{t('Continue')}</button><button className="btn small quiet" onClick={() => { void store.del('drafts', 'new'); setLocal(null); }}>{t('Discard')}</button></div></div>}
      {waiting.length > 0 && <div className="note small" style={{ marginBottom: '.6rem' }}><b>{t('Waiting to send')}</b><ul>{waiting.map((w) => <li key={w.id}>{w.label} · {ago(new Date(w.at), t)}</li>)}</ul></div>}
      {q.isLoading ? <Skeleton lines={2} /> : drafts.length === 0 && !local?.form ? <Empty icon="edit" title={t('No drafts')}><p>{t('Unfinished stories you save appear here.')}</p></Empty> : (
        <ul className="list">{drafts.map((s) => <li key={s.id} className="row between"><span><b>{s.title || s.text.slice(0, 60) || t('Untitled draft')}</b><span className="meta" style={{ display: 'block' }}>{fmtDate(s.createdAt, i18n.language)} · {t('{n} files', { n: s.media.length })}</span></span>
          <span className="row"><button className="btn small primary" onClick={() => nav(`/?share=${s.id}`)}>{t('Continue')}</button><button className="xbtn" aria-label={t('Delete draft')} onClick={async () => { try { await api(`/stories/${s.id}`, { method: 'DELETE' }); void qc.invalidateQueries({ queryKey: ['my-stories'] }); } catch (e: any) { toast(e.message, 'error'); } }}><Icon name="trash" size={16} /></button></span></li>)}</ul>
      )}
    </div>
  );
}

export function Reminders() {
  const { t, i18n } = useTranslation();
  const { toast } = useApp();
  const q = useQuery({ queryKey: ['reminders'], queryFn: () => get<any[]>('/me/reminders') });
  const [edit, setEdit] = useState<null | { id?: string; subject: string; description: string; dueAt: string }>(null);
  const local = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  async function save() {
    if (!edit) return;
    try { const body = { subject: edit.subject.trim(), description: edit.description.trim() || undefined, dueAt: new Date(edit.dueAt).toISOString() }; const r = edit.id ? await api(`/me/reminders/${edit.id}`, { method: 'PATCH', body }) : await post('/me/reminders', body); toast(r.message ?? t('Reminder saved.')); setEdit(null); void q.refetch(); }
    catch (e: any) { toast(e.message, 'error'); }
  }
  return (
    <div>
      <div className="row between"><h2>{t('Reminders')}</h2><button className="btn small primary" onClick={() => setEdit({ subject: '', description: '', dueAt: local(new Date(Date.now() + 86400000).toISOString()) })}><Icon name="plus" size={15} />{t('New reminder')}</button></div>
      {q.isLoading ? <Skeleton lines={2} /> : q.error ? <Problem error={q.error} retry={() => q.refetch()} /> : q.data!.length === 0 ? <Empty icon="calendar" title={t('No reminders')} /> : (
        <ul className="list">{q.data!.map((r) => (
          <li key={r.id} className="row between" style={{ opacity: r.doneAt ? 0.6 : 1 }}>
            <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={!!r.doneAt} onChange={async (e) => { await api(`/me/reminders/${r.id}/done`, { method: 'PUT', body: { on: e.target.checked } }); void q.refetch(); }} aria-label={t('Done')} />
              <span><b style={{ textDecoration: r.doneAt ? 'line-through' : undefined }}>{r.subject}</b><span className="meta" style={{ display: 'block' }}>{fmtDate(r.dueAt, i18n.language, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>{r.description && <span className="small">{r.description}</span>}</span></label>
            <span className="row"><button className="xbtn" onClick={() => setEdit({ id: r.id, subject: r.subject, description: r.description ?? '', dueAt: local(r.dueAt) })} aria-label={t('Edit')}><Icon name="edit" size={16} /></button><button className="xbtn" onClick={async () => { await api(`/me/reminders/${r.id}`, { method: 'DELETE' }); void q.refetch(); }} aria-label={t('Delete')}><Icon name="trash" size={16} /></button></span>
          </li>
        ))}</ul>
      )}
      {edit && (
        <Dialog title={edit.id ? t('Edit reminder') : t('New reminder')} onClose={() => setEdit(null)}>
          <label className="field"><span>{t('Subject')}</span><input type="text" value={edit.subject} maxLength={160} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} required /></label>
          <label className="field"><span>{t('Details (optional)')}</span><textarea rows={3} value={edit.description} maxLength={2000} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
          <label className="field"><span>{t('When')}</span><input type="datetime-local" value={edit.dueAt} onChange={(e) => setEdit({ ...edit, dueAt: e.target.value })} required /></label>
          <div className="actions"><button className="btn quiet" onClick={() => setEdit(null)}>{t('Cancel')}</button><button className="btn primary" disabled={!edit.subject.trim() || !edit.dueAt} onClick={save}>{t('Save')}</button></div>
        </Dialog>
      )}
    </div>
  );
}

export function Notifications() {
  const { t } = useTranslation();
  const { refreshCounts } = useApp();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => get<{ items: any[] }>('/me/notifications') });
  const open = async (n: any) => { await post(`/me/notifications/${n.id}/read`).catch(() => undefined); refreshCounts(); void q.refetch(); if (n.link) nav(n.link.replace(/^https?:\/\/[^/]+/, '')); };
  return (
    <div>
      <div className="row between"><h2>{t('Notifications')}</h2>{q.data?.items.some((n) => !n.readAt) && <button className="btn small" onClick={async () => { await post('/me/notifications/read'); refreshCounts(); void q.refetch(); }}>{t('Mark all as read')}</button>}</div>
      {q.isLoading ? <Skeleton lines={3} /> : q.error ? <Problem error={q.error} retry={() => q.refetch()} /> : q.data!.items.length === 0 ? <Empty icon="bell" title={t('Nothing new')} /> : (
        <ul className="list">{q.data!.items.map((n) => (
          <li key={n.id}><button className="pick" onClick={() => void open(n)} style={{ alignItems: 'flex-start' }}>
            <span className="grow"><b>{!n.readAt && <span className="dot" aria-label={t('Unread')} />} {n.title}</b>{n.priority && !n.doneAt && <span className="kind" style={{ marginInlineStart: 6 }}>{t('Needs your action')}</span>}<span style={{ display: 'block' }} className="small">{n.body}</span><span className="meta">{ago(n.createdAt, t)}</span></span>
          </button></li>
        ))}</ul>
      )}
    </div>
  );
}

function SettingsPart() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const { me, config, toast } = useApp();
  const save = useSaveSettings();
  const s = me!.settings;
  const blocked = useQuery({ queryKey: ['blocked'], queryFn: () => get<Array<{ kind: string; person: Person }>>('/me/blocked'), enabled: me!.role !== 'super_admin' });
  const set = (patch: Partial<Settings> & { language?: string; theme?: string }) => void save(patch, true);
  const groups: Array<[string, string]> = [['engagement', t('Reactions, comments, mentions and follows')], ['messages', t('Messages')], ['announcements', t('Announcements')], ['reminders', t('Reminders')]];
  async function enablePush() {
    try {
      if (!config?.vapidPublicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) return toast(t('Push notifications are not available in this browser or on this server yet.'), 'info');
      if ((await Notification.requestPermission()) !== 'granted') return toast(t('Notifications are turned off for this site in your browser.'), 'info');
      const reg = await navigator.serviceWorker.ready;
      const key = Uint8Array.from(atob(config.vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
      await post('/me/push-tokens', { platform: 'web', token: JSON.stringify(sub) });
      toast(t('Push notifications are on for this browser.'));
    } catch (e: any) { toast(e.message, 'error'); }
  }
  return (
    <div className="stack">
      <h2>{t('Settings')}</h2>
      <section className="card"><h3 style={{ marginTop: 0 }}>{t('Appearance')}</h3>
        <div className="grid2">
          <label className="field"><span>{t('Theme')}</span><select value={me!.theme} onChange={(e) => set({ theme: e.target.value })}><option value="auto">{t('Auto (follow my device)')}</option><option value="light">{t('Light')}</option><option value="dark">{t('Dark')}</option></select></label>
          <label className="field"><span>{t('Text size')}</span><select value={s.textSize} onChange={(e) => set({ textSize: e.target.value as Settings['textSize'] })}><option value="small">{t('Small')}</option><option value="medium">{t('Medium')}</option><option value="large">{t('Large')}</option><option value="xlarge">{t('Extra large')}</option></select></label>
          <label className="field"><span>{t('Language')}</span><select value={i18n.language} onChange={(e) => set({ language: e.target.value })}>{config?.languages.filter((l) => l.launch).map((l) => <option key={l.code} value={l.code}>{l.nativeName ?? l.name}</option>)}</select></label>
        </div>
        <label className="check"><input type="checkbox" checked={s.highContrast} onChange={(e) => set({ highContrast: e.target.checked })} /><span>{t('High contrast')}</span></label>
        <label className="check"><input type="checkbox" checked={s.reducedMotion} onChange={(e) => set({ reducedMotion: e.target.checked })} /><span>{t('Reduce motion (fewer animations)')}</span></label>
      </section>
      <section className="card"><h3 style={{ marginTop: 0 }}>{t('Hints')}</h3>
        <p className="small">{t('A short guide to browsing, reacting, commenting and sharing a story.')}</p>
        <button className="btn" onClick={() => { replayGuide(); nav('/'); }}>{t('Show the hints again')}</button>
      </section>
      <section className="card"><h3 style={{ marginTop: 0 }}>{t('Data and connection')}</h3>
        <label className="check"><input type="checkbox" checked={s.lowData} onChange={(e) => set({ lowData: e.target.checked })} /><span>{t('Low-data mode: pictures and video load only when I select them')}</span></label>
        <label className="check"><input type="checkbox" checked={s.wifiOnly} onChange={(e) => set({ wifiOnly: e.target.checked })} /><span>{t('Upload only on Wi-Fi (apps)')}</span></label>
        <label className="check"><input type="checkbox" checked={s.readReceipts} onChange={(e) => set({ readReceipts: e.target.checked })} /><span>{t('Read receipts in messages')}</span></label>
      </section>
      <section className="card"><h3 style={{ marginTop: 0 }}>{t('Notifications')}</h3>
        <div className="scroll-x"><table className="table"><thead><tr><th scope="col">{t('About')}</th><th scope="col">{t('In the app')}</th><th scope="col">{t('Push')}</th><th scope="col">{t('Email')}</th></tr></thead>
          <tbody>{groups.map(([k, label]) => <tr key={k} style={{ cursor: 'default' }}><th scope="row" style={{ textAlign: 'start', fontWeight: 500 }}>{label}</th>{(['inApp', 'push', 'email'] as const).map((ch) => <td key={ch}><input type="checkbox" aria-label={`${label}: ${ch}`} checked={s.notifications[k]?.[ch] ?? false} onChange={(e) => set({ notifications: { ...s.notifications, [k]: { ...s.notifications[k], [ch]: e.target.checked } } })} /></td>)}</tr>)}</tbody></table></div>
        <div className="grid2">
          <label className="field"><span>{t('Quiet hours from')}</span><input type="time" value={s.quietHours.from} onChange={(e) => set({ quietHours: { ...s.quietHours, from: e.target.value } })} /></label>
          <label className="field"><span>{t('Quiet hours to')}</span><input type="time" value={s.quietHours.to} onChange={(e) => set({ quietHours: { ...s.quietHours, to: e.target.value } })} /></label>
        </div>
        <p className="small dim">{t('During quiet hours nothing is pushed to your devices; it waits in the app.')}</p>
        <button className="btn small" onClick={enablePush}><Icon name="bell" size={15} />{t('Turn on push notifications in this browser')}</button>
      </section>
      {me!.role !== 'super_admin' && <section className="card"><h3 style={{ marginTop: 0 }}>{t('Blocked and muted users')}</h3>
        {!blocked.data?.length ? <p className="dim small">{t('You have not blocked or muted anyone.')}</p> : <ul className="list">{blocked.data.map((b) => <li key={`${b.kind}${b.person.id}`} className="row between"><span className="row"><Avatar person={b.person} size="sm" />{b.person.username ? `@${b.person.username}` : b.person.name} <span className="kind">{b.kind === 'mute' ? t('Muted') : t('Blocked')}</span></span>
          <button className="btn small" onClick={async () => { await api(`/people/${b.person.id}/${b.kind === 'mute' ? 'mute' : 'block'}`, { method: 'PUT', body: { on: false } }); void blocked.refetch(); }}>{b.kind === 'mute' ? t('Unmute') : t('Unblock')}</button></li>)}</ul>}
      </section>}
      <section className="card"><h3 style={{ marginTop: 0 }}>{t('Send feedback')}</h3><FeedbackForm /></section>
    </div>
  );
}

function Security() {
  const { t, i18n } = useTranslation();
  const { me, toast, reloadMe } = useApp();
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => get<any[]>('/auth/sessions') });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', again: '' });
  const [em, setEm] = useState({ email: '', password: '', code: '', sent: false });
  const [totp, setTotp] = useState<null | { secret: string; otpauthUrl: string; code: string }>(null);
  const [removePw, setRemovePw] = useState<string | null>(null);
  const run = async (fn: () => Promise<any>, ok?: string) => { try { const r = await fn(); toast(r?.message ?? ok ?? t('Saved.')); return true; } catch (e: any) { toast(e.message, 'error'); return false; } };
  return (
    <div className="stack">
      <h2>{t('Sign-in and security')}</h2>
      <section className="card"><h3 style={{ marginTop: 0 }}>{t('Second sign-in step')}</h3>
        <p className="small">{t('A code by email is always available.')} {me!.admin?.mfaAuthenticator ? <b>{t('Your authenticator app is set up.')}</b> : t('An authenticator app is quicker and works without a connection.')}</p>
        {me!.admin?.mfaAuthenticator ? (removePw === null ? <button className="btn small" onClick={() => setRemovePw('')}>{t('Remove the authenticator app')}</button> : (
          <form className="row" onSubmit={async (e) => { e.preventDefault(); if (await run(() => post('/auth/admin/mfa/authenticator/remove', { password: removePw }))) { setRemovePw(null); void reloadMe(); } }}><input type="password" value={removePw} onChange={(e) => setRemovePw(e.target.value)} placeholder={t('Your password')} aria-label={t('Your password')} autoComplete="current-password" required /><button className="btn small danger">{t('Remove')}</button><button type="button" className="btn small quiet" onClick={() => setRemovePw(null)}>{t('Cancel')}</button></form>
        )) : totp ? (
          <form onSubmit={async (e) => { e.preventDefault(); if (await run(() => post('/auth/admin/mfa/authenticator/confirm', { code: totp.code }))) { setTotp(null); void reloadMe(); } }}>
            <p className="small">{t('Add this key to your authenticator app (Google Authenticator, Microsoft Authenticator, Authy), then enter the 6-digit code it shows.')}</p>
            <p><code style={{ overflowWrap: 'anywhere', fontSize: '1.05rem' }}>{totp.secret.replace(/(.{4})/g, '$1 ')}</code> <button type="button" className="linkbtn small" onClick={() => void navigator.clipboard.writeText(totp.secret).then(() => toast(t('Copied.')))}>{t('Copy')}</button> · <a className="small" href={totp.otpauthUrl}>{t('Open in my authenticator app')}</a></p>
            <div className="row"><input type="text" inputMode="numeric" maxLength={6} value={totp.code} onChange={(e) => setTotp({ ...totp, code: e.target.value.replace(/\D/g, '') })} aria-label={t('6-digit code')} placeholder="000000" required /><button className="btn primary small" disabled={totp.code.length !== 6}>{t('Confirm')}</button></div>
          </form>
        ) : <button className="btn small primary" onClick={async () => { try { const r = await post('/auth/admin/mfa/authenticator'); setTotp({ ...r, code: '' }); } catch (e: any) { toast(e.message, 'error'); } }}>{t('Set up an authenticator app')}</button>}
      </section>
      <section className="card"><h3 style={{ marginTop: 0 }}>{t('Change password')}</h3>
        <form onSubmit={async (e) => { e.preventDefault(); if (pw.newPassword !== pw.again) return toast(t('The two passwords do not match.'), 'error'); if (await run(() => api('/auth/admin/password', { method: 'PATCH', body: { currentPassword: pw.currentPassword, newPassword: pw.newPassword } }))) setPw({ currentPassword: '', newPassword: '', again: '' }); }}>
          <div className="grid2">
            <label className="field"><span>{t('Current password')}</span><input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" required /></label>
            <label className="field"><span>{t('New password')}</span><input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" minLength={8} required /></label>
            <label className="field"><span>{t('New password again')}</span><input type="password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} autoComplete="new-password" required /></label>
          </div>
          <button className="btn small primary">{t('Change password')}</button>
        </form>
      </section>
      <section className="card"><h3 style={{ marginTop: 0 }}>{t('Change verification email')}</h3>
        <p className="small dim">{t('Current')}: {me!.email}</p>
        {!em.sent ? (
          <form onSubmit={async (e) => { e.preventDefault(); if (await run(() => post('/auth/admin/email', { email: em.email.trim(), password: em.password }), t('We sent a code to the new address.'))) setEm({ ...em, sent: true }); }}>
            <div className="grid2"><label className="field"><span>{t('New email')}</span><input type="email" value={em.email} onChange={(e) => setEm({ ...em, email: e.target.value })} required /></label><label className="field"><span>{t('Your password')}</span><input type="password" value={em.password} onChange={(e) => setEm({ ...em, password: e.target.value })} autoComplete="current-password" required /></label></div>
            <button className="btn small primary">{t('Send a code to the new address')}</button>
          </form>
        ) : (
          <form className="row" onSubmit={async (e) => { e.preventDefault(); if (await run(() => post('/auth/admin/email/confirm', { code: em.code }))) { setEm({ email: '', password: '', code: '', sent: false }); void reloadMe(); } }}>
            <input type="text" inputMode="numeric" maxLength={6} value={em.code} onChange={(e) => setEm({ ...em, code: e.target.value.replace(/\D/g, '') })} placeholder="000000" aria-label={t('Code from the new address')} required /><button className="btn small primary">{t('Confirm')}</button><button type="button" className="btn small quiet" onClick={() => setEm({ ...em, sent: false })}>{t('Back')}</button>
          </form>
        )}
      </section>
      <section className="card"><div className="row between"><h3 style={{ margin: 0 }}>{t('Where I am signed in')}</h3><button className="btn small" onClick={async () => { await run(() => post('/auth/sessions/end-all'), t('Signed out everywhere else.')); void sessions.refetch(); }}>{t('Sign out everywhere else')}</button></div>
        <ul className="list">{(sessions.data ?? []).map((s) => <li key={s.id} className="row between"><span className="small">{s.userAgent?.slice(0, 80) || t('Unknown device')}<span className="meta" style={{ display: 'block' }}>{s.ip} · {fmtDate(s.createdAt, i18n.language)}{s.current && <> · <b>{t('this device')}</b></>}</span></span>{!s.current && <button className="btn small quiet" onClick={async () => { await api(`/auth/sessions/${s.id}`, { method: 'DELETE' }); void sessions.refetch(); }}>{t('Sign out')}</button>}</li>)}</ul>
      </section>
    </div>
  );
}

function MyData() {
  const { t, i18n } = useTranslation();
  const { toast } = useApp();
  const q = useQuery({ queryKey: ['exports'], queryFn: () => get<Array<{ id: string; status: string; createdAt: string; url: string | null }>>('/me/exports'), refetchInterval: (x) => (x.state.data?.some((e) => e.status === 'preparing') ? 3000 : false) });
  return (
    <div>
      <h2>{t('Download my data')}</h2>
      <p>{t('Get a ZIP file with all your stories, comments and profile data.')}</p>
      <button className="btn primary" onClick={async () => { try { const r = await post('/me/export'); toast(r.message); void q.refetch(); } catch (e: any) { toast(e.message, 'error'); } }}><Icon name="download" size={17} />{t('Prepare my data')}</button>
      <ul className="list" style={{ marginTop: '1rem' }}>{(q.data ?? []).map((e) => <li key={e.id} className="row between"><span>{fmtDate(e.createdAt, i18n.language, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>{e.status === 'ready' && e.url ? <a className="btn small" href={e.url}>{t('Download')}</a> : e.status === 'preparing' ? <span className="dim"><span className="spinner" /> {t('Preparing…')}</span> : <span className="dim">{t(e.status === 'expired' ? 'Expired' : 'Failed')}</span>}</li>)}</ul>
    </div>
  );
}

function DeleteAccount() {
  const { t } = useTranslation();
  const { me, config, toast, signOut } = useApp();
  const nav = useNavigate();
  const [reason, setReason] = useState(''); const [other, setOther] = useState(''); const [ask, setAsk] = useState(false); const [error, setError] = useState('');
  return (
    <div>
      <h2>{t('Delete account')}</h2>
      <p className="note warn">{t('Your account and content will be removed at once and permanently erased after 30 days. To restore it, sign in again within 30 days.')}</p>
      <fieldset style={{ border: 0, padding: 0 }}><legend className="label">{t('Why are you leaving? Pick one.')}</legend>
        {config?.deletionReasons.map((r) => <label key={r.key} className="check"><input type="radio" name="why" checked={reason === r.key} onChange={() => setReason(r.key)} /><span>{r.label}</span></label>)}
      </fieldset>
      <label className="field"><span>{t('Or tell us in your own words (optional)')}</span><textarea rows={2} value={other} maxLength={500} onChange={(e) => setOther(e.target.value)} /></label>
      {error && <p className="error-text" role="alert">{error}</p>}
      <button className="btn danger" disabled={!reason && !other.trim()} onClick={() => setAsk(true)}><Icon name="trash" size={17} />{t('DELETE ACCOUNT')}</button>
      {ask && <Confirm title={t('Delete your account?')} text={t('Your account is removed at once and permanently erased after 30 days.')} yes={t('Delete my account')} danger onClose={() => setAsk(false)}
        onYes={async () => { try { const r = await post('/me/delete', { reason: reason || undefined, otherReason: other.trim() || undefined }); toast(r.message ?? t('Your account was deleted.')); await signOut(); nav('/'); } catch (e: any) { setError(e.message); } }} />}
      {me?.role === 'super_admin' && <p className="small dim">{t('The system must always have at least one Super Admin.')}</p>}
    </div>
  );
}
