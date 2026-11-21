import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, get, Person, post } from '../lib/api';
import { useApp } from '../lib/app';
import { sendOrQueue } from '../lib/offline';
import { Icon } from './Icon';
import { MapView } from './MapView';
import { MediaItem, MediaView } from './Media';
import { ago, Avatar, compact, Confirm, Dialog, Empty, fmtDate, PersonName, Problem, Skeleton } from './ui';

export interface Story {
  id: string; code: string; type: string; typeLabel: string; title: string; text: string; language: string; languageName: string; postedAs: string; toldBy: string; author: Person | null;
  place: { id: number | null; name: string; latitude: number | null; longitude: number | null; county: string; waterBody: string }; eventDate: string | null; dateApproximate: boolean;
  category: string; vessel: string; tags: string[]; rights: string; allowDownload: boolean; sensitive: boolean; incident: { id: string; code: string; title: string } | null;
  source: Record<string, string> | null; consentLabel: string | null; correction: { note: string; link: string } | null;
  counts: { hearts: number; heartbreaks: number; laughs: number; comments: number; shares: number; links: number; favourites: number; views?: number; downloads?: number };
  viewer: { reaction: string | null; favourited: boolean; followingAuthor: boolean; own: boolean }; comments: { locked: boolean; lockedReason: string; hidden: boolean; hiddenReason: string };
  media: MediaItem[]; status: string; publishedAt: string | null; createdAt: string; edited: boolean; editedAt: string | null; editHistory: Array<{ at: string; text?: string; title?: string }>; permalink: string;
  moderation?: { aiFlag: string | null; aiScore: number | null; aiExplanation: any; overridden: boolean; removedReason: string; pendingEdit: boolean; validated: boolean };
}
type Overlay = null | 'map' | 'comments' | 'share' | 'cite' | 'report' | 'translate' | 'history';

/** Reads the story aloud with the device's own voice for the language. Where the device has none, the original recording is offered instead. */
function useListen(lang: string) {
  const [speaking, setSpeaking] = useState(false);
  const { t } = useTranslation();
  const { toast } = useApp();
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  return { speaking, toggle: (text: string, hasRecording: boolean) => {
    const synth = window.speechSynthesis;
    if (!synth) return toast(t('This device cannot read aloud.'), 'info');
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const code = lang === 'luo' ? 'luo' : lang;
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(code));
    if (!voice && !['en'].includes(code)) { toast(hasRecording ? t('This device has no voice for this language. Play the original recording instead.') : t('This device has no voice for this language.'), 'info'); if (hasRecording || code !== 'sw') return; }
    const u = new SpeechSynthesisUtterance(text.slice(0, 20_000));
    if (voice) u.voice = voice; u.lang = voice?.lang ?? code; u.onend = () => setSpeaking(false); u.onerror = () => setSpeaking(false);
    synth.speak(u); setSpeaking(true);
  } };
}

export function StoryFrame({ story: initial, active, paused, adminBar, onChanged, onOpenSafety }: { story: Story; active: boolean; paused: boolean; adminBar?: React.ReactNode; onChanged?: (s: Story) => void; onOpenSafety?: () => void }) {
  const { t, i18n } = useTranslation();
  const { me, need, toast, reducedMotion, config } = useApp();
  const [s, setS] = useState(initial);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [revealed, setRevealed] = useState(!initial.sensitive);
  const [expanded, setExpanded] = useState(false);
  const [popped, setPopped] = useState('');
  const [fly, setFly] = useState<{ x: number; y: number } | null>(null);
  const [translated, setTranslated] = useState<{ text: string; label: string } | null>(null);
  const [zip, setZip] = useState<'idle' | 'preparing'>('idle');
  const listen = useListen(s.language);
  const viewed = useRef(false);
  useEffect(() => { setS(initial); }, [initial]);
  useEffect(() => { if (active && revealed && !viewed.current && s.status === 'published') { viewed.current = true; void api(`/stories/${s.id}/view`, { method: 'POST', body: {} }).catch(() => undefined); } }, [active, revealed, s.id, s.status]);
  const update = (patch: Partial<Story>) => { const n = { ...s, ...patch }; setS(n); onChanged?.(n); };
  const pop = (k: string) => { setPopped(k); setTimeout(() => setPopped(''), 450); };

  // Optimistic updates: the reaction shows at once and is confirmed by the server in the background (queued if offline).
  async function react(type: 'heart' | 'heartbreak' | 'laugh') {
    if (!need()) return;
    const before = s;
    const next = s.viewer.reaction === type ? null : type;
    const c = { ...s.counts };
    const key = { heart: 'hearts', heartbreak: 'heartbreaks', laugh: 'laughs' } as const;
    if (s.viewer.reaction) c[key[s.viewer.reaction as 'heart']]--;
    if (next) c[key[next]]++;
    update({ counts: c, viewer: { ...s.viewer, reaction: next } }); pop(type);
    try { const r = await sendOrQueue(t('Reaction'), `/stories/${s.id}/reaction`, 'PUT', { type }); if (r) update({ counts: { ...s.counts, ...r.counts }, viewer: { ...s.viewer, reaction: r.reaction } }); else toast(t('Waiting to send'), 'info'); }
    catch (e: any) { setS(before); toast(e.message, 'error'); }
  }
  async function favourite(ev: React.MouseEvent) {
    if (!need()) return;
    const on = !s.viewer.favourited;
    update({ viewer: { ...s.viewer, favourited: on } }); pop('fav');
    if (on && !reducedMotion) { setFly({ x: ev.clientX, y: ev.clientY }); setTimeout(() => setFly(null), 700); }
    try { const r = await sendOrQueue(t('Favorite'), `/stories/${s.id}/favourite`, 'PUT'); toast(r?.message ?? (on ? t('Added to Favorites.') : t('Removed from Favorites.'))); }
    catch (e: any) { update({ viewer: { ...s.viewer, favourited: !on } }); toast(e.message, 'error'); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(s.permalink); toast(t('Link copied.')); } catch { toast(s.permalink, 'info'); }
    void api(`/stories/${s.id}/share`, { method: 'POST', body: { kind: 'copy_link' } }).catch(() => undefined);
  }
  async function share() {
    if (navigator.share && matchMedia('(max-width: 860px)').matches) {
      try { await navigator.share({ title: s.title || t('A story from Remembering the Waters'), url: s.permalink }); void api(`/stories/${s.id}/share`, { method: 'POST', body: { kind: 'share', target: 'device' } }).catch(() => undefined); } catch { /* cancelled */ }
    } else setOverlay('share');
  }
  async function download() {
    setZip('preparing'); toast(t('Preparing your download…'), 'info');
    try {
      const r = await post(`/stories/${s.id}/download`);
      for (let i = 0; i < 90; i++) {
        await new Promise((x) => setTimeout(x, 1500));
        const st = await get(`/stories/downloads/${r.exportId}`);
        if (st.status === 'ready') { toast(t('Your download is ready.')); window.location.assign(st.url); break; }
        if (st.status === 'failed') throw new Error(t('Something went wrong. Please try again.'));
      }
    } catch (e: any) { toast(e.message, 'error'); } finally { setZip('idle'); }
  }
  async function translate() {
    if (translated) return setTranslated(null);
    try { const r = await get(`/stories/${s.id}/translate`, { to: i18n.language }); setTranslated({ text: r.text, label: t('Machine-translated from {language}', { language: r.fromName }) }); }
    catch { toast(t('Translation is not available right now.'), 'error'); }
  }
  const author = s.author ?? { id: null, role: 'contributor' as const, username: null, name: t('A contributor'), avatar: 'avatar:wave', badge: null };
  const when = s.eventDate ? (s.dateApproximate ? t('around {year}', { year: s.eventDate.slice(0, 4) }) : fmtDate(s.eventDate, i18n.language)) : '';
  const speakText = [s.title, translated?.text ?? s.text, ...s.media.map((m) => m.transcript).filter(Boolean)].filter(Boolean).join('. ');
  const hasPlace = s.place.latitude != null && s.place.longitude != null;
  const Act = ({ k, icon, label, on, n, onClick, filled }: { k: string; icon: string; label: string; on?: boolean; n?: number; onClick: (e: React.MouseEvent) => void; filled?: boolean }) => (
    <button className={`act ${on ? 'on' : ''} ${popped === k ? 'pop' : ''}`} onClick={onClick} aria-pressed={on === undefined ? undefined : on} aria-label={n !== undefined ? `${label}: ${n}` : label} title={label}>
      <Icon name={icon} filled={filled && on} />{n !== undefined ? <span className="n">{compact(n)}</span> : <span>{label}</span>}
    </button>
  );
  const left = (
    <>
      {hasPlace && <div className="group"><Act k="map" icon="pin" label={t('Where It Happened')} on={overlay === 'map'} onClick={() => setOverlay(overlay === 'map' ? null : 'map')} /></div>}
      <div className="group" role="group" aria-label={t('Reactions')}>
        <Act k="heart" icon="heart" label={t('Heart')} on={s.viewer.reaction === 'heart'} n={s.counts.hearts} onClick={() => react('heart')} filled />
        <Act k="heartbreak" icon="heartbreak" label={t('Heartbreak')} on={s.viewer.reaction === 'heartbreak'} n={s.counts.heartbreaks} onClick={() => react('heartbreak')} />
        <Act k="laugh" icon="laugh" label={t('Laugh')} on={s.viewer.reaction === 'laugh'} n={s.counts.laughs} onClick={() => react('laugh')} />
      </div>
    </>
  );
  return (
    <div className="story-zone" data-story={s.id}>
      <div className="rail left">{left}</div>
      <article className="frame" aria-label={s.title || t('Story by {name}', { name: author.name })} tabIndex={-1}>
        {adminBar}
        <header className="story-head">
          <Avatar person={author} />
          <div className="grow">
            <PersonName person={author} />{s.toldBy && <span className="dim"> · {t('as told by {name}', { name: s.toldBy })}</span>}
            <div className="meta">{[s.place.name, s.publishedAt ? ago(s.publishedAt, t) : t('Not published'), when && t('Happened: {when}', { when })].filter(Boolean).join(' · ')}{s.edited && <> · <button className="linkbtn small" onClick={() => setOverlay('history')}>{t('Edited')}</button></>}</div>
          </div>
        </header>
        <p style={{ margin: '0 0 .5rem' }}>
          <span className={`kind ${s.type === 'record' ? 'record' : ''}`}>{t(s.typeLabel)}</span>
          {s.consentLabel && <span className="kind consent"><Icon name="check" size={13} />{t(s.consentLabel)}</span>}
          {s.incident && <Link className="kind" to={`/incidents/${s.incident.code}`}><Icon name="incident" size={13} />{s.incident.title}</Link>}
        </p>
        {!revealed ? (
          <div className="note warn" role="alert">
            <p><b>{config?.sensitiveNotice ?? t('This story describes loss of life and may be distressing.')}</b></p>
            <div className="row"><button className="btn primary" onClick={() => setRevealed(true)}>{t('View story')}</button><button className="btn quiet" onClick={() => document.querySelector<HTMLElement>(`[data-story="${s.id}"]`)?.nextElementSibling?.scrollIntoView({ behavior: 'smooth' })}>{t('Go back')}</button></div>
          </div>
        ) : (
          <>
            {s.title && <h2>{s.title}</h2>}
            {s.source && (s.source.institution || s.source.reference) && (
              <div className="source"><b>{t('Source')}:</b> {[s.source.institution, s.source.reference, s.source.original_date, s.source.creator].filter(Boolean).join(' · ')}{s.source.rights_statement && <><br />{s.source.rights_statement}</>}</div>
            )}
            {translated && <p className="note small">{translated.label} · <button className="linkbtn" onClick={() => setTranslated(null)}>{t('Show original')}</button></p>}
            {(translated?.text ?? s.text) && <div className={`story-text ${expanded || (translated?.text ?? s.text).length < 700 ? '' : 'clamp'}`} lang={translated ? i18n.language : s.language}>{translated?.text ?? s.text}</div>}
            {!expanded && (translated?.text ?? s.text).length >= 700 && <p><button className="linkbtn" onClick={() => setExpanded(true)}>{t('Read the whole story')}</button></p>}
            {s.correction && <div className="note warn small" style={{ marginBottom: '.7rem' }}><b>{t('Safety note from the admins')}:</b> {s.correction.note} {s.correction.link && <a href={s.correction.link} target="_blank" rel="noopener noreferrer">{t('Official guidance')}</a>}</div>}
            {s.media.map((m, i) => (
              <div key={m.id}>
                <MediaView m={m} active={active && i === 0} paused={paused || overlay !== null} />
                {m.transcript && <details className="transcript" open={i === 0}><summary><b>{t('Transcript')}</b></summary><p style={{ whiteSpace: 'pre-wrap', margin: '.4rem 0 0' }}>{m.transcript}</p></details>}
              </div>
            ))}
            {s.media.length > 1 && <p className="hint">{t('{n} files in this story', { n: s.media.length })}</p>}
            <p className="meta" style={{ marginTop: '.6rem' }}>{[s.category && t(s.category), s.vessel, ...s.tags.map((x) => `#${x}`)].filter(Boolean).join(' · ')}</p>
            <p className="meta">{s.code} · {t('Rights')}: {s.rights}{s.counts.views !== undefined && <> · {t('{n} views', { n: s.counts.views })}</>}</p>
            {s.sensitive && config?.supportInfo && <p className="note small">{config.supportInfo}</p>}
            {s.moderation?.removedReason && s.status !== 'published' && <p className="note bad small">{s.moderation.removedReason}</p>}
          </>
        )}
        <p className="hint">{t('Scroll past the end for the next story')}</p>

        {overlay === 'map' && hasPlace && (
          <div className="overlay-frame">
            <button className="xbtn x" onClick={() => setOverlay(null)} aria-label={t('Close the map')}><Icon name="close" size={18} /></button>
            <MapView markers={[{ lat: s.place.latitude!, lng: s.place.longitude!, label: s.place.name || s.code }]} center={[s.place.latitude!, s.place.longitude!]} zoom={11} />
            <p className="meta" style={{ padding: '.4rem .8rem', margin: 0 }}>{[s.place.name, s.place.county, s.place.waterBody].filter(Boolean).join(' · ')}</p>
          </div>
        )}
      </article>
      <div className="rail">
        <div className="left-items">{left}</div>
        <Act k="comments" icon="comment" label={t('Comments')} n={s.counts.comments} onClick={() => setOverlay('comments')} />
        <div className="group"><Act k="share" icon="share" label={t('Share')} onClick={share} /></div>
        <div className="group">
          <Act k="copy" icon="link" label={t('Copy Link')} onClick={copyLink} />
          <Act k="cite" icon="cite" label={t('Cite')} onClick={() => setOverlay('cite')} />
        </div>
        {s.allowDownload && <div className="group"><Act k="dl" icon="download" label={zip === 'preparing' ? t('Preparing…') : t('Download')} onClick={() => zip === 'idle' && download()} /></div>}
        <div className="group"><Act k="fav" icon="star" label={s.viewer.favourited ? t('Remove from Favorites') : t('Add to Favorites')} on={s.viewer.favourited} onClick={favourite} filled /></div>
        <div className="group">
          {s.language !== i18n.language && (s.text || s.media.some((m) => m.transcript)) && <Act k="tr" icon="translate" label={t('Translate')} on={!!translated} onClick={translate} />}
          <Act k="listen" icon="listen" label={listen.speaking ? t('Stop') : t('Listen')} on={listen.speaking} onClick={() => listen.toggle(speakText, s.media.some((m) => m.kind === 'audio' || m.kind === 'video'))} />
        </div>
        <div className="group">
          <Act k="report" icon="flag" label={t('Report')} onClick={() => need() && setOverlay('report')} />
          <Act k="safety" icon="warning" label={t('Safety concern')} onClick={() => onOpenSafety?.()} />
        </div>
      </div>
      {fly && <div className="fly" style={{ left: fly.x - 23, top: fly.y - 23, transition: 'all .65s cubic-bezier(.2,.8,.2,1)', transform: 'translate(-40vw, -60vh) scale(.3)', opacity: 0.2 }}><Icon name="star" filled size={24} /></div>}
      {overlay === 'comments' && <Comments story={s} onClose={() => setOverlay(null)} onCount={(n) => update({ counts: { ...s.counts, comments: n } })} />}
      {overlay === 'share' && <ShareDialog story={s} onClose={() => setOverlay(null)} onCopy={copyLink} />}
      {overlay === 'cite' && <CiteDialog story={s} onClose={() => setOverlay(null)} />}
      {overlay === 'report' && <ReportDialog targetType="story" targetId={s.id} author={author} onClose={() => setOverlay(null)} />}
      {overlay === 'history' && (
        <Dialog title={t('Edit history')} onClose={() => setOverlay(null)}>
          <p className="dim">{t('This story was edited on {date}.', { date: fmtDate(s.editedAt, i18n.language) })}</p>
          <ul className="list">{s.editHistory.map((h, i) => <li key={i}><b>{fmtDate(h.at, i18n.language, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</b>{h.text !== undefined && <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{h.text}</p>}</li>)}</ul>
        </Dialog>
      )}
      {me && false}
    </div>
  );
}

function ShareDialog({ story, onClose, onCopy }: { story: Story; onClose: () => void; onCopy: () => void }) {
  const { t } = useTranslation();
  const u = encodeURIComponent(story.permalink), title = encodeURIComponent(story.title || 'Remembering the Waters');
  const targets: Array<[string, string]> = [['WhatsApp', `https://wa.me/?text=${title}%20${u}`], ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`], ['X', `https://twitter.com/intent/tweet?url=${u}&text=${title}`], ['Gmail', `https://mail.google.com/mail/?view=cm&su=${title}&body=${u}`]];
  const log = (target: string) => void api(`/stories/${story.id}/share`, { method: 'POST', body: { kind: 'share', target } }).catch(() => undefined);
  return (
    <Dialog title={t('Share this story')} onClose={onClose}>
      <div className="row">{targets.map(([name, href]) => <a key={name} className="btn" href={href} target="_blank" rel="noopener noreferrer" onClick={() => log(name)}>{name}</a>)}<button className="btn primary" onClick={onCopy}><Icon name="link" size={18} />{t('Copy Link')}</button></div>
      <p className="small dim" style={{ marginTop: '.8rem', overflowWrap: 'anywhere' }}>{story.permalink}</p>
    </Dialog>
  );
}
function CiteDialog({ story, onClose }: { story: Story; onClose: () => void }) {
  const { t } = useTranslation();
  const { toast } = useApp();
  const q = useQuery({ queryKey: ['cite', story.id], queryFn: () => get(`/stories/${story.id}/cite`) });
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast(t('Citation copied.')); } catch { /* shown on screen */ } void api(`/stories/${story.id}/share`, { method: 'POST', body: { kind: 'cite' } }).catch(() => undefined); };
  return (
    <Dialog title={t('Cite this story')} onClose={onClose}>
      {q.isLoading ? <Skeleton lines={3} /> : q.data && (
        <div className="stack">
          {(['apa', 'mla', 'chicago', 'harvard'] as const).map((k) => <div key={k} className="card"><div className="row between"><b>{k.toUpperCase()}</b><button className="btn small" onClick={() => copy(q.data[k])}>{t('Copy')}</button></div><p className="small" style={{ margin: '.4rem 0 0', overflowWrap: 'anywhere' }}>{q.data[k]}</p></div>)}
          <p className="small"><b>{t('Permanent link')}:</b> <span style={{ overflowWrap: 'anywhere' }}>{q.data.permalink}</span></p>
        </div>
      )}
    </Dialog>
  );
}
export function ReportDialog({ targetType, targetId, author, onClose }: { targetType: 'story' | 'user' | 'comment'; targetId: string; author?: Person | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { config, toast } = useApp();
  const [what, setWhat] = useState<'item' | 'user'>(targetType === 'user' ? 'user' : 'item');
  const [reasons, setReasons] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!reasons.length && !description.trim()) return setError(t('Pick at least one reason or describe the issue.'));
    setBusy(true);
    try { const r = await post('/reports', what === 'user' && author?.id ? { targetType: 'user', targetId: author.id, reasons, description } : { targetType, targetId, reasons, description }); toast(r.message); onClose(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return (
    <Dialog title={t('Report')} onClose={onClose}>
      {targetType !== 'user' && author?.id && author.role !== 'admin' && (
        <div className="row" style={{ marginBottom: '.8rem' }} role="group" aria-label={t('What are you reporting?')}>
          <button className="chip" aria-pressed={what === 'item'} onClick={() => setWhat('item')}>{targetType === 'story' ? t('This story') : t('This comment')}</button>
          <button className="chip" aria-pressed={what === 'user'} onClick={() => setWhat('user')}>{t('The Contributor')} {author.username ? `@${author.username}` : ''}</button>
        </div>
      )}
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">{t('Why are you reporting this? Pick one or more.')}</legend>
        {config?.reportReasons.map((r) => <label key={r.key} className="check"><input type="checkbox" checked={reasons.includes(r.key)} onChange={(e) => setReasons(e.target.checked ? [...reasons, r.key] : reasons.filter((x) => x !== r.key))} /><span>{r.label}</span></label>)}
      </fieldset>
      <label className="field"><span>{t('Describe the issue (optional)')}</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} /></label>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="actions"><button className="btn quiet" onClick={onClose}>{t('Cancel')}</button><button className="btn primary" disabled={busy} onClick={send}>{t('Send report')}</button></div>
    </Dialog>
  );
}

interface CommentItem { id: string; parentId: string | null; text: string; reactions: number; createdAt: string; author: Person; replyTo: Person | null; myReaction: string | null; own: boolean; file: MediaItem | null; replies: CommentItem[]; status: string }
function Comments({ story, onClose, onCount }: { story: Story; onClose: () => void; onCount: (n: number) => void }) {
  const { t } = useTranslation();
  const { me, need, toast } = useApp();
  const qc = useQueryClient();
  const [sort, setSort] = useState('top');
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [file, setFile] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggest, setSuggest] = useState<Person[]>([]);
  const [report, setReport] = useState<CommentItem | null>(null);
  const [remove, setRemove] = useState<CommentItem | null>(null);
  const q = useQuery({ queryKey: ['comments', story.id, sort], queryFn: () => get(`/stories/${story.id}/comments`, { sort }) });
  const refresh = async () => { const r = await qc.fetchQuery({ queryKey: ['comments', story.id, sort], queryFn: () => get(`/stories/${story.id}/comments`, { sort }), staleTime: 0 }); onCount(r.count); };
  // Tagging: typing @ suggests people.
  useEffect(() => {
    const m = /@([A-Za-z0-9_]{2,30})$/.exec(text);
    if (!m || !me) return setSuggest([]);
    let live = true;
    void get('/people/search', { q: m[1] }).then((r) => { if (live) setSuggest(r.map((x: any) => x.person)); }).catch(() => undefined);
    return () => { live = false; };
  }, [text, me]);
  async function send() {
    if (!need() || (!text.trim() && !file)) return;
    setBusy(true);
    try {
      const r = await sendOrQueue(t('Comment'), `/stories/${story.id}/comments`, 'POST', { text: text.trim(), parentId: replyTo?.id, mediaId: file?.id });
      if (!r) toast(t('Waiting to send'), 'info'); else if (r.held) toast(r.message, 'info');
      setText(''); setReplyTo(null); setFile(null); await refresh();
    } catch (e: any) { toast(e.details?.reason ? `${e.message} ${e.details.reason}` : e.message, 'error'); } finally { setBusy(false); }
  }
  async function attach(f: File | undefined) {
    if (!f || !need()) return;
    const form = new FormData(); form.append('purpose', 'comment'); form.append('file', f);
    try { const m = await api('/media', { form }); setFile({ id: m.id, name: m.name }); } catch (e: any) { toast(e.message, 'error'); }
  }
  async function reactTo(c: CommentItem) { if (!need()) return; try { await api(`/comments/${c.id}/reaction`, { method: 'PUT', body: { type: 'heart' } }); await refresh(); } catch (e: any) { toast(e.message, 'error'); } }
  const One = ({ c }: { c: CommentItem }) => (
    <div className="comment" id={`c-${c.id}`}>
      <Avatar person={c.author} size="sm" />
      <div className="body">
        <PersonName person={c.author} /> <span className="meta">{ago(c.createdAt, t)}{c.replyTo && <> · {t('replying to {name}', { name: c.replyTo.username ? `@${c.replyTo.username}` : c.replyTo.name })}</>}{c.status !== 'published' && <> · <span className="flag none">{t('Held for review')}</span></>}</span>
        {c.text && <div className="text">{c.text}</div>}
        {c.file && (c.file.kind === 'image' ? <img src={c.file.urls.medium ?? c.file.urls.thumb} alt={c.file.altText || c.file.name} style={{ maxWidth: 220, borderRadius: 10, display: 'block', marginTop: 4 }} loading="lazy" /> : <a href={c.file.urls.original ?? c.file.urls.web} target="_blank" rel="noopener noreferrer" className="small"><Icon name="clip" size={14} /> {c.file.name}</a>)}
        <div className="row small" style={{ gap: '.9rem', marginTop: 2 }}>
          <button className="linkbtn" onClick={() => reactTo(c)} aria-pressed={!!c.myReaction}><Icon name="heart" size={14} filled={!!c.myReaction} /> {c.reactions}</button>
          {!story.comments.locked && <button className="linkbtn" onClick={() => { if (need()) { setReplyTo(c); setText(c.author.username ? `@${c.author.username} ` : ''); } }}>{t('Reply')}</button>}
          {c.own || me?.role === 'admin' ? <button className="linkbtn" onClick={() => setRemove(c)}>{t('Delete')}</button> : <button className="linkbtn" onClick={() => need() && setReport(c)}>{t('Report')}</button>}
        </div>
      </div>
    </div>
  );
  return (
    <Dialog title={`${t('Comments')} (${q.data?.count ?? story.counts.comments})`} onClose={onClose} wide>
      <div className="row" role="group" aria-label={t('Sort comments')} style={{ marginBottom: '.6rem' }}>
        {[['top', t('Most reactions')], ['recent', t('Most recent')], ['oldest', t('Oldest')]].map(([k, label]) => <button key={k} className="chip" aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>)}
      </div>
      {q.data?.hidden && <p className="note warn"><Icon name="hide" size={16} /> {t('Comments have been hidden by an admin.')} {q.data.hiddenReason && <i>{q.data.hiddenReason}</i>} ({t('{n} comments', { n: q.data.count })})</p>}
      {q.data?.locked && <p className="note warn"><Icon name="lock" size={16} /> {t('Comments and replies have been locked by an admin.')} {q.data.lockedReason && <i>{q.data.lockedReason}</i>}</p>}
      {q.isLoading ? <Skeleton lines={3} /> : q.error ? <Problem error={q.error} retry={() => q.refetch()} /> : (
        <div style={{ maxHeight: '46vh', overflowY: 'auto' }}>
          {q.data.items.length === 0 && !q.data.hidden && <Empty icon="comment" title={t('No comments yet')}><p>{t('Be the first to say something kind.')}</p></Empty>}
          {q.data.items.map((c: CommentItem) => <div key={c.id}><One c={c} />{c.replies.length > 0 && <div className="replies">{c.replies.map((r) => <One key={r.id} c={r} />)}</div>}</div>)}
        </div>
      )}
      {!q.data?.locked && (
        <div style={{ marginTop: '.7rem', position: 'relative' }}>
          {replyTo && <p className="small note">{t('Replying to {name}', { name: replyTo.author.username ? `@${replyTo.author.username}` : replyTo.author.name })} <button className="linkbtn" onClick={() => { setReplyTo(null); setText(''); }}>{t('Cancel')}</button></p>}
          {suggest.length > 0 && <div className="card" style={{ position: 'absolute', bottom: '100%', insetInlineStart: 0, padding: '.3rem', zIndex: 3, minWidth: 220 }} role="listbox">{suggest.map((p) => <button key={p.id} className="pick" role="option" aria-selected="false" onClick={() => { setText(text.replace(/@[A-Za-z0-9_]*$/, `@${p.username} `)); setSuggest([]); }}><Avatar person={p} size="sm" />@{p.username}</button>)}</div>}
          <div className="row">
            <label className="btn quiet small" style={{ cursor: 'pointer' }} title={t('Attach a file')}><Icon name="clip" size={18} /><span className="sr">{t('Attach a file')}</span><input type="file" hidden onChange={(e) => attach(e.target.files?.[0])} /></label>
            <input className="grow" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={me ? t('Write a comment… use @ to tag someone') : t('Sign in to comment')} onFocus={() => { if (!me) need(); }} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} aria-label={t('Write a comment')} maxLength={5000} />
            <button className="btn primary" disabled={busy || (!text.trim() && !file)} onClick={send}>{t('Send')}</button>
          </div>
          {file && <p className="small"><Icon name="clip" size={14} /> {file.name} <button className="linkbtn" onClick={() => setFile(null)}>{t('Remove')}</button></p>}
        </div>
      )}
      {report && <ReportDialog targetType="comment" targetId={report.id} author={report.author} onClose={() => setReport(null)} />}
      {remove && <Confirm title={t('Delete this comment?')} yes={t('Delete')} danger onClose={() => setRemove(null)} onYes={async () => { await api(`/comments/${remove.id}`, { method: 'DELETE' }); await refresh(); }} />}
    </Dialog>
  );
}
