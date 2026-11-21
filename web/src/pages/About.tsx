import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get, post } from '../lib/api';
import { useApp } from '../lib/app';
import { uploadFile } from '../lib/upload';
import { Icon, Logo } from '../components/Icon';
import { MapView } from '../components/MapView';
import { MediaView } from '../components/Media';
import { Dialog, Empty, fmtDate, Problem, Skeleton } from '../components/ui';

/** The rules frame: rules and netiquette, and how moderation works. It replaces the story frame. */
export function RulesFrame({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();
  const { config } = useApp();
  return (
    <div className={onClose ? 'frame' : ''}>
      <div className="row between"><h2 style={{ margin: 0 }}>{t('Rules and netiquette')}</h2>{onClose && <button className="xbtn" onClick={onClose} aria-label={t('Close and return to the stories')}><Icon name="close" size={18} /></button>}</div>
      <ol className="rules">{(config?.rules ?? []).map((r, i) => <li key={i}>{r}</li>)}</ol>
      <h3>{t('How stories are checked')}</h3>
      <p>{config?.moderationNote}</p>
      <p className="row"><span className="flag GREEN">GREEN</span> {t('posted')} <span className="flag YELLOW">YELLOW</span> {t('posted with a warning')} <span className="flag RED">RED</span> {t('blocked and reviewed by admins')}</p>
      <h3>{t('Stories about loss')}</h3>
      <p>{t('Many stories here remember people who died on the water. Write about them with care, and mark your story as sensitive if it may be distressing.')}</p>
      {config?.supportInfo && <p className="note small">{config.supportInfo}</p>}
    </div>
  );
}

/** "Report a safety concern": open to everyone, including visitors. Not an emergency service. */
export function SafetyConcernForm({ onDone }: { onDone?: () => void }) {
  const { t } = useTranslation();
  const { config, me } = useApp();
  const [f, setF] = useState({ description: '', placeName: '', contact: '', shareIdentity: true, website: '' });
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [photo, setPhoto] = useState<{ id: string; name: string } | null>(null);
  const [map, setMap] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [done, setDone] = useState<null | { code: string; message: string; notice: string; emergencyNumbers: string[] }>(null);
  if (done) return (
    <div className="note good" role="status">
      <h3 style={{ marginTop: 0 }}>{done.message}</h3><p>{t('Reference')}: <b>{done.code}</b></p><p>{done.notice}</p>
      {onDone && <button className="btn primary" onClick={onDone}>{t('Close')}</button>}
    </div>
  );
  return (
    <form onSubmit={async (e) => {
      e.preventDefault(); if (f.description.trim().length < 5) return setError(t('Describe the risk in a few words.'));
      setBusy(true); setError('');
      try { setDone(await post('/safety-concerns', { description: f.description.trim(), placeName: f.placeName.trim() || undefined, latitude: pos?.[0], longitude: pos?.[1], photoMediaId: photo?.id, contact: f.contact.trim() || undefined, shareIdentity: me ? f.shareIdentity : undefined, website: f.website || undefined })); }
      catch (er: any) { setError(er.message); } finally { setBusy(false); }
    }}>
      <div className="note bad" role="note"><b>{t('This is not an emergency service.')}</b> {config?.safetyNotice} {config?.emergencyNumbers?.length ? <b>{config.emergencyNumbers.join(' · ')}</b> : null}</div>
      <p className="small dim">{t('Tell the project team about a current safety risk on the water, for example an overloaded boat or missing life jackets.')}</p>
      <label className="field"><span>{t('What is the risk?')}</span><textarea rows={4} value={f.description} maxLength={4000} onChange={(e) => setF({ ...f, description: e.target.value })} required /></label>
      <label className="field"><span>{t('Place')}</span><input type="text" value={f.placeName} maxLength={160} onChange={(e) => setF({ ...f, placeName: e.target.value })} placeholder={t('Landing site, crossing, beach or town')} /></label>
      <p className="small"><button type="button" className="linkbtn" onClick={() => setMap(!map)}>{map ? t('Hide the map') : pos ? t('Move the pin on the map') : t('Put a pin on the map')}</button>
        {' · '}<button type="button" className="linkbtn" onClick={() => navigator.geolocation?.getCurrentPosition((p) => setPos([Number(p.coords.latitude.toFixed(5)), Number(p.coords.longitude.toFixed(5))]), () => setError(t('We could not get your location.')))}>{t('Use where I am now')}</button>{pos && <span className="dim"> {pos[0]}, {pos[1]}</span>}</p>
      {map && <div style={{ height: 260, display: 'flex', marginBottom: '.6rem' }}><MapView markers={[]} picked={pos} onPick={(lat, lng) => setPos([Number(lat.toFixed(5)), Number(lng.toFixed(5))])} /></div>}
      <p className="small"><label className="linkbtn" style={{ cursor: 'pointer' }}><Icon name="image" size={14} /> {t('Add a photo (optional)')}<input type="file" accept="image/*" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const m = await uploadFile(file, 'concern', () => undefined).promise; setPhoto({ id: m.id, name: m.name }); } catch (er: any) { setError(er.message); } }} /></label>{photo && <> {photo.name} <button type="button" className="linkbtn" onClick={() => setPhoto(null)}>{t('Remove')}</button></>}</p>
      {!me && <label className="field"><span>{t('How can we reach you? (optional)')}</span><input type="text" value={f.contact} maxLength={160} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder={t('Phone or email')} /></label>}
      {me && <label className="check"><input type="checkbox" checked={f.shareIdentity} onChange={(e) => setF({ ...f, shareIdentity: e.target.checked })} /><span>{t('The team may contact me about this in my INBOX')}</span></label>}
      <input type="text" name="website" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }} />
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="actions"><button className="btn primary" disabled={busy}>{busy ? <span className="spinner" /> : t('Send to the project team')}</button></div>
    </form>
  );
}
export const SafetyConcernDialog = ({ onClose }: { onClose: () => void }) => { const { t } = useTranslation(); return <Dialog title={t('Report a safety concern')} onClose={onClose}><SafetyConcernForm onDone={onClose} /></Dialog>; };

export function FeedbackForm() {
  const { t } = useTranslation();
  const { toast } = useApp();
  const [text, setText] = useState(''); const [trap, setTrap] = useState(''); const [busy, setBusy] = useState(false);
  return (
    <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { const r = await post('/feedback', { text: text.trim(), website: trap || undefined }); toast(r.message ?? t('Thank you. Your suggestion was sent.')); setText(''); } catch (er: any) { toast(er.message, 'error'); } finally { setBusy(false); } }}>
      <label className="field"><span>{t('How could the archive be better?')}</span><textarea rows={4} value={text} minLength={3} maxLength={4000} onChange={(e) => setText(e.target.value)} required /></label>
      <input type="text" value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }} />
      <div className="actions"><button className="btn primary" disabled={busy || text.trim().length < 3}>{t('Send feedback')}</button></div>
    </form>
  );
}

export default function About() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { slug } = useParams();
  const resourceSlug = /^\/resources\/([^/]+)/.exec(pathname)?.[1] ?? slug;
  const part = pathname.startsWith('/resources') ? 'resources' : pathname.startsWith('/safety') ? 'safety' : pathname.startsWith('/about/feedback') ? 'feedback' : pathname.startsWith('/privacy') ? 'privacy' : pathname.startsWith('/terms') ? 'terms' : pathname.startsWith('/rules') ? 'rules' : 'about';
  const tabs: Array<[string, string, string, string]> = [['about', '/about', 'about', t('About')], ['resources', '/resources', 'book', t('Learning resources')], ['safety', '/safety', 'warning', t('Report a safety concern')], ['feedback', '/about/feedback', 'edit', t('Suggest an improvement')]];
  return (
    <div>
      <div className="panel-head"><h1 style={{ margin: 0 }}>{t('About & Resources')}</h1></div>
      <nav className="subtabs" aria-label={t('About & Resources')}>{tabs.map(([k, to, icon, label]) => <Link key={k} to={to} className={`tab ${part === k ? 'on' : ''}`} aria-current={part === k ? 'page' : undefined}><Icon name={icon} />{label}</Link>)}</nav>
      {part === 'about' && <AboutText />}
      {part === 'resources' && (resourceSlug ? <Resource slug={resourceSlug} /> : <Resources />)}
      {part === 'safety' && <><h2>{t('Report a safety concern')}</h2><SafetyConcernForm /></>}
      {part === 'feedback' && <><h2>{t('Suggest an improvement')}</h2><p className="dim">{t('Tell us what would make the archive easier or more useful. This form is about the archive itself.')}</p><FeedbackForm /></>}
      {part === 'rules' && <RulesFrame />}
      {part === 'privacy' && <Privacy />}
      {part === 'terms' && <Terms />}
    </div>
  );
}

function AboutText() {
  const { t } = useTranslation();
  const { me } = useApp();
  return (
    <article className="prose">
      <p className="row"><Logo size={56} /> <b style={{ fontSize: '1.15rem' }}>Remembering the Waters</b></p>
      <p>{t('Remembering the Waters is Kenya’s first national archive dedicated to maritime and inland-water safety heritage. It documents past ferry and boat disasters, everyday safety experiences and community knowledge from the coast, the lakes and the rivers, so that lives lost and lessons learned are not forgotten.')}</p>
      <h2>{t('What this platform is for')}</h2>
      <p>{t('People who live and work near Kenya’s waters share their stories, testimonies, photographs and recordings here. Researchers, students, safety agencies, policymakers and the public can read, listen to, search and cite them, free of charge and without an account.')}</p>
      <ul>
        <li>{t('Community stories are shared by Contributors.')}</li>
        <li>{t('Testimonies are collected by the project team and published with the storyteller’s consent.')}</li>
        <li>{t('Historical records are newspaper articles, reports, photographs and official records, shown with their source.')}</li>
        <li>{t('Incident records bring together everything the archive holds about one event.')}</li>
      </ul>
      <h2>{t('The project')}</h2>
      <p>{t('The full name of the project is “Remembering the Waters: Co-creating Kenya’s Maritime and Inland-Water Safety Heritage Archive for Equity, Memory, and Future Transitions”. It works with coastal communities, Lake Victoria communities, survivors and families affected by past incidents, women in fishing communities, youth and informal transport workers, and with safety regulators, heritage institutions and universities.')}</p>
      <h2>{t('Acknowledgements')}</h2>
      <p>{t('The archive is run by the project team with the support of its funders and partner organisations, and it exists because of the people who have trusted it with their stories.')}</p>
      <h2>{t('Contact')}</h2>
      <p>{me ? <>{t('Message the admins from your')} <Link to="/inbox?new=admins">{t('INBOX')}</Link>.</> : <>{t('Sign in to message the admins, or use the')} <Link to="/about/feedback">{t('feedback form')}</Link>.</>} {t('To report copied or infringing content, use Report on the story, or the feedback form.')}</p>
      <h2>{t('Policies')}</h2>
      <p><Link to="/privacy">{t('Privacy policy')}</Link> · <Link to="/terms">{t('Terms of use')}</Link> · <Link to="/rules">{t('Rules and netiquette')}</Link></p>
    </article>
  );
}

function Resources() {
  const { t, i18n } = useTranslation();
  const { config } = useApp();
  const [f, setF] = useState({ type: '', audience: '', language: '', q: '' });
  const q = useQuery({ queryKey: ['resources', f], queryFn: () => get<any[]>('/resources', f) });
  return (
    <div>
      <h2>{t('Learning resources')}</h2>
      <p className="dim small">{t('Policy briefs, learning summaries, educational materials, the contributor handbook and online exhibitions.')}</p>
      <div className="grid2" style={{ marginBottom: '.7rem' }}>
        <label className="field"><span>{t('Type')}</span><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="">{t('All types')}</option>{Object.entries(config?.resourceTypes ?? {}).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select></label>
        <label className="field"><span>{t('For')}</span><select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option value="">{t('Everyone')}</option>{config?.audiences.map((a) => <option key={a} value={a}>{t(a)}</option>)}</select></label>
        <label className="field"><span>{t('Language')}</span><select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}><option value="">{t('All languages')}</option>{config?.languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</select></label>
        <label className="field"><span>{t('Search')}</span><input type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></label>
      </div>
      {q.isLoading ? <Skeleton lines={3} /> : q.error ? <Problem error={q.error} retry={() => q.refetch()} /> : q.data!.length === 0 ? <Empty icon="book" title={t('No resources match')} /> : (
        <ul className="list">{q.data!.map((r) => (
          <li key={r.id}><span className="kind">{t(r.typeLabel)}</span> <Link to={`/resources/${r.slug}`}><b>{r.title}</b></Link>
            <p className="small" style={{ margin: '.2rem 0' }}>{r.summary}</p><div className="meta">{[t(r.audience), fmtDate(r.publishedAt, i18n.language), r.hasFile && t('Download available')].filter(Boolean).join(' · ')}</div></li>
        ))}</ul>
      )}
    </div>
  );
}

function Resource({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation();
  const { toast } = useApp();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['resource', slug], queryFn: () => get(`/resources/${slug}`) });
  if (q.isLoading) return <Skeleton />;
  if (q.error) return <Problem error={q.error} retry={() => q.refetch()} />;
  const r = q.data;
  const copy = async (text: string, msg: string) => { try { await navigator.clipboard.writeText(text); toast(msg); } catch { toast(text, 'info'); } };
  return (
    <article className="prose">
      <p><button className="linkbtn" onClick={() => nav('/resources')}>← {t('All resources')}</button></p>
      <span className="kind">{t(r.typeLabel)}</span>
      <h2>{r.title}</h2>
      <p className="meta">{[t(r.audience), t('Published {date}', { date: fmtDate(r.publishedAt, i18n.language) })].join(' · ')}</p>
      {r.summary && <p><b>{r.summary}</b></p>}
      {r.body && <div style={{ whiteSpace: 'pre-wrap' }}>{r.body}</div>}
      {r.file && (r.file.kind === 'document' ? null : <MediaView m={r.file} active={false} paused />)}
      {r.exhibition && (
        <section><h3>{r.exhibition.title}</h3><p>{r.exhibition.description}</p>
          <ul className="list">{r.exhibition.items.map((it: any) => <li key={it.story.id}><Link to={`/stories/${it.story.code}`}><b>{it.story.title || it.story.code}</b></Link>{it.note && <p className="small" style={{ margin: 0 }}>{it.note}</p>}</li>)}</ul></section>
      )}
      <div className="row" style={{ margin: '1rem 0' }}>
        {r.hasFile && <button className="btn primary" onClick={async () => { try { const d = await post(`/resources/${r.id}/download`); window.location.assign(d.url); } catch (e: any) { toast(e.message, 'error'); } }}><Icon name="download" size={17} />{t('Download')}</button>}
        <button className="btn" onClick={() => (navigator.share ? void navigator.share({ title: r.title, url: r.permalink }).catch(() => undefined) : void copy(r.permalink, t('Link copied.')))}><Icon name="share" size={17} />{t('Share')}</button>
        <button className="btn" onClick={() => void copy(r.citation, t('Citation copied.'))}><Icon name="cite" size={17} />{t('Copy citation')}</button>
      </div>
      <p className="note small"><b>{t('Suggested citation')}:</b> {r.citation}</p>
    </article>
  );
}

function Privacy() {
  const { t } = useTranslation();
  const { config } = useApp();
  const S = ({ h, children }: { h: string; children: React.ReactNode }) => <section><h3>{h}</h3>{children}</section>;
  return (
    <article className="prose">
      <h2>{t('Privacy policy')}</h2>
      <p className="dim small">{t('This policy explains what personal data the archive collects, why, how it is protected and what your rights are. It follows Kenya’s Data Protection Act, 2019.')}</p>
      <S h={t('What we collect')}><ul>
        <li>{t('From Contributors: the name, email address and picture supplied by Google or Apple when you sign in; the username and picture you choose; your language and settings.')}</li>
        <li>{t('What you post: stories, files, comments, reactions, messages, reports and safety concerns.')}</li>
        <li>{t('From everyone: basic technical records (pages opened, device type, approximate region from the internet address) used to keep the service safe and to count visits. Visitors are counted without identifying them.')}</li>
        <li>{t('From admins: name, work email, phone number, staff number and, if given, an ID or passport number, which is stored encrypted.')}</li>
      </ul></S>
      <S h={t('Why we use it')}><p>{t('To run the archive, show your stories as you choose, keep the community safe through moderation, answer your questions, and report anonymous statistics about the archive. We do not sell personal data and we do not show advertising.')}</p></S>
      <S h={t('Automated review')}><p>{t('Every story and comment is checked by an AI system against the rules. A person on the admin team reviews anything it blocks, and you can ask why through “Ask Why”.')}</p></S>
      <S h={t('Who can see what')}><p>{t('Published stories are public. If you post anonymously, your name and picture are not shown, but the admins can still see who posted. Private messages are seen by the people in the conversation; reported messages can be seen by admins. Original files, consent forms and ID numbers are never public.')}</p></S>
      <S h={t('How it is protected')}><p>{t('Connections are encrypted. Files are stored encrypted, checked for viruses, and hidden location data is removed from photos. Admin accounts need a second sign-in step. Actions by admins are recorded in an audit log.')}</p></S>
      <S h={t('How long we keep it')}><p>{t('Your account and content stay until you delete them. A deleted story or account can be restored for 30 days and is then erased. Stories you posted “as told by” someone else, and testimonies given with consent, can be withdrawn at any time by asking the admins.')}</p></S>
      <S h={t('Your rights')}><p>{t('You can see, correct and download your data (My Profile › Download my data), delete your account (My Profile › Delete account), object to how your data is used, and complain to the Office of the Data Protection Commissioner.')}</p></S>
      <S h={t('Children')}><p>{t('You must be {n} or older to hold an account. Stories about anyone under 18 need the agreement of a parent or guardian, and children are not identified without it.', { n: config?.minAge ?? 18 })}</p></S>
      <S h={t('Cookies and storage on your device')}><p>{t('The website uses one sign-in cookie, needed to keep you signed in, and stores your language, theme, drafts and offline copies of pages on your device. It uses no advertising or tracking cookies.')}</p></S>
      <S h={t('Contact')}><p>{t('Questions about your data go to the admins through INBOX or the feedback form.')} <Link to="/about/feedback">{t('Feedback form')}</Link></p></S>
    </article>
  );
}
function Terms() {
  const { t } = useTranslation();
  const S = ({ h, children }: { h: string; children: React.ReactNode }) => <section><h3>{h}</h3>{children}</section>;
  return (
    <article className="prose">
      <h2>{t('Terms of use')}</h2>
      <S h={t('Using the archive')}><p>{t('Anyone may read, listen to, search and cite the archive free of charge. To post, react, comment, message, follow or report you need an account, which you create by signing in with Google or Apple.')}</p></S>
      <S h={t('Your content')}><p>{t('You keep the rights to what you post. By posting you allow the archive to store, display, translate, transcribe and preserve it, and to make it available to the public under the usage rights you choose for each story. Post only what you own or have permission to share.')}</p></S>
      <S h={t('Other people’s stories')}><p>{t('If you share a story told to you by someone else, you confirm that they agreed. Either of you can ask for it to be withdrawn.')}</p></S>
      <S h={t('Rules')}><p>{t('You agree to follow the Rules and netiquette. Content that breaks them may be blocked or removed, and accounts may be warned, suspended or deleted. You can always ask why.')} <Link to="/rules">{t('Rules and netiquette')}</Link></p></S>
      <S h={t('Using what you find here')}><p>{t('Each story shows its usage rights. Respect them, and cite the archive when you use a story (every story has a “Cite” option). Downloads are offered only where the Contributor allows them.')}</p></S>
      <S h={t('Copyright and takedown')}><p>{t('If you believe something here copies your work or was posted without permission, use Report on the story or the feedback form, and say what it is and where the original is. The admins will review it and remove it if the report is right.')}</p></S>
      <S h={t('Safety information')}><p>{t('Stories describe personal experiences and are not official safety advice. The archive is not an emergency service: in an emergency, call the emergency numbers shown on the safety concern form.')}</p></S>
      <S h={t('Changes')}><p>{t('If these terms change in an important way, we will tell you in Announcements before the change takes effect.')}</p></S>
    </article>
  );
}
