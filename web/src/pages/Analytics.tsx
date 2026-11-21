import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, get, post } from '../lib/api';
import { useApp } from '../lib/app';
import { Chart } from '../components/Chart';
import { Icon } from '../components/Icon';
import { fmtDate, Problem, Skeleton } from '../components/ui';

/** The AI review guidelines (Section 5.2), named as in the rules. */
const GUIDELINE_NAMES: Record<string, string> = {
  safety: 'Safety', privacy: 'Privacy', harassment: 'Harassment and hate speech', misinformation: 'Misinformation',
  political: 'Political campaigning', spam: 'Spam and impersonation', inappropriate: 'Graphic or inappropriate content', unknown: 'Not recorded',
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Live analytics: the measures the project reports, and charts by day, week, month or year that update as things happen. */
export default function Analytics({ canCalibrate }: { canCalibrate?: boolean }) {
  const { t } = useTranslation();
  const { socket } = useApp();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [range, setRange] = useState({ from: '', to: '' });
  const charts = useQuery({ queryKey: ['analytics', 'charts'], queryFn: () => get<Array<{ key: string; title: string }>>('/admin/analytics/charts'), staleTime: 600_000 });
  const summary = useQuery({ queryKey: ['analytics', 'summary', range], queryFn: () => get<Record<string, any>>('/admin/analytics/summary', range) });
  const series = useQueries({ queries: (charts.data ?? []).map((c) => ({ queryKey: ['analytics', 'series', c.key, period, range], queryFn: () => get(`/admin/analytics/series`, { chart: c.key, period, ...range }) })) });
  // Live: the server says when the numbers change.
  useEffect(() => { if (!socket) return; let h = 0; const f = () => { clearTimeout(h); h = window.setTimeout(() => void qc.invalidateQueries({ queryKey: ['analytics'] }), 1500); }; socket.on('analytics', f); return () => { socket.off('analytics', f); clearTimeout(h); }; }, [socket, qc]);
  const s = summary.data;
  const stats: Array<[string, any]> = s ? [[t('Published stories'), s.publishedStories], [t('Testimonies'), s.testimonies], [t('Historical records'), s.historicalRecords], [t('Incidents documented'), s.incidents], [t('Incidents on the map'), s.incidentsMapped], [t('Counties represented'), s.counties], [t('Water bodies'), s.waterBodies],
    [t('Contributors'), s.contributors], [t('Trained active contributors'), s.trainedActive], [t('Active users this month'), s.monthlyActiveUsers], [t('Visitors this month'), s.monthlyVisitors], [t('Stories not in English'), `${s.nonEnglishPercent}%`], [t('Stories with audio or video'), s.audioVideo],
    [t('Learning resources'), s.resources], [t('Resource views'), s.resourceViews], [t('Resource downloads'), s.resourceDownloads], [t('Citations'), s.citations], [t('Story downloads'), s.storyDownloads], [t('Open reports'), s.openReports], [t('Safety concerns'), s.safetyConcerns], [t('RED items reviewed within 24 h'), `${s.redWithin24hPercent}%`], [t('AI override rate'), `${s.aiOverrideRatePercent}%`]] : [];
  return (
    <div>
      <div className="row between" style={{ marginBottom: '.6rem' }}>
        <div className="row" role="group" aria-label={t('Period')}>{(['day', 'week', 'month', 'year'] as const).map((p) => <button key={p} className={`chip ${period === p ? 'on' : ''}`} aria-pressed={period === p} onClick={() => setPeriod(p)}>{t({ day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Annual' }[p])}</button>)}</div>
        <div className="row"><label className="small">{t('From')} <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label><label className="small">{t('To')} <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label><span className="kind"><span className="dot green" /> {t('Live')}</span></div>
      </div>
      {summary.isLoading ? <Skeleton lines={2} /> : summary.error ? <Problem error={summary.error} retry={() => summary.refetch()} /> : <div className="statgrid">{stats.map(([label, v]) => <div className="stat" key={label}><b>{v ?? 0}</b><span>{label}</span></div>)}</div>}
      <div className="grid2 charts">{series.map((q, i) => q.data ? <div className="card" key={charts.data![i].key}><Chart title={t(q.data.title)} labels={q.data.labels} series={q.data.series.map((x: any) => ({ ...x, name: t(x.name) }))} kind={period === 'day' ? 'line' : 'bar'} /></div> : <div className="card" key={i}><Skeleton lines={2} /></div>)}</div>
      {s && (
        <div className="grid2" style={{ marginTop: '.8rem' }}>
          <div className="card"><b>{t('AI flags by language')}</b><table className="table"><thead><tr><th>{t('Language')}</th><th>{t('Stories')}</th><th>YELLOW</th><th>RED</th></tr></thead><tbody>{s.flagRatesByLanguage.map((r: any) => <tr key={r.language} style={{ cursor: 'default' }}><td>{r.language}</td><td>{r.stories}</td><td>{r.yellow}</td><td>{r.red}</td></tr>)}</tbody></table><p className="small dim">{t('Watched so that no language is flagged unfairly.')}</p></div>
          <div className="card"><b>{t('Stories by county')}</b><table className="table"><thead><tr><th>{t('County')}</th><th>{t('Stories')}</th><th>RED</th></tr></thead><tbody>{s.flagRatesByRegion.map((r: any) => <tr key={r.county} style={{ cursor: 'default' }}><td>{r.county || '—'}</td><td>{r.stories}</td><td>{r.red}</td></tr>)}</tbody></table></div>
          {s.safetyPlaces?.length > 0 && <div className="card"><b>{t('Places with the most safety concerns')}</b><ul>{s.safetyPlaces.map((p: any) => <li key={p.place ?? p.placeName}>{p.place ?? p.placeName}: {p.count ?? p.concerns}</li>)}</ul></div>}
        </div>
      )}
      <AiQuality canCalibrate={canCalibrate} />
      <PdfReports charts={charts.data ?? []} />
    </div>
  );
}

function AiQuality({ canCalibrate }: { canCalibrate?: boolean }) {
  const { t } = useTranslation();
  const { toast } = useApp();
  const q = useQuery({ queryKey: ['analytics', 'ai'], queryFn: () => get('/admin/analytics/ai') });
  const [th, setTh] = useState<{ yellowAbove: number; redFrom: number } | null>(null);
  useEffect(() => { if (q.data) setTh(q.data.thresholds); }, [q.data]);
  if (!q.data || !th) return null;
  const a = q.data;
  return (
    <section className="card" style={{ marginTop: '.8rem' }}>
      <h3 style={{ marginTop: 0 }}>{t('AI quality')}</h3>
      <div className="statgrid"><div className="stat"><b>{a.agreementPercent ?? '—'}{a.agreementPercent != null && '%'}</b><span>{t('Admins agreed with RED flags')}</span></div><div className="stat"><b>{a.wronglyBlockedPercent}%</b><span>{t('Wrongly blocked (overridden)')}</span></div><div className="stat"><b>{a.red}</b><span>{t('RED items')}</span></div><div className="stat"><b>{(a.usageToday ?? []).reduce((n: number, x: any) => n + x.calls, 0)}</b><span>{t('AI checks today')} · {a.provider}</span></div></div>
      {a.byGuideline?.length > 0 && (
        <div className="scroll-x"><table className="table" style={{ marginBottom: '.6rem' }}>
          <caption className="small" style={{ textAlign: 'start' }}>{t('Overrides by guideline, last 90 days. A high share on one guideline means its guidance needs adjusting.')}</caption>
          <thead><tr><th>{t('Guideline')}</th><th>{t('RED stories')}</th><th>{t('Overridden')}</th><th>{t('Share overridden')}</th></tr></thead>
          <tbody>{a.byGuideline.map((g: { guideline: string; red: number; overridden: number; overridePercent: number }) => (
            <tr key={g.guideline} style={{ cursor: 'default' }}><td>{t(GUIDELINE_NAMES[g.guideline] ?? g.guideline)}</td><td>{g.red}</td><td>{g.overridden}</td><td>{g.overridePercent}%</td></tr>
          ))}</tbody>
        </table></div>
      )}
      <p className="small">{t('GREEN up to {g}, YELLOW above {g} and below {r}, RED from {r}.', { g: a.thresholds.yellowAbove, r: a.thresholds.redFrom })}</p>
      {canCalibrate && (
        <form className="row" onSubmit={async (e) => { e.preventDefault(); try { const r = await api('/admin/analytics/ai/thresholds', { method: 'PUT', body: th }); toast(r?.message ?? t('Thresholds saved.')); void q.refetch(); } catch (er: any) { toast(er.message, 'error'); } }}>
          <label className="small">{t('YELLOW above')} <input type="number" min={0} max={99} value={th.yellowAbove} onChange={(e) => setTh({ ...th, yellowAbove: Number(e.target.value) })} style={{ width: 80 }} /></label>
          <label className="small">{t('RED from')} <input type="number" min={1} max={100} value={th.redFrom} onChange={(e) => setTh({ ...th, redFrom: Number(e.target.value) })} style={{ width: 80 }} /></label>
          <button className="btn small">{t('Recalibrate')}</button>
        </form>
      )}
    </section>
  );
}

/** PDF reports: pick a period and charts; previous and automatic monthly reports are listed below. */
export function PdfReports({ charts }: { charts: Array<{ key: string; title: string }> }) {
  const { t, i18n } = useTranslation();
  const { toast } = useApp();
  const now = new Date();
  const [f, setF] = useState({ from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now), title: '' });
  const [pick, setPick] = useState<string[] | null>(null);
  const q = useQuery({ queryKey: ['analytics', 'reports'], queryFn: () => get<any[]>('/admin/analytics/reports'), refetchInterval: (x) => (x.state.data?.some((r) => r.status === 'preparing' || r.status === 'queued') ? 3000 : false) });
  const chosen = pick ?? charts.map((c) => c.key);
  return (
    <section className="card" style={{ marginTop: '.8rem' }}>
      <h3 style={{ marginTop: 0 }}>{t('PDF reports')}</h3>
      <form onSubmit={async (e) => { e.preventDefault(); try { const r = await post('/admin/analytics/reports', { from: f.from, to: f.to, title: f.title.trim() || undefined, charts: chosen }); toast(r.message); void q.refetch(); } catch (er: any) { toast(er.message, 'error'); } }}>
        <div className="grid2">
          <label className="field"><span>{t('From')}</span><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} required /></label>
          <label className="field"><span>{t('To')}</span><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} required /></label>
          <label className="field"><span>{t('Title (optional)')}</span><input type="text" value={f.title} maxLength={160} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        </div>
        <fieldset style={{ border: 0, padding: 0 }}><legend className="label">{t('Charts to include')}</legend><div className="row">{charts.map((c) => <label key={c.key} className="check" style={{ margin: 0 }}><input type="checkbox" checked={chosen.includes(c.key)} onChange={(e) => setPick(e.target.checked ? [...chosen, c.key] : chosen.filter((k) => k !== c.key))} /><span>{t(c.title)}</span></label>)}</div></fieldset>
        <button className="btn primary" disabled={!chosen.length}><Icon name="document" size={17} />{t('Generate PDF report')}</button>
      </form>
      <h4>{t('Previous reports')}</h4>
      {!q.data?.length ? <p className="dim small">{t('No reports yet. A monthly report is generated automatically on the first day of each month.')}</p> : (
        <ul className="list">{q.data.map((r) => <li key={r.id} className="row between"><span><b>{r.title}</b>{r.automatic && <span className="kind" style={{ marginInlineStart: 6 }}>{t('Automatic')}</span>}<span className="meta" style={{ display: 'block' }}>{fmtDate(r.periodFrom, i18n.language)} – {fmtDate(r.periodTo, i18n.language)} · {t('made {date}', { date: fmtDate(r.createdAt, i18n.language) })}</span></span>
          {r.status === 'ready' && r.url ? <a className="btn small" href={r.url} target="_blank" rel="noopener noreferrer"><Icon name="download" size={15} />PDF</a> : r.status === 'failed' ? <span className="dim">{t('Failed')}</span> : <span className="dim"><span className="spinner" /> {t('Generating report…')}</span>}</li>)}</ul>
      )}
    </section>
  );
}
