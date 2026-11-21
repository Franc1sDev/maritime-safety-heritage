import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, get, post } from '../lib/api';
import { useApp } from '../lib/app';
import { uploadFile } from '../lib/upload';
import { Icon } from '../components/Icon';
import { MapView } from '../components/MapView';
import type { Story } from '../components/Story';
import { Confirm, Dialog, Empty, fmtDate, Problem, Skeleton } from '../components/ui';
import { Combo } from './Stories';

export default function AdminContent({ tab }: { tab: string }) {
  return tab === 'company' ? <Company /> : tab === 'collections' ? <Collections /> : tab === 'incidents' ? <Incidents /> : tab === 'import' ? <ImportExport /> : tab === 'resources' ? <Resources /> : tab === 'announcements' ? <AnnouncementsAdmin /> : <Company />;
}
const useRun = () => { const { toast } = useApp(); const { t } = useTranslation(); return async (fn: () => Promise<any>, ok?: string) => { try { const r = await fn(); toast(r?.message ?? ok ?? t('Saved.')); return r ?? true; } catch (e: any) { toast(e.details?.length ? `${e.message} ${[].concat(e.details).join(' ')}` : e.message, 'error'); return null; } }; };
const StoryPick = ({ onPick }: { onPick: (s: Story) => void }) => { const { t } = useTranslation(); return <Combo<Story> label={t('Add a story')} placeholder={t('Search by story ID or words')} none={t('No story matches.')} load={async (q) => (q ? (await get('/stories', { q, tab: 'recent', limit: 8 })).items : [])} render={(s) => <span><b>{s.code}</b> {s.title || s.text.slice(0, 50)}</span>} onPick={onPick} />; };

// ---------- Company stories ----------
function Company() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['moderation', 'awaiting'], queryFn: () => get<{ items: Story[] }>('/admin/moderation', { filter: 'awaiting' }) });
  return (
    <div>
      <p>{t('A company story is written by one admin and published under “Admin” with the platform logo once the other admins approve it. Testimonies and historical records are added the same way.')}</p>
      <div className="row"><button className="btn primary" onClick={() => nav('/?share=company')}><Icon name="plus" size={17} />{t('Add a company story')}</button><button className="btn" onClick={() => nav('/?share=1')}>{t('Add a testimony or historical record')}</button></div>
      <h3>{t('Waiting for approval or validation')}</h3>
      {q.isLoading ? <Skeleton lines={2} /> : !q.data?.items.length ? <p className="dim">{t('Nothing is waiting.')}</p> : <ul className="list">{q.data.items.map((s) => <li key={s.id}><span className="kind">{t(s.typeLabel)}</span> <b>{s.title || s.code}</b> <span className="flag none">{t(s.status.replace(/_/g, ' '))}</span><div className="meta">{s.code} · {fmtDate(s.createdAt, i18n.language)}</div></li>)}</ul>}
      <p className="small"><Link to="/admin/approvals">{t('See approval requests')}</Link></p>
    </div>
  );
}

// ---------- Collections ----------
function Collections() {
  const { t } = useTranslation();
  const run = useRun();
  const q = useQuery({ queryKey: ['collections', 'admin'], queryFn: () => get<any[]>('/collections') });
  const [edit, setEdit] = useState<null | { id?: string; title: string; description: string; kind: string; items: Array<{ storyId: string; note: string; label: string }>; justification: string }>(null);
  const open = async (id: string) => { const c = await get(`/collections/${id}`); setEdit({ id, title: c.title, description: c.description, kind: c.kind, items: c.items.map((i: any) => ({ storyId: i.story.id, note: i.note, label: `${i.story.code} ${i.story.title}` })), justification: '' }); };
  const save = async (submit: boolean) => {
    if (!edit) return;
    const body = { title: edit.title.trim(), description: edit.description, kind: edit.kind, items: edit.items.map((i) => ({ storyId: i.storyId, note: i.note || undefined })), submit, justification: submit ? edit.justification.trim() || undefined : undefined };
    if (await run(() => (edit.id ? api(`/admin/collections/${edit.id}`, { method: 'PATCH', body }) : post('/admin/collections', body)))) { setEdit(null); void q.refetch(); }
  };
  return (
    <div>
      <div className="row between"><p className="dim small" style={{ margin: 0 }}>{t('Themed collections and online exhibitions. A collection is published once approved.')}</p><button className="btn primary small" onClick={() => setEdit({ title: '', description: '', kind: 'collection', items: [], justification: '' })}><Icon name="plus" size={15} />{t('New collection')}</button></div>
      {q.isLoading ? <Skeleton /> : q.error ? <Problem error={q.error} retry={() => q.refetch()} /> : (
        <ul className="list">{q.data!.map((c) => <li key={c.id} className="row between"><span><b>{c.title}</b> <span className="kind">{c.kind === 'exhibition' ? t('Online exhibition') : t('Collection')}</span> <span className="flag none">{t(c.status.replace(/_/g, ' '))}</span><span className="meta" style={{ display: 'block' }}>{t('{n} stories', { n: c.stories })}</span></span><button className="btn small" onClick={() => void open(c.id)}>{t('Edit')}</button></li>)}</ul>
      )}
      {edit && (
        <Dialog title={edit.id ? t('Edit collection') : t('New collection')} onClose={() => setEdit(null)} wide>
          <div className="grid2"><label className="field"><span>{t('Title')}</span><input type="text" value={edit.title} maxLength={160} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
            <label className="field"><span>{t('Kind')}</span><select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}><option value="collection">{t('Collection')}</option><option value="exhibition">{t('Online exhibition')}</option></select></label></div>
          <label className="field"><span>{t('Description')}</span><textarea rows={4} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
          <div className="field"><span>{t('Stories in this collection')} ({edit.items.length})</span><StoryPick onPick={(s) => !edit.items.some((i) => i.storyId === s.id) && setEdit({ ...edit, items: [...edit.items, { storyId: s.id, note: '', label: `${s.code} ${s.title}` }] })} /></div>
          <ol>{edit.items.map((it, i) => <li key={it.storyId} style={{ marginBottom: '.3rem' }}><b className="small">{it.label}</b> <button className="linkbtn small" disabled={i === 0} onClick={() => { const a = [...edit.items]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setEdit({ ...edit, items: a }); }}>↑</button> <button className="linkbtn small" onClick={() => setEdit({ ...edit, items: edit.items.filter((x) => x.storyId !== it.storyId) })}>{t('Remove')}</button>
            <input type="text" value={it.note} placeholder={t('Curator’s note (optional)')} aria-label={t('Curator’s note')} onChange={(e) => setEdit({ ...edit, items: edit.items.map((x) => (x.storyId === it.storyId ? { ...x, note: e.target.value } : x)) })} style={{ width: '100%' }} /></li>)}</ol>
          <label className="field"><span>{t('Note for the admins who approve it')}</span><input type="text" value={edit.justification} onChange={(e) => setEdit({ ...edit, justification: e.target.value })} /></label>
          <div className="actions"><button className="btn quiet" onClick={() => setEdit(null)}>{t('Cancel')}</button><button className="btn" disabled={edit.title.trim().length < 3} onClick={() => void save(false)}>{t('Save draft')}</button><button className="btn primary" disabled={edit.title.trim().length < 3 || !edit.items.length} onClick={() => void save(true)}>{t('Submit for approval')}</button></div>
        </Dialog>
      )}
    </div>
  );
}

// ---------- Incidents and places ----------
const blankIncident = { id: '' as string | undefined, title: '', eventDate: '', dateApproximate: false, placeId: null as number | null, placeName: '', latitude: null as number | null, longitude: null as number | null, waterBody: '', vessel: '', incidentType: '', summary: '', outcome: '', sources: '', status: 'published', stories: [] as Array<{ id: string; label: string }> };
function Incidents() {
  const { t, i18n } = useTranslation();
  const { config } = useApp();
  const run = useRun();
  const [status, setStatus] = useState('published');
  const q = useQuery({ queryKey: ['incidents', 'admin', status], queryFn: () => get<any[]>('/incidents', { status }) });
  const [edit, setEdit] = useState<typeof blankIncident | null>(null);
  const [place, setPlace] = useState<null | { name: string; type: string; county: string; waterBody: string; latitude: string; longitude: string; altNames: string }>(null);
  const [decline, setDecline] = useState<any>(null);
  const open = async (code: string) => { const i = await get(`/incidents/${code}`); setEdit({ ...blankIncident, ...i, eventDate: i.eventDate ?? '', status: i.status === 'suggested' ? 'published' : i.status, stories: i.linked.map((s: Story) => ({ id: s.id, label: `${s.code} ${s.title}` })) }); };
  const save = async () => {
    if (!edit) return;
    const body = { title: edit.title.trim(), eventDate: edit.eventDate || undefined, dateApproximate: edit.dateApproximate, placeId: edit.placeId ?? undefined, placeName: edit.placeName || undefined, latitude: edit.latitude ?? undefined, longitude: edit.longitude ?? undefined, waterBody: edit.waterBody || undefined, vessel: edit.vessel || undefined, incidentType: edit.incidentType || undefined, summary: edit.summary, outcome: edit.outcome, sources: edit.sources, status: edit.status, storyIds: edit.stories.map((s) => s.id) };
    if (await run(() => (edit.id ? api(`/admin/incidents/${edit.id}`, { method: 'PATCH', body }) : post('/admin/incidents', body)))) { setEdit(null); void q.refetch(); }
  };
  const set = (p: Partial<typeof blankIncident>) => setEdit((e) => (e ? { ...e, ...p } : e));
  return (
    <div>
      <div className="row between" style={{ marginBottom: '.5rem' }}>
        <div className="row">{[['published', t('Published')], ['suggested', t('Suggested by contributors')], ['draft', t('Drafts')]].map(([k, label]) => <button key={k} className={`chip ${status === k ? 'on' : ''}`} aria-pressed={status === k} onClick={() => setStatus(k)}>{label}</button>)}</div>
        <div className="row"><button className="btn small" onClick={() => setPlace({ name: '', type: 'landing site', county: '', waterBody: '', latitude: '', longitude: '', altNames: '' })}>{t('Add a place')}</button><button className="btn primary small" onClick={() => setEdit({ ...blankIncident, id: undefined })}><Icon name="plus" size={15} />{t('New incident record')}</button></div>
      </div>
      {q.isLoading ? <Skeleton /> : q.error ? <Problem error={q.error} retry={() => q.refetch()} /> : q.data!.length === 0 ? <Empty icon="incident" title={t('Nothing here')} /> : (
        <ul className="list">{q.data!.map((i) => <li key={i.id} className="row between"><span><b>{i.title}</b><span className="meta" style={{ display: 'block' }}>{[i.code, fmtDate(i.eventDate, i18n.language), i.placeName, i.waterBody, t('{n} linked stories', { n: i.stories })].filter(Boolean).join(' · ')}</span>{status === 'suggested' && i.summary && <span className="small">{i.summary}</span>}</span>
          <span className="row"><button className="btn small" onClick={() => void open(i.code ?? i.id)}>{status === 'suggested' ? t('Review and add') : t('Edit')}</button>{status === 'suggested' && <button className="btn small quiet" onClick={() => setDecline(i)}>{t('Decline')}</button>}</span></li>)}</ul>
      )}
      {decline && <Confirm title={t('Decline this suggested incident?')} yes={t('Decline')} onClose={() => setDecline(null)} onYes={async () => { await run(() => post(`/admin/incidents/${decline.id}/decline`)); void q.refetch(); }} />}
      {edit && (
        <Dialog title={edit.id ? t('Edit incident record') : t('New incident record')} onClose={() => setEdit(null)} wide>
          <label className="field"><span>{t('Name of the incident')}</span><input type="text" value={edit.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} /></label>
          <div className="grid2">
            <label className="field"><span>{t('Date')}</span><input type="date" value={edit.eventDate} onChange={(e) => set({ eventDate: e.target.value })} /><label className="check small"><input type="checkbox" checked={edit.dateApproximate} onChange={(e) => set({ dateApproximate: e.target.checked })} /><span>{t('Approximate')}</span></label></label>
            <div className="field"><span>{t('Place')}</span><Combo<any> label={t('Place')} placeholder={t('Type a place')} none={t('No match. Add the place first, or put a pin on the map.')} value={edit.placeName} load={async (q2) => { set({ placeName: q2 }); return get('/places', { q: q2 }); }} render={(p) => <span>{p.name} <span className="dim small">{p.county}</span></span>} onPick={(p) => set({ placeId: p.id, placeName: p.name, latitude: p.latitude, longitude: p.longitude, waterBody: edit.waterBody || p.waterBody })} /></div>
            <label className="field"><span>{t('Water body')}</span><input type="text" value={edit.waterBody} onChange={(e) => set({ waterBody: e.target.value })} /></label>
            <label className="field"><span>{t('Vessel')}</span><input type="text" value={edit.vessel} onChange={(e) => set({ vessel: e.target.value })} /></label>
            <label className="field"><span>{t('Type')}</span><select value={edit.incidentType} onChange={(e) => set({ incidentType: e.target.value })}><option value="">{t('Choose…')}</option>{config?.incidentTypes.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="field"><span>{t('Status')}</span><select value={edit.status} onChange={(e) => set({ status: e.target.value })}><option value="published">{t('Published')}</option><option value="draft">{t('Draft')}</option></select></label>
          </div>
          <div style={{ height: 240, display: 'flex', marginBottom: '.5rem' }}><MapView markers={[]} picked={edit.latitude != null && edit.longitude != null ? [edit.latitude, edit.longitude] : null} onPick={(lat, lng) => set({ latitude: Number(lat.toFixed(5)), longitude: Number(lng.toFixed(5)) })} /></div>
          <label className="field"><span>{t('Summary of what happened')}</span><textarea rows={4} value={edit.summary} onChange={(e) => set({ summary: e.target.value })} /></label>
          <label className="field"><span>{t('Outcome')}</span><textarea rows={2} value={edit.outcome} onChange={(e) => set({ outcome: e.target.value })} /></label>
          <label className="field"><span>{t('Sources')}</span><textarea rows={2} value={edit.sources} onChange={(e) => set({ sources: e.target.value })} /></label>
          <div className="field"><span>{t('Linked stories and records')} ({edit.stories.length})</span><StoryPick onPick={(s) => !edit.stories.some((x) => x.id === s.id) && set({ stories: [...edit.stories, { id: s.id, label: `${s.code} ${s.title}` }] })} />
            <div className="row" style={{ marginTop: '.3rem' }}>{edit.stories.map((s) => <span key={s.id} className="chip static">{s.label.slice(0, 40)} <button className="linkbtn" onClick={() => set({ stories: edit.stories.filter((x) => x.id !== s.id) })} aria-label={t('Remove')}>×</button></span>)}</div></div>
          <div className="actions"><button className="btn quiet" onClick={() => setEdit(null)}>{t('Cancel')}</button><button className="btn primary" disabled={edit.title.trim().length < 3} onClick={() => void save()}>{t('Save')}</button></div>
        </Dialog>
      )}
      {place && (
        <Dialog title={t('Add a place')} onClose={() => setPlace(null)}>
          <div className="grid2">
            <label className="field"><span>{t('Name')}</span><input type="text" value={place.name} onChange={(e) => setPlace({ ...place, name: e.target.value })} /></label>
            <label className="field"><span>{t('Kind of place')}</span><select value={place.type} onChange={(e) => setPlace({ ...place, type: e.target.value })}>{['port', 'town', 'beach', 'island', 'landing site', 'lake', 'river', 'crossing', 'village', 'city'].map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></label>
            <label className="field"><span>{t('County')}</span><input type="text" value={place.county} onChange={(e) => setPlace({ ...place, county: e.target.value })} /></label>
            <label className="field"><span>{t('Water body')}</span><input type="text" value={place.waterBody} onChange={(e) => setPlace({ ...place, waterBody: e.target.value })} /></label>
            <label className="field"><span>{t('Latitude')}</span><input type="number" step="any" value={place.latitude} onChange={(e) => setPlace({ ...place, latitude: e.target.value })} /></label>
            <label className="field"><span>{t('Longitude')}</span><input type="number" step="any" value={place.longitude} onChange={(e) => setPlace({ ...place, longitude: e.target.value })} /></label>
          </div>
          <label className="field"><span>{t('Other names (separate with commas)')}</span><input type="text" value={place.altNames} onChange={(e) => setPlace({ ...place, altNames: e.target.value })} /></label>
          <div className="actions"><button className="btn quiet" onClick={() => setPlace(null)}>{t('Cancel')}</button><button className="btn primary" disabled={place.name.trim().length < 2} onClick={async () => { if (await run(() => post('/admin/places', { name: place.name.trim(), type: place.type, county: place.county || undefined, waterBody: place.waterBody || undefined, latitude: place.latitude ? Number(place.latitude) : undefined, longitude: place.longitude ? Number(place.longitude) : undefined, altNames: place.altNames.split(',').map((x) => x.trim()).filter(Boolean) }))) setPlace(null); }}>{t('Save')}</button></div>
        </Dialog>
      )}
    </div>
  );
}

// ---------- Import and export ----------
function ImportExport() {
  const { t, i18n } = useTranslation();
  const { toast } = useApp();
  const run = useRun();
  const [sp] = useSearchParams();
  const list = useQuery({ queryKey: ['import'], queryFn: () => get<any[]>('/admin/import') });
  const exports = useQuery({ queryKey: ['archive-export'], queryFn: () => get<any[]>('/admin/export/archive'), refetchInterval: (x) => (x.state.data?.some((e) => e.status === 'preparing') ? 4000 : false) });
  const [files, setFiles] = useState<Array<{ name: string; pct: number; done: boolean; error?: string }>>([]);
  const [batch, setBatch] = useState<any>(null);
  const [busy, setBusy] = useState(false); const [why, setWhy] = useState(''); const [media, setMedia] = useState(false);
  useEffect(() => { const id = sp.get('open'); if (id) void get(`/admin/import/${id}`).then(setBatch).catch(() => undefined); }, [sp]);
  async function addFiles(l: FileList | null) {
    for (const file of Array.from(l ?? [])) {
      setFiles((f) => [...f, { name: file.name, pct: 0, done: false }]);
      const upd = (p: Partial<{ pct: number; done: boolean; error: string }>) => setFiles((f) => f.map((x) => (x.name === file.name ? { ...x, ...p } : x)));
      try { await uploadFile(file, /consent/i.test(file.name) ? 'consent' : 'import', (pct) => upd({ pct })).promise; upd({ done: true, pct: 100 }); } catch (e: any) { upd({ error: e.message }); }
    }
  }
  async function check(file: File | undefined) {
    if (!file) return; setBusy(true);
    const form = new FormData(); form.append('spreadsheet', file);
    try { const r = await api('/admin/import', { form }); setBatch(r); toast(r.message); void list.refetch(); } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  }
  return (
    <div className="stack">
      <section className="card">
        <h3 style={{ marginTop: 0 }}>{t('Import many items at once')}</h3>
        <ol className="small">
          <li>{t('Download the metadata spreadsheet and fill one row per item.')} <button className="linkbtn" onClick={async () => { const csv = await api<string>('/admin/import/template'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'metadata-template.csv'; a.click(); }}>{t('Download the template')}</button></li>
          <li>{t('Upload the files named in the spreadsheet (recordings, photographs, scans, consent forms).')} <label className="linkbtn" style={{ cursor: 'pointer' }}>{t('Choose files')}<input type="file" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} /></label></li>
          <li>{t('Upload the filled spreadsheet (CSV or Excel). Every row is checked; nothing is created yet.')} <label className="linkbtn" style={{ cursor: 'pointer' }}>{busy ? <span className="spinner" /> : t('Choose the spreadsheet')}<input type="file" accept=".csv,.xlsx" hidden onChange={(e) => { void check(e.target.files?.[0]); e.target.value = ''; }} /></label></li>
          <li>{t('Submit the batch for approval as one request.')}</li>
        </ol>
        {files.length > 0 && <ul className="list small">{files.map((f) => <li key={f.name} className="row between"><span style={{ overflowWrap: 'anywhere' }}>{f.name}</span>{f.error ? <span className="error-text">{f.error}</span> : f.done ? <span><Icon name="check" size={14} /> {t('Ready')}</span> : <span className="progress" style={{ width: 120 }}><i style={{ width: `${f.pct}%` }} /></span>}</li>)}</ul>}
      </section>
      {batch && (
        <section className="card">
          <div className="row between"><h3 style={{ margin: 0 }}>{batch.spreadsheet}</h3><span><span className="flag GREEN">{t('{n} ready', { n: batch.ready })}</span> <span className="flag YELLOW">{t('{n} need attention', { n: batch.needAttention })}</span> <span className="flag none">{t(batch.status.replace(/_/g, ' '))}</span></span></div>
          <div className="scroll-x"><table className="table"><thead><tr><th>{t('Row')}</th><th>{t('Title')}</th><th>{t('Type')}</th><th>{t('Place')}</th><th>{t('Files')}</th><th>AI</th><th>{t('Result')}</th></tr></thead>
            <tbody>{batch.rows.map((r: any) => <tr key={r.line} style={{ cursor: 'default' }}><td>{r.line}</td><td>{r.title}</td><td>{r.type}</td><td>{r.place}</td><td>{r.files}</td><td>{r.flag && <span className={`flag ${r.flag}`}>{r.flag}</span>}</td><td className="small">{r.ready ? <span><Icon name="check" size={14} /> {t('Ready')}</span> : <span className="error-text">{r.problems.join(' ')}</span>}{r.notes?.length > 0 && <span className="dim"> {r.notes.join(' ')}</span>}</td></tr>)}</tbody></table></div>
          {batch.status === 'checked' && <div className="row" style={{ marginTop: '.5rem' }}><input className="grow" type="text" value={why} onChange={(e) => setWhy(e.target.value)} placeholder={t('Note for the admins who approve it')} aria-label={t('Note for the admins who approve it')} /><button className="btn primary" disabled={!batch.ready} onClick={async () => { const r = await run(() => post(`/admin/import/${batch.id}/submit`, { justification: why.trim() || undefined })); if (r) { setBatch(r); void list.refetch(); } }}>{t('Submit {n} items for approval', { n: batch.ready })}</button></div>}
          {batch.itemsCreated > 0 && <p className="note good small">{t('{n} items were created.', { n: batch.itemsCreated })}</p>}
        </section>
      )}
      <section className="card"><h3 style={{ marginTop: 0 }}>{t('Earlier batches')}</h3>
        {!list.data?.length ? <p className="dim small">{t('No batches yet.')}</p> : <ul className="list small">{list.data.map((b) => <li key={b.id} className="row between"><span>{b.spreadsheetName} <span className="meta">{fmtDate(b.createdAt, i18n.language)} · {t('{n} ready', { n: b.ready })} · {t('{n} need attention', { n: b.needAttention })} · {t(b.status.replace(/_/g, ' '))}</span></span><button className="btn small" onClick={async () => setBatch(await get(`/admin/import/${b.id}`))}>{t('Open')}</button></li>)}</ul>}
      </section>
      <section className="card"><h3 style={{ marginTop: 0 }}>{t('Export the archive')}</h3>
        <p className="small dim">{t('A full copy of the published archive in open formats (JSON and CSV with Dublin Core fields), for preservation and for partner institutions.')}</p>
        <div className="row"><label className="check" style={{ margin: 0 }}><input type="checkbox" checked={media} onChange={(e) => setMedia(e.target.checked)} /><span>{t('Include the files')}</span></label><button className="btn" onClick={async () => { await run(() => post('/admin/export/archive', { includeMedia: media })); void exports.refetch(); }}><Icon name="download" size={17} />{t('Prepare an export')}</button></div>
        <ul className="list small">{(exports.data ?? []).map((e) => <li key={e.id} className="row between"><span>{fmtDate(e.createdAt, i18n.language, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>{e.status === 'ready' && e.url ? <a className="btn small" href={e.url}>{t('Download')}</a> : <span className="dim">{e.status === 'preparing' ? <><span className="spinner" /> {t('Preparing…')}</> : t(e.status)}</span>}</li>)}</ul>
      </section>
    </div>
  );
}

// ---------- Learning resources ----------
function Resources() {
  const { t, i18n } = useTranslation();
  const { config } = useApp();
  const run = useRun();
  const q = useQuery({ queryKey: ['resources', 'admin'], queryFn: () => get<any[]>('/resources') });
  const cols = useQuery({ queryKey: ['collections', 'admin'], queryFn: () => get<any[]>('/collections') });
  const blank = { id: '' as string | undefined, title: '', type: 'learning_summary', summary: '', body: '', mediaId: '' as string | undefined, fileName: '', collectionId: '', audience: 'General public', language: 'en', status: 'published' };
  const [edit, setEdit] = useState<typeof blank | null>(null); const [del, setDel] = useState<any>(null); const [pct, setPct] = useState<number | null>(null);
  const open = async (id: string) => { const r = await get(`/resources/${id}`); setEdit({ ...blank, ...r, mediaId: r.mediaId ?? undefined, fileName: r.file?.name ?? '', collectionId: r.collectionId ?? '', summary: r.summary ?? '', body: r.body ?? '' }); };
  const save = async () => {
    if (!edit) return;
    const body = { title: edit.title.trim(), type: edit.type, summary: edit.summary, body: edit.body, mediaId: edit.mediaId || undefined, collectionId: edit.collectionId || undefined, audience: edit.audience, language: edit.language, status: edit.status };
    if (await run(() => (edit.id ? api(`/admin/resources/${edit.id}`, { method: 'PATCH', body }) : post('/admin/resources', body)))) { setEdit(null); void q.refetch(); }
  };
  return (
    <div>
      <div className="row between"><p className="dim small" style={{ margin: 0 }}>{t('Policy briefs, learning summaries, educational materials, the handbook and online exhibitions.')}</p><button className="btn primary small" onClick={() => setEdit({ ...blank, id: undefined })}><Icon name="plus" size={15} />{t('New resource')}</button></div>
      {q.isLoading ? <Skeleton /> : q.error ? <Problem error={q.error} retry={() => q.refetch()} /> : (
        <ul className="list">{q.data!.map((r) => <li key={r.id} className="row between"><span><span className="kind">{t(r.typeLabel)}</span> <b>{r.title}</b> {r.status !== 'published' && <span className="flag none">{t(r.status)}</span>}<span className="meta" style={{ display: 'block' }}>{[t(r.audience), fmtDate(r.publishedAt, i18n.language), t('{n} views', { n: r.views }), t('{n} downloads', { n: r.downloads })].filter(Boolean).join(' · ')}</span></span>
          <span className="row"><button className="btn small" onClick={() => void open(r.id)}>{t('Edit')}</button><button className="xbtn" onClick={() => setDel(r)} aria-label={t('Remove')}><Icon name="trash" size={16} /></button></span></li>)}</ul>
      )}
      {del && <Confirm title={t('Remove “{title}”?', { title: del.title })} yes={t('Remove')} danger onClose={() => setDel(null)} onYes={async () => { await run(() => api(`/admin/resources/${del.id}`, { method: 'DELETE' })); void q.refetch(); }} />}
      {edit && (
        <Dialog title={edit.id ? t('Edit resource') : t('New resource')} onClose={() => setEdit(null)} wide>
          <label className="field"><span>{t('Title')}</span><input type="text" value={edit.title} maxLength={200} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
          <div className="grid2">
            <label className="field"><span>{t('Type')}</span><select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}>{Object.entries(config?.resourceTypes ?? {}).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select></label>
            <label className="field"><span>{t('For')}</span><select value={edit.audience} onChange={(e) => setEdit({ ...edit, audience: e.target.value })}>{config?.audiences.map((a) => <option key={a} value={a}>{t(a)}</option>)}</select></label>
            <label className="field"><span>{t('Language')}</span><select value={edit.language} onChange={(e) => setEdit({ ...edit, language: e.target.value })}>{config?.languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</select></label>
            <label className="field"><span>{t('Status')}</span><select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="published">{t('Published')}</option><option value="draft">{t('Draft')}</option></select></label>
          </div>
          <label className="field"><span>{t('Summary')}</span><textarea rows={2} value={edit.summary} maxLength={2000} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} /></label>
          <label className="field"><span>{t('Text to read on screen')}</span><textarea rows={8} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></label>
          <p className="small"><label className="linkbtn" style={{ cursor: 'pointer' }}><Icon name="upload" size={14} /> {t('File to download (PDF, document, audio or video)')}<input type="file" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setPct(0); try { const m = await uploadFile(file, 'resource', setPct).promise; setEdit((x) => (x ? { ...x, mediaId: m.id, fileName: m.name } : x)); } catch (er: any) { await run(() => Promise.reject(er)); } finally { setPct(null); } }} /></label> {pct !== null ? `${pct}%` : edit.fileName}</p>
          {edit.type === 'exhibition' && <label className="field"><span>{t('Collection shown in this exhibition')}</span><select value={edit.collectionId} onChange={(e) => setEdit({ ...edit, collectionId: e.target.value })}><option value="">{t('Choose…')}</option>{(cols.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>}
          <div className="actions"><button className="btn quiet" onClick={() => setEdit(null)}>{t('Cancel')}</button><button className="btn primary" disabled={edit.title.trim().length < 3 || pct !== null} onClick={() => void save()}>{t('Save')}</button></div>
        </Dialog>
      )}
    </div>
  );
}

// ---------- Announcements ----------
function AnnouncementsAdmin() {
  const { t, i18n } = useTranslation();
  const run = useRun();
  const q = useQuery({ queryKey: ['announcements'], queryFn: () => get<any[]>('/announcements') });
  const blank = { id: '' as string | undefined, title: '', summary: '', description: '', dates: [] as Array<{ date: string; endDate: string; label: string }>, sendPush: false };
  const [edit, setEdit] = useState<typeof blank | null>(null); const [del, setDel] = useState<any>(null);
  const save = async () => {
    if (!edit) return;
    const body = { title: edit.title.trim(), summary: edit.summary.trim(), description: edit.description, dates: edit.dates.filter((d) => d.date).map((d) => ({ date: d.date, endDate: d.endDate || undefined, label: d.label || undefined })), sendPush: edit.sendPush };
    if (await run(() => (edit.id ? api(`/admin/announcements/${edit.id}`, { method: 'PATCH', body }) : post('/admin/announcements', body)))) { setEdit(null); void q.refetch(); }
  };
  return (
    <div>
      <div className="row between"><p className="dim small" style={{ margin: 0 }}>{t('Announcements go to everyone. An edited announcement moves back to the top and is labelled “Edited”.')}</p><button className="btn primary small" onClick={() => setEdit({ ...blank, id: undefined })}><Icon name="plus" size={15} />{t('New announcement')}</button></div>
      {q.isLoading ? <Skeleton /> : (
        <ul className="list">{(q.data ?? []).map((a) => <li key={a.id} className="row between"><span><b>{a.title}</b>{a.edited && <span className="kind" style={{ marginInlineStart: 6 }}>{t('Edited')}</span>}<span className="meta" style={{ display: 'block' }}>{fmtDate(a.sortAt, i18n.language)} · {a.summary}</span></span>
          <span className="row"><button className="btn small" onClick={() => setEdit({ id: a.id, title: a.title, summary: a.summary ?? '', description: a.description ?? '', dates: a.dates.map((d: any) => ({ date: d.date, endDate: d.endDate ?? '', label: d.label ?? '' })), sendPush: false })}>{t('Edit')}</button><button className="xbtn" onClick={() => setDel(a)} aria-label={t('Delete')}><Icon name="trash" size={16} /></button></span></li>)}</ul>
      )}
      {del && <Confirm title={t('Delete “{title}”?', { title: del.title })} yes={t('Delete')} danger onClose={() => setDel(null)} onYes={async () => { await run(() => api(`/admin/announcements/${del.id}`, { method: 'DELETE' })); void q.refetch(); }} />}
      {edit && (
        <Dialog title={edit.id ? t('Edit announcement') : t('New announcement')} onClose={() => setEdit(null)} wide>
          <label className="field"><span>{t('Title')}</span><input type="text" value={edit.title} maxLength={160} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
          <label className="field"><span>{t('Summary')}</span><input type="text" value={edit.summary} maxLength={400} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} /></label>
          <label className="field"><span>{t('Full description')}</span><textarea rows={6} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
          <div className="field"><span>{t('Dates for the calendar')}</span>
            {edit.dates.map((d, i) => <div key={i} className="row" style={{ marginBottom: '.3rem' }}><input type="date" value={d.date} aria-label={t('Date')} onChange={(e) => setEdit({ ...edit, dates: edit.dates.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)) })} /><input type="date" value={d.endDate} aria-label={t('End date (optional)')} onChange={(e) => setEdit({ ...edit, dates: edit.dates.map((x, j) => (j === i ? { ...x, endDate: e.target.value } : x)) })} /><input className="grow" type="text" value={d.label} placeholder={t('What happens')} aria-label={t('What happens')} onChange={(e) => setEdit({ ...edit, dates: edit.dates.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} /><button className="xbtn" onClick={() => setEdit({ ...edit, dates: edit.dates.filter((_, j) => j !== i) })} aria-label={t('Remove')}><Icon name="close" size={14} /></button></div>)}
            <button className="btn small" onClick={() => setEdit({ ...edit, dates: [...edit.dates, { date: '', endDate: '', label: '' }] })}><Icon name="calendar" size={15} />{t('Add a date')}</button></div>
          <label className="check"><input type="checkbox" checked={edit.sendPush} onChange={(e) => setEdit({ ...edit, sendPush: e.target.checked })} /><span>{t('Also send a push notification')}</span></label>
          <div className="actions"><button className="btn quiet" onClick={() => setEdit(null)}>{t('Cancel')}</button><button className="btn primary" disabled={edit.title.trim().length < 3} onClick={() => void save()}>{edit.id ? t('Save') : t('Publish')}</button></div>
        </Dialog>
      )}
    </div>
  );
}
