import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, get, Person, post } from '../lib/api';
import { useApp, useSaveSettings } from '../lib/app';
import { sendOrQueue } from '../lib/offline';
import { uploadFile } from '../lib/upload';
import { Icon } from '../components/Icon';
import { MediaItem } from '../components/Media';
import { ago, Avatar, Confirm, Empty, Problem, Skeleton } from '../components/ui';

interface Conv { id: string; kind: string; topic: string; issueType: string | null; unread: number; lastMessage: { text: string; at: string; mine: boolean | null; system: boolean } | null; with: Person | null }
interface Msg { id: string; text: string; system: boolean; createdAt: string; mine: boolean; sender: Person | null; files: MediaItem[]; seen: boolean; waiting?: boolean }

export default function Inbox() {
  const { t } = useTranslation();
  const { me, need, refreshCounts } = useApp();
  const { pathname } = useLocation();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const save = useSaveSettings();
  const openId = /^\/inbox\/([0-9a-f-]{36})/.exec(pathname)?.[1] ?? null;
  const fresh = sp.get('new') === 'admins' ? { toAdmins: true as const } : sp.get('to') ? { toUserId: sp.get('to')!, name: sp.get('name') ?? '' } : null;
  const q = useQuery({ queryKey: ['inbox', 'list'], queryFn: () => get<{ conversations: Conv[]; requests: Conv[]; unread: number }>('/inbox'), enabled: !!me });
  useEffect(() => { if (!me) need(); }, [me, need]);
  if (!me) return <Empty icon="inbox" title={t('Sign in to see your messages')} />;
  const bubble = (c: Conv, request = false) => (
    <button key={c.id} className={`bubble ${openId === c.id ? 'on' : ''}`} onClick={() => nav(`/inbox/${c.id}`)} title={c.lastMessage?.text} aria-label={`${c.kind === 'issue' ? c.topic : c.with?.username ? `@${c.with.username}` : c.with?.name ?? ''}${c.unread ? `, ${t('{n} unread', { n: c.unread })}` : ''}${request ? `, ${t('message request')}` : ''}`}>
      <span>{c.kind === 'issue' ? c.topic : c.with?.username ? `@${c.with.username}` : c.with?.name ?? t('Conversation')}</span>
      {c.unread > 0 && <span className="count" aria-hidden="true">{c.unread}</span>}
    </button>
  );
  return (
    <div>
      <div className="panel-head"><h1 style={{ margin: 0 }}>{t('Inbox')}</h1>
        <div className="row">
          {me.role !== 'super_admin' && <button className="btn small" onClick={() => nav('/inbox?new=admins')}><Icon name="plus" size={15} />{t('Message the admins')}</button>}
          <label className="check small" style={{ margin: 0 }}><input type="checkbox" checked={me.settings.readReceipts} onChange={(e) => void save({ readReceipts: e.target.checked }, true)} /><span>{t('Read receipts')}</span></label>
        </div>
      </div>
      {q.isLoading ? <Skeleton lines={2} /> : q.error ? <Problem error={q.error} retry={() => q.refetch()} /> : (
        <>
          {q.data!.conversations.length === 0 && q.data!.requests.length === 0 && !fresh && !openId && <Empty icon="inbox" title={t('No messages yet')}><p>{t('Messages from admins and other Contributors appear here.')}</p></Empty>}
          <div className="bubbles" role="list" aria-label={t('Conversations')}>{q.data!.conversations.map((c) => bubble(c))}</div>
          {q.data!.requests.length > 0 && <><h2 className="label">{t('Requests')} <span className="dim small">{t('from people you do not follow')}</span></h2><div className="bubbles">{q.data!.requests.map((c) => bubble(c, true))}</div></>}
        </>
      )}
      {(openId || fresh) && <Thread key={openId ?? 'new'} id={openId} fresh={fresh} onChanged={() => { void q.refetch(); refreshCounts(); }} />}
    </div>
  );
}

function Thread({ id, fresh, onChanged }: { id: string | null; fresh: { toAdmins?: true; toUserId?: string; name?: string } | null; onChanged: () => void }) {
  const { t } = useTranslation();
  const { toast, socket } = useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState(''); const [topic, setTopic] = useState('');
  const [files, setFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [pending, setPending] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false); const [block, setBlock] = useState(false); const [uploading, setUploading] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const q = useQuery({ queryKey: ['inbox', 'thread', id], queryFn: () => get<{ conversation: { id: string; kind: string; topic: string; isRequest: boolean; with?: Person | null }; items: Msg[] }>(`/inbox/${id}`), enabled: !!id });
  const list = useQuery({ queryKey: ['inbox', 'list'], queryFn: () => get<{ conversations: Conv[]; requests: Conv[] }>('/inbox') });
  const conv = [...(list.data?.conversations ?? []), ...(list.data?.requests ?? [])].find((c) => c.id === id);
  const other = conv?.with ?? null;
  // Opening a conversation marks it read, and the unread count goes down.
  useEffect(() => { if (id && q.data) void post(`/inbox/${id}/read`).then(onChanged).catch(() => undefined); }, [id, q.data?.items.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [q.data?.items.length, pending.length]);
  useEffect(() => { if (!socket || !id) return; const f = (m: any) => { if (!m?.conversationId || m.conversationId === id) void q.refetch(); }; socket.on('message', f); socket.on('message.read', f); return () => { socket.off('message', f); socket.off('message.read', f); }; }, [socket, id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    if (!text.trim() && !files.length) return;
    setBusy(true);
    const body = { conversationId: id ?? undefined, toUserId: !id ? fresh?.toUserId : undefined, toAdmins: !id && fresh?.toAdmins ? true : undefined, topic: !id && fresh?.toAdmins ? topic.trim() || undefined : undefined, text: text.trim() || undefined, mediaIds: files.length ? files.map((f) => f.id) : undefined };
    try {
      const r = await sendOrQueue(t('Message'), '/inbox', 'POST', body);
      if (!r) { setPending((p) => [...p, { id: `w${Date.now()}`, text: text.trim(), system: false, createdAt: new Date().toISOString(), mine: true, sender: null, files: [], seen: false, waiting: true }]); toast(t('Waiting to send'), 'info'); }
      else if (r.held) toast(r.message ?? t('Your message is being checked before it is delivered.'), 'info');
      setText(''); setFiles([]);
      if (r && !id) nav(`/inbox/${r.conversationId}`, { replace: true }); else void q.refetch();
      void qc.invalidateQueries({ queryKey: ['inbox', 'list'] });
    } catch (e: any) { toast(e.details?.reason ? `${e.message} ${e.details.reason}` : e.message, 'error'); } finally { setBusy(false); }
  }
  async function attach(list2: FileList | null) {
    for (const file of Array.from(list2 ?? []).slice(0, 6 - files.length)) {
      setUploading((n) => n + 1);
      try { const m = await uploadFile(file, 'message', () => undefined).promise; setFiles((f) => [...f, { id: m.id, name: m.name }]); } catch (e: any) { toast(e.message, 'error'); } finally { setUploading((n) => n - 1); }
    }
  }
  const title = id ? (conv?.kind === 'issue' ? conv.topic : other?.username ? `@${other.username}` : other?.name ?? q.data?.conversation.topic ?? '') : fresh?.toAdmins ? t('New message to the admins') : t('New message to {name}', { name: fresh?.name ? `@${fresh.name}` : '' });
  const items = [...(q.data?.items ?? []), ...pending];
  return (
    <section aria-label={title}>
      <div className="row between" style={{ marginBottom: '.4rem' }}>
        <h2 style={{ margin: 0 }} className="row">{other && <Avatar person={other} size="sm" />}{title}</h2>
        <div className="row">
          {id && other?.id && other.role !== 'admin' && <button className="btn small quiet" onClick={() => setBlock(true)}><Icon name="block" size={15} />{t('Block')}</button>}
          <button className="xbtn" onClick={() => nav('/inbox')} aria-label={t('Close conversation')}><Icon name="close" size={16} /></button>
        </div>
      </div>
      {id && q.isLoading ? <Skeleton lines={3} /> : id && q.error ? <Problem error={q.error} retry={() => q.refetch()} /> : (
        <div className="thread" role="log" aria-live="polite" tabIndex={0}>
          {!id && fresh?.toAdmins && <label className="field"><span>{t('What is it about? (optional)')}</span><input type="text" value={topic} maxLength={120} onChange={(e) => setTopic(e.target.value)} /></label>}
          {items.map((m) => (
            <div key={m.id} className={`msg ${m.system ? 'system' : m.mine ? 'mine' : ''} ${m.waiting ? 'waiting' : ''}`}>
              {!m.mine && !m.system && m.sender && <b className="small">{m.sender.username ? `@${m.sender.username}` : m.sender.name}{m.sender.badge ? ` · ${m.sender.badge}` : ''}<br /></b>}
              {m.text}
              {m.files.map((f) => f.kind === 'image' ? <img key={f.id} src={f.urls.medium ?? f.urls.thumb} alt={f.altText || f.name} style={{ display: 'block', maxWidth: 220, borderRadius: 10, marginTop: 4 }} loading="lazy" /> : <a key={f.id} href={f.urls.original ?? f.urls.web} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: 'inherit' }}><Icon name="clip" size={14} /> {f.name}</a>)}
              <span className="state">{m.waiting ? t('Waiting to send') : ago(m.createdAt, t)}{m.mine && !m.waiting && !m.system ? ` · ${m.seen ? t('Seen') : t('Sent')}` : ''}</span>
            </div>
          ))}
          <div ref={end} />
        </div>
      )}
      {q.data?.conversation.isRequest ? (
        <div className="note"><p>{t('This person is not someone you follow. Accept to reply, or decline to remove the request.')}</p>
          <div className="row"><button className="btn primary" onClick={async () => { await post(`/inbox/${id}/accept`); void q.refetch(); onChanged(); }}>{t('Accept')}</button>
            <button className="btn" onClick={async () => { await post(`/inbox/${id}/decline`); onChanged(); nav('/inbox'); }}>{t('Decline')}</button>
            {other?.id && <button className="btn quiet" onClick={() => setBlock(true)}>{t('Block')}</button>}</div></div>
      ) : (
        <form className="row" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <label className="btn quiet small" style={{ cursor: 'pointer' }} title={t('Attach files')}><Icon name="clip" size={18} /><span className="sr">{t('Attach files')}</span><input type="file" hidden multiple onChange={(e) => { void attach(e.target.files); e.target.value = ''; }} /></label>
          <textarea className="grow" rows={1} value={text} maxLength={8000} onChange={(e) => setText(e.target.value)} placeholder={t('Write a message')} aria-label={t('Write a message')} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
          <button className="btn primary" disabled={busy || uploading > 0 || (!text.trim() && !files.length)}><Icon name="send" size={17} />{t('Send')}</button>
        </form>
      )}
      {(files.length > 0 || uploading > 0) && <p className="small">{uploading > 0 && <span className="spinner" />} {files.map((f) => <span key={f.id} className="chip static" style={{ marginInlineEnd: 4 }}>{f.name} <button className="linkbtn" onClick={() => setFiles(files.filter((x) => x.id !== f.id))} aria-label={t('Remove {name}', { name: f.name })}>×</button></span>)}</p>}
      {block && other?.id && <Confirm title={t('Block {name}?', { name: other.username ? `@${other.username}` : other.name })} text={t('They will not be able to message you or interact with your stories, and you will not see theirs. You can unblock them in Settings.')} yes={t('Block')} danger onClose={() => setBlock(false)}
        onYes={async () => { try { await api(`/people/${other.id}/block`, { method: 'PUT', body: { on: true } }); toast(t('Blocked.')); onChanged(); nav('/inbox'); } catch (e: any) { toast(e.message, 'error'); } }} />}
    </section>
  );
}
