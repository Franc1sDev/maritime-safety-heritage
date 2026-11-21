import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { get, Person } from '../lib/api';
import { useApp } from '../lib/app';
import { AdminBar } from '../components/AdminBar';
import { Icon } from '../components/Icon';
import { MapView, Marker } from '../components/MapView';
import { Story, StoryFrame } from '../components/Story';
import { Avatar, Empty, fmtDate, Problem, Skeleton } from '../components/ui';
import { RulesFrame, SafetyConcernDialog } from './About';

const ShareStory = lazy(() => import('./Share'));

const TABS: Array<[string, string, string]> = [
  ['trending', 'trending', 'Trending'], ['following', 'follow', 'Following'], ['location', 'pin', 'Location'], ['contributors', 'people', 'Contributors'], ['favorites', 'star', 'Favorites'],
  ['incidents', 'incident', 'Incidents'], ['map', 'map', 'Map'], ['timeline', 'timeline', 'Timeline'], ['collections', 'collection', 'Collections'],
];
interface Place { id: number; name: string; altNames: string[]; county: string; waterBody: string; stories: number; latitude: number | null; longitude: number | null }

/** A text field that searches as you type and offers matches to pick from. */
export function Combo<T>({ label, placeholder, load, render, onPick, none, value }: { label: string; placeholder: string; load: (q: string) => Promise<T[]>; render: (x: T) => React.ReactNode; onPick: (x: T) => void; none: string; value?: string }) {
  const [q, setQ] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<T[] | null>(null);
  const [at, setAt] = useState(0);
  useEffect(() => { setQ(value ?? ''); }, [value]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    const h = setTimeout(() => void load(q.trim()).then((r) => { if (live) { setItems(r); setAt(0); } }).catch(() => live && setItems([])), 180);
    return () => { live = false; clearTimeout(h); };
  }, [q, open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="combo" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <label className="sr" htmlFor={`combo-${label}`}>{label}</label>
      <input id={`combo-${label}`} type="text" role="combobox" aria-expanded={open} aria-autocomplete="list" aria-controls={`list-${label}`} placeholder={placeholder} value={q} autoComplete="off"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (!items?.length) return; if (e.key === 'ArrowDown') { e.preventDefault(); setAt((at + 1) % items.length); } if (e.key === 'ArrowUp') { e.preventDefault(); setAt((at - 1 + items.length) % items.length); } if (e.key === 'Enter') { e.preventDefault(); onPick(items[at]); setOpen(false); } if (e.key === 'Escape') setOpen(false); }} />
      {open && items && (
        <div className="combo-list card" id={`list-${label}`} role="listbox">
          {items.length === 0 ? <p className="small dim" style={{ margin: '.4rem' }} role="status">{none}</p> : items.map((x, i) => <button key={i} type="button" className="pick" role="option" aria-selected={i === at} onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(x); setOpen(false); }}>{render(x)}</button>)}
        </div>
      )}
    </div>
  );
}

export default function StoriesPage({ paused }: { paused: boolean }) {
  const { t, i18n } = useTranslation();
  const { me, need, config, reducedMotion } = useApp();
  const nav = useNavigate();
  const { code } = useParams();
  const [sp, setSp] = useSearchParams();
  const routeCode = /^\/stories\/([^/]+)/.exec(window.location.pathname)?.[1] ?? code;
  const tab = sp.get('tab') ?? 'trending';
  const [mode, setMode] = useState<'stories' | 'share' | 'rules'>('stories');
  const [edit, setEdit] = useState<string | null>(null);
  const [company, setCompany] = useState(false);
  const [safety, setSafety] = useState(false);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [search, setSearch] = useState(sp.get('q') ?? '');
  const frameRef = useRef<HTMLDivElement>(null);
  const isAdmin = me?.role === 'admin';

  // "Share my story" and "Edit" can be asked for from other pages.
  useEffect(() => { if (sp.get('share')) { if (need()) { const v = sp.get('share')!; setCompany(v === 'company'); setEdit(v === '1' || v === 'company' ? null : v); setMode('share'); } const n = new URLSearchParams(sp); n.delete('share'); setSp(n, { replace: true }); } }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    for (const k of ['placeId', 'place', 'authorId', 'incidentId', 'collectionId', 'year', 'decade', 'q', 'category', 'language', 'type']) { const v = sp.get(k); if (v) f[k] = v; }
    return f;
  }, [sp]);
  const listTab = ['incidents', 'map', 'timeline', 'collections'].includes(tab) && !Object.keys(filters).length;
  const needsPick = (tab === 'location' && !filters.placeId && !filters.place) || (tab === 'contributors' && !filters.authorId);
  const signedOutTab = !me && (tab === 'following' || tab === 'favorites');
  const feedTab = tab === 'following' || tab === 'favorites' ? tab : tab === 'timeline' ? 'timeline' : filters.q || tab !== 'trending' ? 'recent' : 'trending';
  const enabled = !listTab && !needsPick && !signedOutTab;

  const one = useQuery({ queryKey: ['story', routeCode, me?.id], queryFn: () => get<Story>(`/stories/${routeCode}`), enabled: !!routeCode, retry: false });
  const feed = useInfiniteQuery({
    queryKey: ['stories', feedTab, filters, me?.id ?? null],
    queryFn: ({ pageParam }) => get<{ items: Story[]; nextCursor: string | null }>('/stories', { tab: feedTab, ...filters, cursor: pageParam, limit: 6 }),
    initialPageParam: undefined as string | undefined, getNextPageParam: (l) => l.nextCursor ?? undefined, enabled,
  });
  const also = useQuery({ queryKey: ['search', filters.q], queryFn: () => get('/search', { q: filters.q }), enabled: !!filters.q });
  const items = useMemo(() => {
    const list = feed.data?.pages.flatMap((p) => p.items) ?? [];
    return routeCode && one.data ? [one.data, ...list.filter((s) => s.id !== one.data!.id)] : list;
  }, [feed.data, one.data, routeCode]);
  useEffect(() => { setIndex(0); }, [tab, filters, routeCode]);
  useEffect(() => { if (index >= items.length - 2 && feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage(); }, [index, items.length, feed.hasNextPage, feed.isFetchingNextPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback((d: 1 | -1) => {
    setIndex((i) => { const n = i + d; if (n < 0 || n >= items.length) return i; setDir(d); return n; });
  }, [items.length]);
  // Scrolling past the end of a story moves to the next one; past the top, to the one before.
  const pull = useRef({ amount: 0, at: 0, touch: 0 });
  useEffect(() => {
    const el = frameRef.current;
    if (!el || mode !== 'stories') return;
    const frame = () => el.querySelector<HTMLElement>('.frame');
    const edge = (down: boolean) => { const f = frame(); return !f || (down ? f.scrollTop + f.clientHeight >= f.scrollHeight - 3 : f.scrollTop <= 1); };
    const wheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.overlay-frame, .scrim')) return;
      const down = e.deltaY > 0;
      if (!edge(down)) { pull.current.amount = 0; return; }
      const now = Date.now();
      if (now - pull.current.at < 650) return;
      pull.current.amount += Math.abs(e.deltaY);
      if (pull.current.amount > 160) { pull.current = { ...pull.current, amount: 0, at: now }; go(down ? 1 : -1); }
    };
    const ts = (e: TouchEvent) => { pull.current.touch = e.touches[0].clientY; };
    const te = (e: TouchEvent) => { if ((e.target as HTMLElement).closest('.overlay-frame, .scrim')) return; const dy = pull.current.touch - e.changedTouches[0].clientY; if (Math.abs(dy) > 70 && edge(dy > 0)) go(dy > 0 ? 1 : -1); };
    el.addEventListener('wheel', wheel, { passive: true }); el.addEventListener('touchstart', ts, { passive: true }); el.addEventListener('touchend', te, { passive: true });
    return () => { el.removeEventListener('wheel', wheel); el.removeEventListener('touchstart', ts); el.removeEventListener('touchend', te); };
  }, [go, mode]);
  useEffect(() => {
    if (paused || mode !== 'stories') return;
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [role=dialog], .combo')) return;
      if (e.key === 'j' || e.key === 'PageDown') { e.preventDefault(); go(1); }
      if (e.key === 'k' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, paused, mode]);

  const pickTab = (k: string) => { if ((k === 'following' || k === 'favorites') && !need()) return; setMode('stories'); nav(k === 'trending' ? '/' : `/?tab=${k}`); };
  const setFilter = (patch: Record<string, string | null>, keepTab = tab) => { const n = new URLSearchParams(); if (keepTab !== 'trending') n.set('tab', keepTab); for (const [k, v] of Object.entries({ ...filters, ...patch })) if (v) n.set(k, v); nav(`/?${n.toString()}`); };
  const current = items[index];
  const title = filters.q ? t('Results for “{q}”', { q: filters.q }) : null;

  return (
    <div>
      <div className="tabs-row" data-guide="browse" role="tablist" aria-label={t('Stories by')}>
        <span className="label">{t('Stories by')}</span>
        {TABS.map(([k, icon, label]) => <button key={k} role="tab" aria-selected={tab === k && !filters.q} className={`tab ${tab === k && !filters.q ? 'on' : ''}`} onClick={() => pickTab(k)}><Icon name={icon} />{t(label)}</button>)}
        <form role="search" className="searchbox" onSubmit={(e) => { e.preventDefault(); if (search.trim()) nav(`/?q=${encodeURIComponent(search.trim())}`); else nav('/'); }}>
          <label className="sr" htmlFor="q">{t('Search the archive')}</label>
          <input id="q" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search the archive')} />
          <button className="xbtn" aria-label={t('Search')}><Icon name="search" size={17} /></button>
        </form>
      </div>

      {mode === 'stories' && tab === 'location' && (
        <div className="picker">
          <Combo<Place> label={t('Location')} placeholder={t('Type or choose a location')} none={t('No stories for this location.')} value={sp.get('placeName') ?? ''}
            load={async (q) => (await get<Place[]>('/places', { q, withStories: true })).filter((p) => p.stories > 0)} render={(p) => <><Icon name="pin" size={18} /><span>{p.name} <span className="dim small">{[p.county, p.waterBody].filter(Boolean).join(' · ')} · {t('{n} stories', { n: p.stories })}</span></span></>}
            onPick={(p) => nav(`/?tab=location&placeId=${p.id}&placeName=${encodeURIComponent(p.name)}`)} />
        </div>
      )}
      {mode === 'stories' && tab === 'contributors' && (
        <div className="picker">
          <Combo<{ person: Person; stories: number }> label={t('Contributor')} placeholder={t('Type or choose a Contributor')} none={t('No Contributor with this username has posted a story, or their stories may have been deleted.')} value={sp.get('name') ?? ''}
            load={(q) => get('/contributors', { q })} render={(c) => <><Avatar person={c.person} size="sm" /><span>@{c.person.username} <span className="dim small">{t('{n} stories', { n: c.stories })}</span></span></>}
            onPick={(c) => nav(`/?tab=contributors&authorId=${c.person.id}&name=${encodeURIComponent(c.person.username ?? '')}`)} />
          {filters.authorId && sp.get('name') && <Link className="btn small" to={`/contributors/${sp.get('name')}`}>{t('Open profile')}</Link>}
        </div>
      )}
      {mode === 'stories' && (filters.incidentId || filters.collectionId || filters.year || filters.decade || title) && (
        <p className="picker small">
          <b>{title ?? (filters.year ? t('Stories from {year}', { year: filters.year }) : filters.decade ? t('Stories from the {decade}s', { decade: filters.decade }) : filters.incidentId ? t('Stories linked to this incident') : t('Stories in this collection'))}</b>
          <button className="linkbtn" onClick={() => { setSearch(''); nav(tab === 'trending' ? '/' : `/?tab=${tab}`); }}>{t('Clear')}</button>
        </p>
      )}

      {mode === 'stories' && filters.q && also.data && (also.data.incidents.length + also.data.places.length + also.data.contributors.length + also.data.resources.length > 0) && (
        <p className="picker small" aria-label={t('Also found')}>
          <b>{t('Also found')}:</b>
          {also.data.incidents.map((i: any) => <Link key={i.id} className="chip" to={`/incidents/${i.code}`}><Icon name="incident" size={13} />{i.title}</Link>)}
          {also.data.places.filter((pl: any) => pl.stories > 0).map((pl: any) => <Link key={pl.id} className="chip" to={`/?tab=location&placeId=${pl.id}&placeName=${encodeURIComponent(pl.name)}`}><Icon name="pin" size={13} />{pl.name}</Link>)}
          {also.data.contributors.map((c: any) => <Link key={c.id} className="chip" to={`/contributors/${c.username}`}><Icon name="profile" size={13} />@{c.username}</Link>)}
          {also.data.resources.map((r: any) => <Link key={r.id} className="chip" to={`/resources/${r.slug}`}><Icon name="book" size={13} />{r.title}</Link>)}
        </p>
      )}

      <div ref={frameRef}>
        {mode === 'share' ? (
          <div className="story-zone"><span /><Suspense fallback={<div className="frame"><Skeleton /></div>}><ShareStory key={`${edit}${company}`} editId={edit} company={company} onClose={() => { setMode('stories'); setEdit(null); setCompany(false); }} /></Suspense><span /></div>
        ) : mode === 'rules' ? (
          <div className="story-zone"><span /><RulesFrame onClose={() => setMode('stories')} /><span /></div>
        ) : (
          <>
            <div className="story-zone top-row"><span /><div className="frame-top">
              <button className="btn small" onClick={() => setMode('rules')}><Icon name="rules" size={17} />{t('Rules')}</button>
              {items.length > 1 && <span className="counter" aria-live="polite">{index + 1} / {items.length}{feed.hasNextPage ? '+' : ''}</span>}
              {me?.role !== 'super_admin' && <button className="plus" data-guide="share" onClick={() => { if (need()) { setEdit(null); setCompany(false); setMode('share'); } }} aria-label={t('Share my story')} title={t('Share my story')}>+</button>}
            </div><span /></div>
            {listTab ? <div className="story-zone"><span /><div className="frame plain">{tab === 'incidents' ? <IncidentList /> : tab === 'map' ? <MapExplore /> : tab === 'timeline' ? <Timeline onPick={(p) => setFilter(p, 'timeline')} /> : <Collections />}</div><span /></div>
              : signedOutTab ? <Zone><Empty icon="signin" title={t('Sign in to see this tab')}><button className="btn primary" onClick={() => need()}>{t('Sign in')}</button></Empty></Zone>
              : needsPick ? <Zone><Empty icon={tab === 'location' ? 'pin' : 'people'} title={tab === 'location' ? t('Choose a location to see its stories') : t('Choose a Contributor to see their stories')} /></Zone>
              : feed.isLoading || (routeCode && one.isLoading) ? <Zone><Skeleton /></Zone>
              : feed.error ? <Zone><Problem error={feed.error} retry={() => feed.refetch()} /></Zone>
              : !current ? (
                <Zone>
                  {routeCode && one.error ? <Problem error={one.error} />
                    : tab === 'following' ? <Empty icon="follow" title={t('You are not following anyone yet')}><p>{t('Follow Contributors to see their stories here.')}</p><button className="btn primary" onClick={() => pickTab('contributors')}>{t('Find Contributors')}</button></Empty>
                    : tab === 'favorites' ? <Empty icon="star" title={t('No favorites yet')}><p>{t('Select the star on a story to keep it here.')}</p></Empty>
                    : tab === 'location' ? <Empty icon="pin" title={t('No stories for this location.')} />
                    : tab === 'contributors' ? <Empty icon="people" title={t('No Contributor with this username has posted a story, or their stories may have been deleted.')} />
                    : <Empty title={filters.q ? t('Nothing matches your search') : t('No stories here yet')}><p>{t('Be the first to share one.')}</p><button className="btn primary" onClick={() => { if (need()) setMode('share'); }}>{t('Share my story')}</button></Empty>}
                </Zone>
              ) : (
                <AnimatePresence mode="wait" initial={false} custom={dir}>
                  <motion.div key={current.id} custom={dir} initial={reducedMotion ? false : { opacity: 0, y: dir * 60 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: dir * -60 }} transition={{ duration: 0.22 }}>
                    <StoryFrame story={current} active paused={paused} onOpenSafety={() => setSafety(true)}
                      adminBar={isAdmin && current.moderation ? <AdminBar story={current} onChanged={() => { void feed.refetch(); if (routeCode) void one.refetch(); }} /> : undefined} />
                  </motion.div>
                </AnimatePresence>
              )}
            {!listTab && items.length > 1 && (
              <div className="row" style={{ justifyContent: 'center', paddingBottom: '1rem' }}>
                <button className="btn small" disabled={index === 0} onClick={() => go(-1)}>{t('Previous story')}</button>
                <button className="btn small" disabled={index >= items.length - 1} onClick={() => go(1)}>{t('Next story')}</button>
              </div>
            )}
          </>
        )}
      </div>
      {safety && <SafetyConcernDialog onClose={() => setSafety(false)} />}
      <span className="sr" aria-live="polite">{current ? `${current.title || t('Story')} · ${fmtDate(current.publishedAt, i18n.language)}` : ''}</span>
      {config && null}
    </div>
  );
}
const Zone = ({ children }: { children: React.ReactNode }) => <div className="story-zone"><span /><div className="frame">{children}</div><span /></div>;

function IncidentList() {
  const { t, i18n } = useTranslation();
  const { config } = useApp();
  const [f, setF] = useState({ q: '', year: '', waterBody: '', type: '' });
  const q = useQuery({ queryKey: ['incidents', f], queryFn: () => get<any[]>('/incidents', f) });
  const waters = useMemo(() => [...new Set((q.data ?? []).map((i) => i.waterBody).filter(Boolean))], [q.data]);
  return (
    <div>
      <h2>{t('Incident records')}</h2>
      <div className="grid2" style={{ marginBottom: '.7rem' }}>
        <label className="field"><span>{t('Name')}</span><input type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></label>
        <label className="field"><span>{t('Year')}</span><input type="number" inputMode="numeric" min={1800} max={2100} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></label>
        <label className="field"><span>{t('Water body')}</span><input list="waters" value={f.waterBody} onChange={(e) => setF({ ...f, waterBody: e.target.value })} /><datalist id="waters">{waters.map((w) => <option key={w} value={w} />)}</datalist></label>
        <label className="field"><span>{t('Type')}</span><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="">{t('All types')}</option>{config?.incidentTypes.map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
      {q.isLoading ? <Skeleton lines={3} /> : q.error ? <Problem error={q.error} retry={() => q.refetch()} /> : q.data!.length === 0 ? <Empty icon="incident" title={t('No incident records match')} /> : (
        <ul className="list">{q.data!.map((i) => (
          <li key={i.id}><Link to={`/incidents/${i.code}`}><b>{i.title}</b></Link><div className="meta">{[fmtDate(i.eventDate, i18n.language), i.placeName, i.waterBody, i.incidentType, t('{n} linked stories', { n: i.stories })].filter(Boolean).join(' · ')}</div></li>
        ))}</ul>
      )}
      <p className="small"><a href="/api/v1/incidents/export.csv">{t('Download the incident list (CSV)')}</a></p>
    </div>
  );
}

function MapExplore() {
  const { t } = useTranslation();
  const { config } = useApp();
  const nav = useNavigate();
  const [view, setView] = useState<{ bbox: string; zoom: number } | null>(null);
  const [f, setF] = useState({ category: '', language: '', from: '', to: '', incidents: true });
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const q = useQuery({ queryKey: ['map', view, f], queryFn: () => get('/map', { ...view, category: f.category, language: f.language, from: f.from, to: f.to, incidents: f.incidents }), enabled: !!view, placeholderData: (p) => p });
  const near = useQuery({ queryKey: ['map-near', here, f], enabled: !!here, queryFn: () => get('/map', { bbox: [here!.lng - 0.25, here!.lat - 0.25, here!.lng + 0.25, here!.lat + 0.25].join(','), zoom: 12, category: f.category, language: f.language, from: f.from, to: f.to, incidents: false }) });
  const onMove = useCallback((b: { west: number; south: number; east: number; north: number; zoom: number }) => setView({ bbox: [b.west, b.south, b.east, b.north].map((n) => n.toFixed(4)).join(','), zoom: Math.round(b.zoom) }), []);
  const markers = useMemo<Marker[]>(() => [
    ...(q.data?.stories ?? []).map((s: any) => ({ lat: s.latitude, lng: s.longitude, count: s.count, label: s.count > 1 ? t('{n} stories here', { n: s.count }) : s.title || s.code, kind: 'story' as const, onClick: () => (s.count > 1 ? setHere({ lat: s.latitude, lng: s.longitude }) : nav(`/stories/${s.code}`)) })),
    ...(q.data?.incidents ?? []).map((i: any) => ({ lat: i.latitude, lng: i.longitude, label: `${i.title} (${t('incident')})`, kind: 'incident' as const, onClick: () => nav(`/incidents/${i.code}`) })),
  ], [q.data, nav, t]);
  return (
    <div>
      <h2>{t('Map Explore')}</h2>
      <div className="grid2" style={{ marginBottom: '.6rem' }}>
        <label className="field"><span>{t('Category')}</span><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">{t('All categories')}</option>{config?.categories.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select></label>
        <label className="field"><span>{t('Language')}</span><select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}><option value="">{t('All languages')}</option>{config?.languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</select></label>
        <label className="field"><span>{t('Happened from')}</span><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="field"><span>{t('Happened to')}</span><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={f.incidents} onChange={(e) => setF({ ...f, incidents: e.target.checked })} /><span>{t('Show incident records')} <span className="dot red" /> </span></label>
      <div style={{ height: 420, display: 'flex' }}><MapView markers={markers} onMove={onMove} /></div>
      <p className="hint">{t('Blue: stories. Red: incident records. Select a marker to open it.')}</p>
      {here && (
        <div className="card" style={{ marginTop: '.6rem' }}>
          <div className="row between"><b>{t('Stories here')}</b><button className="xbtn" onClick={() => setHere(null)} aria-label={t('Close')}><Icon name="close" size={16} /></button></div>
          {near.isLoading ? <Skeleton lines={2} /> : <ul className="list">{(near.data?.stories ?? []).map((s: any) => <li key={s.id}><Link to={`/stories/${s.code}`}><b>{s.title || s.code}</b></Link><div className="meta">{[s.placeName, s.category && t(s.category)].filter(Boolean).join(' · ')}</div>{s.excerpt && <p className="small" style={{ margin: 0 }}>{s.excerpt}…</p>}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}

function Timeline({ onPick }: { onPick: (p: Record<string, string | null>) => void }) {
  const { t, i18n } = useTranslation();
  const q = useQuery({ queryKey: ['timeline'], queryFn: () => get<Array<{ decade: number; stories: number; years: Array<{ year: number; stories: number }>; incidents: any[] }>>('/timeline') });
  if (q.isLoading) return <Skeleton lines={3} />;
  if (q.error) return <Problem error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <h2>{t('Timeline')}</h2>
      <p className="dim small">{t('Browse stories by the decade and year in which the events happened.')}</p>
      {q.data!.length === 0 && <Empty icon="timeline" title={t('No dated stories yet')} />}
      {q.data!.map((d) => (
        <section key={d.decade} className="tl-decade">
          <h3><button className="linkbtn" onClick={() => onPick({ decade: String(d.decade), year: null })}>{d.decade}s</button> <span className="dim small">{t('{n} stories', { n: d.stories })}</span></h3>
          <div className="tl-years">{d.years.map((y) => <button key={y.year} className="chip" onClick={() => onPick({ year: String(y.year), decade: null })}>{y.year} · {y.stories}</button>)}</div>
          {d.incidents.length > 0 && <ul className="list small">{d.incidents.map((i) => <li key={i.id}><span className="dot red" /> <Link to={`/incidents/${i.code}`}>{i.title}</Link> <span className="dim">{fmtDate(i.eventDate, i18n.language)}</span></li>)}</ul>}
        </section>
      ))}
    </div>
  );
}

function Collections() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['collections'], queryFn: () => get<any[]>('/collections') });
  if (q.isLoading) return <Skeleton lines={3} />;
  if (q.error) return <Problem error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <h2>{t('Collections and online exhibitions')}</h2>
      {q.data!.length === 0 && <Empty icon="collection" title={t('No collections yet')} />}
      <div className="grid2">{q.data!.map((c) => (
        <Link key={c.id} to={`/collections/${c.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="kind">{c.kind === 'exhibition' ? t('Online exhibition') : t('Collection')}</span>
          <h3 style={{ margin: '.3rem 0' }}>{c.title}</h3><p className="small" style={{ margin: 0 }}>{c.description.slice(0, 160)}{c.description.length > 160 ? '…' : ''}</p>
          <p className="meta" style={{ marginBottom: 0 }}>{t('{n} stories', { n: c.stories })}</p>
        </Link>
      ))}</div>
    </div>
  );
}
