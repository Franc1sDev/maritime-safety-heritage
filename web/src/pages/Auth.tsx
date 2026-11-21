import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, get, post } from '../lib/api';
import { Me, useApp, useSaveSettings } from '../lib/app';
import { uploadFile } from '../lib/upload';
import { Icon, Logo } from '../components/Icon';
import { Avatar, fmtDate } from '../components/ui';
import { AskWhy } from './Share';

interface Providers { google: { clientId: string } | null; apple: { clientId: string; redirectUri: string } | null; demo: boolean; minAge: number; avatars: string[] }
const loadScript = (src: string) => new Promise<void>((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error('script')); document.head.appendChild(s); });
type Held = null | { kind: 'suspended'; message: string; reason: string; until: string | null; token: string } | { kind: 'deleted'; message: string; token: string };

/** "Continue with Google" and "Continue with Apple": the only ways a Contributor signs in. */
export function ProviderButtons({ onDone }: { onDone?: () => void }) {
  const { t, i18n } = useTranslation();
  const { signedIn, toast } = useApp();
  const nav = useNavigate();
  const p = useQuery({ queryKey: ['providers'], queryFn: () => get<Providers>('/auth/providers'), staleTime: 600_000 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [held, setHeld] = useState<Held>(null);
  const [why, setWhy] = useState(false);
  const [demoName, setDemoName] = useState('');
  const gbtn = useRef<HTMLDivElement>(null);

  const finish = (s: { accessToken: string; user: Me; created?: boolean; message?: string }) => {
    signedIn(s); onDone?.();
    if (!s.user.profileComplete) nav('/setup'); else { toast(s.message ?? t('Welcome back, {name}.', { name: s.user.name })); if (['/sign-in', '/account'].includes(window.location.pathname)) nav('/'); }
  };
  const failed = (e: any) => {
    if (e.code === 'account_suspended') setHeld({ kind: 'suspended', message: e.message, reason: e.details?.reason ?? '', until: e.details?.until ?? null, token: e.details?.askWhyToken });
    else if (e.code === 'account_deleted_restore') setHeld({ kind: 'deleted', message: e.message, token: e.details?.restoreToken });
    else setError(e.message || t('Sign-in did not complete. Please try again.'));
  };
  const send = async (provider: 'google' | 'apple', idToken: string, name?: string) => { setBusy(provider); setError(''); try { finish(await post(`/auth/oauth/${provider}`, { idToken, name })); } catch (e) { failed(e); } finally { setBusy(''); } };

  // Google renders its own button; it returns an ID token that the server verifies.
  useEffect(() => {
    const g = p.data?.google;
    if (!g || !gbtn.current) return;
    let dead = false;
    void loadScript('https://accounts.google.com/gsi/client').then(() => {
      if (dead || !gbtn.current) return;
      const id = (window as any).google.accounts.id;
      id.initialize({ client_id: g.clientId, callback: (r: { credential?: string }) => (r.credential ? void send('google', r.credential) : setError(t('Sign-in was cancelled. Please try again.'))), ux_mode: 'popup', use_fedcm_for_prompt: true });
      id.renderButton(gbtn.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: Math.min(360, gbtn.current.clientWidth || 320), locale: i18n.language === 'luo' ? 'en' : i18n.language });
    }).catch(() => setError(t('We could not reach Google. Check your connection and try again.')));
    return () => { dead = true; };
  }, [p.data?.google?.clientId, i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps

  async function apple() {
    const a = p.data?.apple;
    if (!a) return;
    setBusy('apple'); setError('');
    try {
      await loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js');
      const A = (window as any).AppleID.auth;
      A.init({ clientId: a.clientId, scope: 'name email', redirectURI: `${window.location.origin}/sign-in`, usePopup: true });
      const r = await A.signIn();
      const n = r.user?.name ? [r.user.name.firstName, r.user.name.lastName].filter(Boolean).join(' ') : undefined;
      await send('apple', r.authorization.id_token, n);
    } catch (e: any) { if (e?.error !== 'popup_closed_by_user') setError(t('Sign-in was cancelled or failed. Please try again.')); } finally { setBusy(''); }
  }

  if (held?.kind === 'suspended') return (
    <div className="note warn" role="alert">
      <p><b>{held.message}</b></p>
      {held.until && <p>{t('Until')}: {fmtDate(held.until, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
      {held.reason && <p>{t('Reason')}: {held.reason}</p>}
      <div className="row"><button className="btn" onClick={() => setWhy(true)}>{t('Ask Why')}</button><button className="btn quiet" onClick={() => setHeld(null)}>{t('Back')}</button></div>
      {why && <AskWhy suspendedToken={held.token} onClose={() => setWhy(false)} />}
    </div>
  );
  if (held?.kind === 'deleted') return (
    <div className="note warn" role="alert">
      <p><b>{held.message}</b></p>
      <div className="row"><button className="btn primary" onClick={async () => { try { finish(await post('/auth/restore', { token: held.token })); } catch (e: any) { setError(e.message); setHeld(null); } }}>{t('Restore my account')}</button><button className="btn quiet" onClick={() => setHeld(null)}>{t('Not now')}</button></div>
    </div>
  );
  return (
    <div>
      {p.isLoading && <p className="dim"><span className="spinner" /></p>}
      {p.data?.google && <div ref={gbtn} style={{ minHeight: 44, marginBottom: '.7rem', display: 'flex', justifyContent: 'center' }} aria-label={t('Continue with Google')} />}
      {p.data?.apple && <button className="provider apple" disabled={!!busy} onClick={apple}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.300 1.900-3.400 2-3.500-1.100-1.600-2.800-1.800-3.400-1.800-1.400-.1-2.800.9-3.500.9s-1.800-.8-3-.8c-1.500 0-3 .9-3.800 2.300-1.600 2.800-.4 7 1.200 9.300.8 1.100 1.700 2.400 2.900 2.300 1.200 0 1.600-.7 3-.7s1.800.7 3 .7 2-1.100 2.800-2.300c.9-1.300 1.200-2.500 1.300-2.600-.1 0-2.500-1-2.500-3.800zM14.200 5.800c.6-.8 1-1.800.9-2.800-.9 0-2 .6-2.600 1.400-.6.700-1.100 1.700-.9 2.700 1 .1 2-.5 2.600-1.300z" /></svg>{busy === 'apple' ? <span className="spinner" /> : t('Continue with Apple')}</button>}
      {p.data && !p.data.google && !p.data.apple && !p.data.demo && <p className="note warn">{t('Sign-in is not set up on this server yet.')}</p>}
      {p.data?.demo && (
        <form className="note" onSubmit={async (e) => { e.preventDefault(); setBusy('demo'); setError(''); try { finish(await post('/auth/demo', { name: demoName.trim() || 'Demo Contributor' })); } catch (er) { failed(er); } finally { setBusy(''); } }}>
          <p className="small" style={{ marginTop: 0 }}><b>{t('Test sign-in')}</b> · {t('This server is in test mode. Google and Apple sign-in appear here once their keys are added.')}</p>
          <div className="row"><input className="grow" type="text" value={demoName} onChange={(e) => setDemoName(e.target.value)} placeholder={t('Any name, for example Amina')} aria-label={t('Name for the test account')} maxLength={40} /><button className="btn primary" disabled={!!busy}>{busy === 'demo' ? <span className="spinner" /> : t('Continue')}</button></div>
        </form>
      )}
      {error && <p className="error-text" role="alert">{error}</p>}
    </div>
  );
}

export default function Auth() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/setup')) return <ProfileSetup />;
  if (pathname.startsWith('/admin/sign-in')) return <AdminSignIn />;
  if (pathname.startsWith('/admin/register')) return <AdminRegister />;
  if (pathname.startsWith('/admin/reset-password')) return <AdminReset />;
  return <SignIn />;
}

function SignIn() {
  const { t } = useTranslation();
  const { me } = useApp();
  const nav = useNavigate();
  useEffect(() => { if (me?.profileComplete) nav('/', { replace: true }); }, [me, nav]);
  return (
    <div className="auth">
      <div style={{ textAlign: 'center' }}><Logo size={64} /><h1>{t('Sign in')}</h1><p className="dim">{t('Share your story, react, comment and follow. Reading the archive never needs an account.')}</p></div>
      <ProviderButtons />
      <p className="small dim">{t('By continuing you agree to the')} <Link to="/terms">{t('Terms of use')}</Link>, {t('the')} <Link to="/privacy">{t('Privacy policy')}</Link> {t('and the')} <Link to="/rules">{t('Rules')}</Link>.</p>
      <hr />
      <p className="small">{t('Project team')}: <Link to="/admin/sign-in">{t('Admin sign-in')}</Link> · <Link to="/admin/register">{t('Admin registration')}</Link></p>
    </div>
  );
}

/** First sign-in: username and picture (or the Google/Apple name and photo), language, theme, and acceptance of the rules. */
export function ProfileSetup({ editing, onDone }: { editing?: boolean; onDone?: () => void }) {
  const { t, i18n } = useTranslation();
  const { me, setMe, config, toast, signOut } = useApp();
  const nav = useNavigate();
  const [useProvider, setUseProvider] = useState(me?.useProviderIdentity ?? false);
  const [username, setUsername] = useState(me?.username ?? '');
  const [avatar, setAvatar] = useState(me?.avatar?.startsWith('avatar:') ? me.avatar.slice(7) : 'wave');
  const [photo, setPhoto] = useState<{ id: string; url: string } | null>(null);
  const [language, setLanguage] = useState(me?.language ?? i18n.language);
  const [theme, setTheme] = useState(me?.theme ?? 'auto');
  const [terms, setTerms] = useState(false); const [age, setAge] = useState(false);
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const save = useSaveSettings();
  useEffect(() => { if (!me) nav('/sign-in', { replace: true }); }, [me, nav]);
  // Availability is checked as the username is typed.
  useEffect(() => {
    if (useProvider || !username.trim()) return setState(null);
    if (username === me?.username) return setState({ ok: true, message: '' });
    let live = true;
    const h = setTimeout(() => void get('/auth/username-available', { username: username.trim() }).then((r) => live && setState({ ok: r.available, message: r.message })).catch(() => undefined), 250);
    return () => { live = false; clearTimeout(h); };
  }, [username, useProvider, me?.username]);
  if (!me) return null;
  const ready = (useProvider || (state?.ok && username.trim().length >= 3)) && (editing || (terms && age));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await post('/auth/profile', { useProviderIdentity: useProvider, username: useProvider ? undefined : username.trim(), avatar: useProvider || photo ? undefined : avatar, photoMediaId: !useProvider && photo ? photo.id : undefined, language, theme, acceptTerms: editing ? undefined : terms, ageConfirmed: editing ? undefined : age });
      setMe(r.user); toast(r.message);
      if (onDone) onDone(); else nav('/');
    } catch (er: any) { setError(er.message); } finally { setBusy(false); }
  }
  return (
    <form className={editing ? '' : 'auth'} onSubmit={submit}>
      {!editing && <><h1>{t('Set up your profile')}</h1><p className="dim">{t('Choose how you appear on your stories and comments.')}</p></>}
      <fieldset style={{ border: 0, padding: 0, margin: '0 0 .6rem' }}>
        <legend className="label">{t('Name and picture')}</legend>
        <label className="check"><input type="radio" name="idn" checked={!useProvider} onChange={() => setUseProvider(false)} /><span>{t('Create a username and choose a picture')}</span></label>
        <label className="check"><input type="radio" name="idn" checked={useProvider} onChange={() => setUseProvider(true)} /><span>{t('Keep my {provider} name and photo', { provider: me.provider === 'apple' ? 'Apple' : 'Google' })}{me.providerName ? ` (${me.providerName})` : ''}</span></label>
      </fieldset>
      {!useProvider && (
        <>
          <label className="field"><span>{t('Username')}</span><input type="text" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, '_'))} maxLength={30} autoComplete="off" aria-describedby="uname-state" required />
            <span id="uname-state" role="status" className={state ? (state.ok ? 'ok-text' : 'error-text') : 'hint'} style={{ textAlign: 'start' }}>{state ? (state.ok ? (state.message ? `✓ ${state.message}` : '') : state.message) : t('3 to 30 letters, numbers or underscores')}</span></label>
          <span className="label">{t('Picture')}</span>
          <div className="avatar-pick" role="group" aria-label={t('Choose an avatar')}>
            {(config?.avatars ?? ['wave']).map((a) => <button type="button" key={a} aria-pressed={!photo && avatar === a} aria-label={a} onClick={() => { setAvatar(a); setPhoto(null); }}><Icon name={a} size={26} /></button>)}
          </div>
          <p className="small"><label className="linkbtn" style={{ cursor: 'pointer' }}><Icon name="upload" size={14} /> {t('Or use a photo of your face')}<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const m = await uploadFile(file, 'avatar', () => undefined).promise; setPhoto({ id: m.id, url: URL.createObjectURL(file) }); } catch (er: any) { setError(er.message); } }} /></label>
            {photo && <> <img src={photo.url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', verticalAlign: 'middle' }} /> <button type="button" className="linkbtn" onClick={() => setPhoto(null)}>{t('Remove')}</button></>}</p>
        </>
      )}
      {useProvider && <p className="row"><Avatar person={{ avatar: me.providerPicture || 'avatar:wave', name: me.providerName }} /> <b>{me.providerName}</b></p>}
      <div className="grid2">
        <label className="field"><span>{t('Language')}</span><select value={language} onChange={(e) => { setLanguage(e.target.value); if (!editing) void save({ language: e.target.value }, true); }}>{config?.languages.filter((l) => l.launch).map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</select></label>
        <label className="field"><span>{t('Theme')}</span><select value={theme} onChange={(e) => setTheme(e.target.value as Me['theme'])}><option value="auto">{t('Auto (follow my device)')}</option><option value="light">{t('Light')}</option><option value="dark">{t('Dark')}</option></select></label>
      </div>
      {!editing && (
        <>
          <label className="check"><input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} /><span>{t('I am {n} or older.', { n: config?.minAge ?? 18 })}</span></label>
          <label className="check"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /><span>{t('I accept the')} <Link to="/rules" target="_blank">{t('Rules')}</Link>, {t('the')} <Link to="/privacy" target="_blank">{t('Privacy policy')}</Link> {t('and the')} <Link to="/terms" target="_blank">{t('Terms of use')}</Link>.</span></label>
        </>
      )}
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="actions">
        {!editing && <button type="button" className="btn quiet" onClick={() => void signOut().then(() => nav('/'))}>{t('Sign out')}</button>}
        {editing && <button type="button" className="btn quiet" onClick={onDone}>{t('Cancel')}</button>}
        <button className="btn primary" disabled={!ready || busy}>{busy ? <span className="spinner" /> : editing ? t('Save') : t('Open the archive')}</button>
      </div>
    </form>
  );
}

function AdminSignIn() {
  const { t } = useTranslation();
  const { signedIn, toast } = useApp();
  const nav = useNavigate();
  const [step, setStep] = useState<'password' | 'code' | 'forgot'>('password');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [code, setCode] = useState('');
  const [mfa, setMfa] = useState<{ mfaToken: string; methods: string[]; emailHint: string } | null>(null);
  const [channel, setChannel] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [info, setInfo] = useState('');
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } };
  const sendCode = (ch: 'email' | 'sms', token = mfa!.mfaToken) => run(async () => { await post('/auth/admin/mfa/send', { mfaToken: token, channel: ch }); setChannel(ch); setInfo(ch === 'email' ? t('We sent a code to your email.') : t('We sent a code to your phone.')); });
  return (
    <div className="auth">
      <h1>{t('Admin sign-in')}</h1>
      {step === 'password' && (
        <form onSubmit={(e) => { e.preventDefault(); void run(async () => { const r = await post('/auth/admin/login', { email: email.trim(), password }); setMfa(r); setStep('code'); if (r.methods.includes('authenticator')) setChannel('authenticator'); else { setChannel('email'); await post('/auth/admin/mfa/send', { mfaToken: r.mfaToken, channel: 'email' }); setInfo(t('We sent a code to your email.')); } }); }}>
          <label className="field"><span>{t('Work email')}</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
          <label className="field"><span>{t('Password')}</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
          {error && <p className="error-text" role="alert">{error}</p>}
          <div className="actions"><button type="button" className="linkbtn" onClick={() => { setStep('forgot'); setError(''); }}>{t('Forgot password?')}</button><button className="btn primary" disabled={busy}>{busy ? <span className="spinner" /> : t('Continue')}</button></div>
        </form>
      )}
      {step === 'code' && mfa && (
        <form onSubmit={(e) => { e.preventDefault(); void run(async () => { const s = await post('/auth/admin/mfa/verify', { mfaToken: mfa.mfaToken, code: code.trim() }); signedIn(s); toast(t('Welcome back, {name}.', { name: s.user.name })); nav(s.user.role === 'super_admin' ? '/super/analytics' : '/'); }); }}>
          <p>{channel === 'authenticator' ? t('Enter the 6-digit code from your authenticator app.') : info || t('Enter the 6-digit code we sent you.')} {channel === 'email' && <span className="dim">({mfa.emailHint})</span>}</p>
          <label className="field"><span>{t('Sign-in code')}</span><input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required autoFocus /></label>
          {error && <p className="error-text" role="alert">{error}</p>}
          <p className="small">
            {mfa.methods.includes('authenticator') && channel !== 'authenticator' && <button type="button" className="linkbtn" onClick={() => setChannel('authenticator')}>{t('Use my authenticator app')} </button>}
            <button type="button" className="linkbtn" onClick={() => void sendCode('email')}>{channel === 'email' ? t('Send the email again') : t('Email me a code instead')}</button>
            {mfa.methods.includes('sms') && <> · <button type="button" className="linkbtn" onClick={() => void sendCode('sms')}>{t('Text me a code')}</button></>}
          </p>
          <div className="actions"><button type="button" className="btn quiet" onClick={() => { setStep('password'); setCode(''); }}>{t('Back')}</button><button className="btn primary" disabled={busy || code.length !== 6}>{busy ? <span className="spinner" /> : t('Sign in')}</button></div>
        </form>
      )}
      {step === 'forgot' && (
        <form onSubmit={(e) => { e.preventDefault(); void run(async () => { const r = await post('/auth/admin/forgot-password', { email: email.trim() }); setInfo(r.message ?? t('If that email belongs to an admin, a link to choose a new password is on its way.')); }); }}>
          <label className="field"><span>{t('Work email')}</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          {info && <p className="note good" role="status">{info}</p>}
          {error && <p className="error-text" role="alert">{error}</p>}
          <div className="actions"><button type="button" className="btn quiet" onClick={() => { setStep('password'); setInfo(''); }}>{t('Back')}</button><button className="btn primary" disabled={busy}>{t('Send the link')}</button></div>
        </form>
      )}
      <hr /><p className="small"><Link to="/admin/register">{t('Admin registration')}</Link> · <Link to="/sign-in">{t('Contributor sign-in')}</Link></p>
    </div>
  );
}

function AdminRegister() {
  const { t } = useTranslation();
  const [sp] = useSearchParams();
  const invite = sp.get('invite') ?? '';
  const [f, setF] = useState({ fullName: '', email: sp.get('email') ?? '', phone: '', staffNumber: '', idNumber: '', password: '', again: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [done, setDone] = useState('');
  const fld = (k: keyof typeof f, label: string, type = 'text', extra: Record<string, any> = {}) => <label className="field"><span>{label}</span><input type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} /></label>;
  if (done) return <div className="auth"><div className="note good" role="status"><h2>{t('Registration received')}</h2><p>{done}</p></div><p><Link className="btn primary" to="/admin/sign-in">{t('Admin sign-in')}</Link></p></div>;
  return (
    <form className="auth" onSubmit={async (e) => {
      e.preventDefault(); if (f.password !== f.again) return setError(t('The two passwords do not match.'));
      setBusy(true); setError('');
      try { const r = await post('/auth/admin/register', { fullName: f.fullName.trim(), email: f.email.trim(), phone: f.phone.trim(), staffNumber: f.staffNumber.trim(), idNumber: f.idNumber.trim() || undefined, password: f.password, inviteToken: invite || undefined }); setDone(r.message); } catch (er: any) { setError(er.details?.length ? `${er.message} ${[].concat(er.details).join(' ')}` : er.message); } finally { setBusy(false); }
    }}>
      <h1>{t('Admin registration')}</h1>
      <p className="dim">{invite ? t('You were invited to join the admin team. Complete your details below.') : t('For members of the project team. A Super Admin approves each registration before the account can be used.')}</p>
      {fld('fullName', t('Full name'), 'text', { required: true, autoComplete: 'name' })}
      {fld('email', t('Work email'), 'email', { required: true, autoComplete: 'email', readOnly: !!invite && !!sp.get('email') })}
      {fld('phone', t('Phone number'), 'tel', { required: true, placeholder: '+254 7xx xxx xxx', autoComplete: 'tel' })}
      {fld('staffNumber', t('Staff number'), 'text', { required: true })}
      {fld('idNumber', t('ID or passport number (kept encrypted)'))}
      {fld('password', t('Password'), 'password', { required: true, autoComplete: 'new-password', minLength: 8 })}
      <p className="hint" style={{ textAlign: 'start' }}>{t('Use 8 to 128 characters, with at least one letter and one number.')}</p>
      {fld('again', t('Password again'), 'password', { required: true, autoComplete: 'new-password' })}
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="actions"><Link className="btn quiet" to="/admin/sign-in">{t('I already have an account')}</Link><button className="btn primary" disabled={busy}>{busy ? <span className="spinner" /> : t('Register')}</button></div>
    </form>
  );
}

function AdminReset() {
  const { t } = useTranslation();
  const [sp] = useSearchParams();
  const [password, setPassword] = useState(''); const [again, setAgain] = useState(''); const [error, setError] = useState(''); const [done, setDone] = useState('');
  if (done) return <div className="auth"><p className="note good" role="status">{done}</p><Link className="btn primary" to="/admin/sign-in">{t('Admin sign-in')}</Link></div>;
  return (
    <form className="auth" onSubmit={async (e) => { e.preventDefault(); if (password !== again) return setError(t('The two passwords do not match.')); try { const r = await api('/auth/admin/reset-password', { body: { token: sp.get('token') ?? '', password } }); setDone(r.message ?? t('Password changed.')); } catch (er: any) { setError(er.message); } }}>
      <h1>{t('Choose a new password')}</h1>
      <label className="field"><span>{t('New password')}</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required /></label>
      <label className="field"><span>{t('New password again')}</span><input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required /></label>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="actions"><button className="btn primary">{t('Save')}</button></div>
    </form>
  );
}
