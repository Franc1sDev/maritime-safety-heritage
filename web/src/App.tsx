import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { get, post } from './lib/api';
import { useApp, useSaveSettings } from './lib/app';
import { onQueue, queued } from './lib/offline';
import { Icon } from './components/Icon';
import { Dialog, Spinner, Toasts } from './components/ui';
import { Guide } from './components/Guide';
import { ProviderButtons } from './pages/Auth';
import StoriesPage from './pages/Stories';

const Profile = lazy(() => import('./pages/Profile'));
const About = lazy(() => import('./pages/About'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Announcements = lazy(() => import('./pages/Announcements'));
const Auth = lazy(() => import('./pages/Auth'));
const Detail = lazy(() => import('./pages/Detail'));
const Admin = lazy(() => import('./pages/Admin'));
const Responsibilities = lazy(() => import('./pages/Responsibilities'));
const Super = lazy(() => import('./pages/Super'));

interface Notice { id: string; kind: string; title: string; body: string; link: string; priority: boolean; readAt: string | null; doneAt: string | null; createdAt: string }

/** Which page is open beside the STORIES page, from the address. */
function usePanel() {
  const { pathname } = useLocation();
  const is = (p: string) => !!matchPath({ path: p, end: false }, pathname);
  if (pathname === '/' || is('/stories')) return null;
  if (is('/profile')) return 'profile';
  if (is('/about') || is('/resources') || is('/privacy') || is('/terms') || is('/rules') || is('/safety')) return 'about';
  if (is('/inbox')) return 'inbox';
  if (is('/announcements')) return 'announcements';
  if (is('/responsibilities')) return 'responsibilities';
  if (is('/sign-in') || is('/setup') || is('/admin/sign-in') || is('/admin/register') || is('/admin/reset-password') || is('/account')) return 'auth';
  if (is('/admin')) return 'admin';
  if (is('/super')) return 'super';
  if (is('/reports')) return 'reports';
  if (is('/incidents') || is('/collections') || is('/contributors')) return 'detail';
  return 'missing';
}

export default function App() {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const { me, ready, counts, online, config, reducedMotion } = app;
  const nav = useNavigate();
  const loc = useLocation();
  const panel = usePanel();
  const save = useSaveSettings();
  const [wide, setWide] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const [update, setUpdate] = useState<null | (() => void)>(null);
  const [floating, setFloating] = useState(false);
  const isAdmin = me?.role === 'admin', isSuper = me?.role === 'super_admin';
  // Admins keep the controls panel beside the stories; it does not blur them.
  const adminHome = isAdmin && panel === null;
  // A finished PDF report opens in the analytics area of whoever asked for it.
  const shown = adminHome ? 'admin' : panel === 'reports' ? (isSuper ? 'super' : 'admin') : panel;
  const blurred = panel !== null;

  useEffect(() => { const load = () => void queued().then((q) => setWaiting(q.length)); load(); return onQueue(load); }, []);
  useEffect(() => { const f = (e: Event) => setUpdate(() => (e as CustomEvent).detail); window.addEventListener('app-update', f); return () => window.removeEventListener('app-update', f); }, []);
  // A new account finishes its profile before anything else.
  useEffect(() => { if (me && !me.profileComplete && me.role === 'contributor' && !loc.pathname.startsWith('/setup') && !['/privacy', '/terms', '/rules'].includes(loc.pathname)) nav('/setup', { replace: true }); }, [me, loc.pathname, nav]);
  useEffect(() => { if (panel !== 'admin' && panel !== 'super') setWide(false); }, [panel]);
  useEffect(() => { document.title = `${panel ? `${t({ reports: 'Reports', profile: 'My Profile', about: 'About & Resources', inbox: 'Inbox', announcements: 'Announcements', responsibilities: 'My Responsibilities', auth: 'Sign in', admin: 'Administrative controls', super: 'Super Admin', detail: 'Archive', missing: 'Page not found' }[panel])} · ` : ''}Remembering the Waters`; }, [panel, t, i18n.language]);

  // Priority notifications: floating in the centre at sign-in, then pinned at the top until acted on.
  const notices = useQuery({ queryKey: ['notifications'], queryFn: () => get<{ items: Notice[] }>('/me/notifications'), enabled: !!me });
  const priority = useMemo(() => (notices.data?.items ?? []).filter((n) => n.priority && !n.doneAt), [notices.data]);
  // Shown once per sign-in (not again on every page load in the same browser session).
  useEffect(() => { if (me?.id) { let seen = false; try { seen = sessionStorage.getItem('floated') === me.id; } catch { /* private mode */ } setFloating(!seen); } }, [me?.id]);
  useEffect(() => { if (me?.id && !floating) { try { sessionStorage.setItem('floated', me.id); } catch { /* private mode */ } } }, [floating, me?.id]);
  const showFloat = floating && priority.length > 0 && me?.profileComplete !== false;
  const openNotice = (n: Notice) => { setFloating(false); void post(`/me/notifications/${n.id}/read`).catch(() => undefined); nav(n.link.replace(/^https?:\/\/[^/]+/, '') || '/'); };

  const round = (to: string, key: string, icon: string, label: string, count = 0, centre = false, on = key === 'stories' ? !blurred : shown === key && blurred) => (
    <Link key={key} to={to} className={`round ${centre ? 'centre' : ''} ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined} aria-label={count ? `${label}: ${count}` : label}>
      <Icon name={icon} /><span>{label}</span>{count > 0 && <span className="count" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
  const stories = round('/', 'stories', 'stories', t('STORIES'), 0, true);
  const icons = !me
    ? [round('/about', 'about', 'about', t('ABOUT & RESOURCES')), stories, round('/sign-in', 'auth', 'signin', t('SIGN IN'))]
    : isSuper
      ? [round('/profile', 'profile', 'profile', t('MY PROFILE')), round('/super/analytics', 'super', 'chart', t('LIVE ANALYTICS'), 0, false, loc.pathname.startsWith('/super/analytics') || loc.pathname === '/super'), stories, round('/super/reports', 'super-r', 'document', t('REPORTS'), 0, false, loc.pathname.startsWith('/super/reports')), round('/super/admins', 'super-a', 'shield', t('MANAGE ADMINS'), counts.priority, false, /^\/super\/(admins|approvals|audit|system)/.test(loc.pathname))]
      : [round('/profile', 'profile', 'profile', t('MY PROFILE')), round('/about', 'about', 'about', t('ABOUT & RESOURCES')), stories, round('/inbox', 'inbox', 'inbox', t('INBOX'), counts.inbox), round('/announcements', 'announcements', 'megaphone', t('ANNOUNCEMENTS').replace('ANNOUNCEMENTS', 'ANNOUNCE\u00adMENTS'), counts.announcements),
        ...(isAdmin ? [round('/responsibilities', 'responsibilities', 'tasks', t('MY RESPONSIBILITIES').replace('RESPONSIBILITIES', 'RESPONSI\u00adBILITIES'), counts.priority)] : [])];

  const body = () => {
    switch (shown) {
      case 'profile': return <Profile />;
      case 'about': return <About />;
      case 'inbox': return <Inbox />;
      case 'announcements': return <Announcements />;
      case 'auth': return <Auth />;
      case 'detail': return <Detail />;
      case 'responsibilities': return <Responsibilities />;
      case 'admin': return <Admin wide={wide} setWide={setWide} />;
      case 'super': return <Super wide={wide} setWide={setWide} />;
      default: return <div className="empty"><Icon name="search" /><p><b>{t('We could not find that page.')}</b></p><Link className="btn primary" to="/">{t('Back to the stories')}</Link></div>;
    }
  };

  return (
    <>
      <a className="skip" href="#main">{t('Skip to the stories')}</a>
      <header className="top">
        <Link to="/" className="brand" aria-label={t('Remembering the Waters, home')}>REMEMBERING THE WATERS<small>{t('Kenya’s maritime and inland-water safety heritage')}</small></Link>
        <nav className={`icons ${reducedMotion || blurred ? 'still' : ''}`} aria-label={t('Main')}>{icons}</nav>
        <div className="top-end">
          {!showFloat && priority.slice(0, 2).map((n) => <button key={n.id} className="pinned" onClick={() => openNotice(n)} title={n.body}><Icon name="bell" size={15} />{n.title}</button>)}
          {!showFloat && priority.length > 2 && <Link className="pinned" to={isAdmin ? '/responsibilities' : '/profile/notifications'}>+{priority.length - 2}</Link>}
          <label className="sr" htmlFor="lang">{t('Language')}</label>
          <select id="lang" className="lang" value={i18n.language} onChange={(e) => void save({ language: e.target.value }, true)}>
            {(config?.languages ?? [{ code: 'en', name: 'English', launch: true }]).filter((l) => l.launch).map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </div>
      </header>
      {!online && <div className="banner off" role="status">{t('You are offline. Some features are unavailable.')}{waiting > 0 && ` ${t('{n} waiting to send', { n: waiting })}`}</div>}
      {online && waiting > 0 && <div className="banner on" role="status">{t('Sending what was waiting…')}</div>}
      {update && <div className="banner on" role="status">{t('A new version is ready.')} <button className="linkbtn" onClick={update}>{t('Update now')}</button></div>}

      <div className={`stage ${shown ? 'split' : ''} ${wide && shown ? 'wide' : ''}`}>
        <div id="main" className={`stories-wrap ${blurred ? 'blurred' : ''}`} data-hint={t('Select here to go back to the stories')} onClick={blurred ? () => nav('/') : undefined}
          role={blurred ? 'button' : undefined} tabIndex={blurred ? 0 : undefined} aria-label={blurred ? t('Back to the stories') : undefined} onKeyDown={blurred ? (e) => { if (e.key === 'Enter' || e.key === ' ') nav('/'); } : undefined}>
          {ready ? <StoriesPage paused={blurred || showFloat} /> : <div style={{ padding: '2rem' }}><Spinner label={t('Loading…')} /></div>}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {shown && (
            <motion.section key={shown} className="panel" aria-label={t('Open page')} initial={reducedMotion ? false : { opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={reducedMotion ? undefined : { opacity: 0, x: 28 }} transition={{ duration: 0.22 }}>
              <Suspense fallback={<Spinner label={t('Loading…')} />}>{ready ? body() : <Spinner label={t('Loading…')} />}</Suspense>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <footer className="foot">
        <p><label>{t('Language')}: <select className="lang" value={i18n.language} onChange={(e) => void save({ language: e.target.value }, true)}>{(config?.languages ?? [{ code: 'en', name: 'English', launch: true }]).filter((l) => l.launch).map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</select></label></p>
        <p>{t('Remembering the Waters is run by the project team with the support of its partner organisations.')} <Link to="/about">{t('About and acknowledgements')}</Link> · <Link to="/privacy">{t('Privacy policy')}</Link> · <Link to="/terms">{t('Terms of use')}</Link> · <Link to="/rules">{t('Rules')}</Link></p>
        <p className="small">© {new Date().getFullYear()} Remembering the Waters{config?.emergencyNumbers?.length ? ` · ${t('In an emergency on the water call {numbers}', { numbers: config.emergencyNumbers.join(' / ') })}` : ''}</p>
      </footer>

      <Guide ready={ready && !shown && !showFloat} />
      {showFloat && (
        <div className="floaters" onClick={() => setFloating(false)} role="dialog" aria-modal="true" aria-label={t('Needs your action')}>
          <div onClick={(e) => e.stopPropagation()}>
            {priority.slice(0, 4).map((n, i) => (
              <motion.button key={n.id} className="floater" onClick={() => openNotice(n)} autoFocus={i === 0} initial={reducedMotion ? false : { opacity: 0, y: 30, scale: 0.94 }} animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: [0, -5, 0], scale: 1 }} transition={reducedMotion ? { duration: 0 } : { delay: i * 0.08, y: { repeat: Infinity, duration: 3, ease: 'easeInOut' } }}>
                <b>{n.title}</b><br /><span className="small">{n.body}</span>
              </motion.button>
            ))}
            <p className="small" style={{ color: '#fff', textAlign: 'center' }}>{t('Select one to open it, or anywhere else to keep it at the top.')}</p>
          </div>
        </div>
      )}
      {app.prompt && (
        <Dialog title={t('Sign in to continue')} onClose={app.closePrompt}>
          <p>{t('You need an account to post, react, comment, message, add favorites, follow or report. Reading the archive is always free.')}</p>
          <ProviderButtons onDone={app.closePrompt} />
          <div className="actions"><button className="btn quiet" onClick={app.closePrompt}>{t('Not now')}</button></div>
        </Dialog>
      )}
      <Toasts />
    </>
  );
}
