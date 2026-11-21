import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, get } from '../lib/api';
import { useApp } from '../lib/app';
import { Icon } from '../components/Icon';
import { MapView } from '../components/MapView';
import { ReportDialog, Story } from '../components/Story';
import { Avatar, Confirm, fmtDate, Problem, Skeleton } from '../components/ui';

/** A compact line for a story inside incident, collection and profile pages; selecting it opens the story in the story frame. */
export function StoryRow({ s, note }: { s: Story; note?: string }) {
  const { t, i18n } = useTranslation();
  return (
    <li>
      <span className={`kind ${s.type === 'record' ? 'record' : ''}`}>{t(s.typeLabel)}</span> <Link to={`/stories/${s.code}`}><b>{s.title || s.text.slice(0, 70) || s.code}</b></Link>
      <div className="meta">{[s.author?.username ? `@${s.author.username}` : s.author?.name, s.place.name, s.eventDate && (s.dateApproximate ? t('around {year}', { year: s.eventDate.slice(0, 4) }) : fmtDate(s.eventDate, i18n.language))].filter(Boolean).join(' · ')}</div>
      {note ? <p className="small" style={{ margin: 0 }}>{note}</p> : s.text && <p className="small" style={{ margin: 0 }}>{s.text.slice(0, 160)}{s.text.length > 160 ? '…' : ''}</p>}
    </li>
  );
}

export default function Detail() {
  const { pathname } = useLocation();
  const [, kind, id] = pathname.split('/');
  return kind === 'incidents' ? <Incident code={id} /> : kind === 'collections' ? <Collection id={id} /> : <Contributor username={id} />;
}

function Incident({ code }: { code: string }) {
  const { t, i18n } = useTranslation();
  const { toast } = useApp();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['incident', code], queryFn: () => get(`/incidents/${code}`) });
  if (q.isLoading) return <Skeleton />;
  if (q.error) return <Problem error={q.error} retry={() => q.refetch()} />;
  const i = q.data;
  const facts: Array<[string, string]> = [[t('Date'), i.eventDate ? (i.dateApproximate ? t('around {year}', { year: i.eventDate.slice(0, 4) }) : fmtDate(i.eventDate, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })) : ''], [t('Place'), i.placeName], [t('Water body'), i.waterBody], [t('Vessel'), i.vessel], [t('Type'), i.incidentType && t(i.incidentType)]].filter(([, v]) => v) as Array<[string, string]>;
  return (
    <article className="prose">
      <p><button className="linkbtn" onClick={() => nav('/?tab=incidents')}>← {t('All incident records')}</button></p>
      <span className="kind"><Icon name="incident" size={13} />{t('Incident record')} · {i.code}</span>
      <h1>{i.title}</h1>
      <dl className="facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {i.summary && <><h2>{t('What happened')}</h2><p style={{ whiteSpace: 'pre-wrap' }}>{i.summary}</p></>}
      {i.outcome && <><h2>{t('Outcome')}</h2><p style={{ whiteSpace: 'pre-wrap' }}>{i.outcome}</p></>}
      {i.latitude != null && <div style={{ height: 260, display: 'flex' }}><MapView markers={[{ lat: i.latitude, lng: i.longitude, label: i.title, kind: 'incident' }]} center={[i.latitude, i.longitude]} zoom={10} /></div>}
      <h2>{t('Stories, testimonies and records linked to this incident')} ({i.linked.length})</h2>
      {i.linked.length === 0 ? <p className="dim">{t('Nothing is linked yet. If you remember this, share your story and link it to this incident.')}</p> : <ul className="list">{i.linked.map((s: Story) => <StoryRow key={s.id} s={s} />)}</ul>}
      {i.linked.length > 0 && <p><Link className="btn" to={`/?tab=incidents&incidentId=${i.id}`}>{t('Open them in the story frame')}</Link></p>}
      {i.sources && <><h2>{t('Sources')}</h2><p className="small" style={{ whiteSpace: 'pre-wrap' }}>{i.sources}</p></>}
      <p className="row"><button className="btn small" onClick={async () => { try { await navigator.clipboard.writeText(i.permalink); toast(t('Link copied.')); } catch { toast(i.permalink, 'info'); } }}><Icon name="link" size={15} />{t('Copy Link')}</button></p>
    </article>
  );
}

function Collection({ id }: { id: string }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['collection', id], queryFn: () => get(`/collections/${id}`) });
  if (q.isLoading) return <Skeleton />;
  if (q.error) return <Problem error={q.error} retry={() => q.refetch()} />;
  const c = q.data;
  return (
    <article className="prose">
      <p><button className="linkbtn" onClick={() => nav('/?tab=collections')}>← {t('All collections')}</button></p>
      <span className="kind">{c.kind === 'exhibition' ? t('Online exhibition') : t('Collection')}</span>
      <h1>{c.title}</h1>
      {c.cover?.urls?.medium && <img src={c.cover.urls.medium} alt={c.cover.altText || ''} style={{ width: '100%', borderRadius: 12 }} />}
      <p style={{ whiteSpace: 'pre-wrap' }}>{c.description}</p>
      <ul className="list">{c.items.map((it: { story: Story; note: string }) => <StoryRow key={it.story.id} s={it.story} note={it.note} />)}</ul>
      {c.items.length > 0 && <p><Link className="btn" to={`/?tab=collections&collectionId=${c.id}`}>{t('Open them in the story frame')}</Link></p>}
    </article>
  );
}

function Contributor({ username }: { username: string }) {
  const { t, i18n } = useTranslation();
  const { me, need, toast } = useApp();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['contributor', username, me?.id], queryFn: () => get(`/contributors/${username}`) });
  const [report, setReport] = useState(false); const [block, setBlock] = useState(false);
  if (q.isLoading) return <Skeleton />;
  if (q.error) return <Problem error={q.error} />;
  const c = q.data;
  const toggle = async (what: 'follow' | 'mute' | 'block', on: boolean) => { if (!need()) return; try { await api(`/people/${c.id}/${what}`, { method: 'PUT', body: { on } }); await q.refetch(); toast(what === 'follow' ? (on ? t('Following.') : t('Unfollowed.')) : what === 'mute' ? (on ? t('Muted.') : t('Unmuted.')) : on ? t('Blocked.') : t('Unblocked.')); } catch (e: any) { toast(e.message, 'error'); } };
  return (
    <article>
      <div className="row" style={{ alignItems: 'center', gap: '1rem' }}>
        <Avatar person={c} size="lg" />
        <div><h1 style={{ margin: 0 }}>@{c.username}</h1><p className="meta" style={{ margin: 0 }}>{t('{n} stories', { n: c.stories })} · {t('{n} followers', { n: c.followers })} · {t('{n} following', { n: c.following })} · {t('Joined {date}', { date: fmtDate(c.joinedAt, i18n.language, { month: 'long', year: 'numeric' }) })}</p></div>
      </div>
      <div className="row" style={{ margin: '1rem 0' }}>
        <Link className="btn primary" to={`/?tab=contributors&authorId=${c.id}&name=${encodeURIComponent(c.username)}`}><Icon name="stories" size={17} />{t('See their stories')}</Link>
        {!c.viewer.own && me?.role !== 'super_admin' && (
          <>
            <button className="btn" aria-pressed={c.viewer.following} onClick={() => toggle('follow', !c.viewer.following)}><Icon name="follow" size={17} />{c.viewer.following ? t('Following') : t('Follow')}</button>
            <button className="btn" onClick={() => need() && nav(`/inbox?to=${c.id}&name=${encodeURIComponent(c.username)}`)}><Icon name="inbox" size={17} />{t('Message')}</button>
            <button className="btn quiet" aria-pressed={c.viewer.muted} onClick={() => toggle('mute', !c.viewer.muted)}>{c.viewer.muted ? t('Unmute') : t('Mute')}</button>
            <button className="btn quiet" onClick={() => (c.viewer.blocked ? void toggle('block', false) : need() && setBlock(true))}><Icon name="block" size={15} />{c.viewer.blocked ? t('Unblock') : t('Block')}</button>
            <button className="btn quiet" onClick={() => need() && setReport(true)}><Icon name="flag" size={15} />{t('Report')}</button>
          </>
        )}
        {c.viewer.own && <Link className="btn" to="/profile">{t('My Profile')}</Link>}
      </div>
      {report && <ReportDialog targetType="user" targetId={c.id} onClose={() => setReport(false)} />}
      {block && <Confirm title={t('Block {name}?', { name: `@${c.username}` })} text={t('They will not be able to message you or interact with your stories, and you will not see theirs. You can unblock them in Settings.')} yes={t('Block')} danger onClose={() => setBlock(false)} onYes={() => toggle('block', true)} />}
    </article>
  );
}
