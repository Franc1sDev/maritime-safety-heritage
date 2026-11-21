/**
 * End-to-end tests: a throwaway PostgreSQL server, the real migrations and seed, real HTTP requests and a real WebSocket.
 * Run with `npm test`.
 */
import { INestApplication } from '@nestjs/common';
import { createSign, generateKeyPairSync } from 'crypto';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { io as connect } from 'socket.io-client';
import request from 'supertest';

if (!process.env.DB_PORT) throw new Error('Run the tests with "npm test", which starts a temporary database.');
const storageDir = mkdtempSync(join(tmpdir(), 'msh-storage-'));
Object.assign(process.env, {
  NODE_ENV: 'test', DB_HOST: 'localhost', DB_USER: 'postgres', STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: storageDir,
  SEED_ADMIN_EMAIL: 'super@demo.ke', SEED_ADMIN_PASSWORD: 'super1234pass', SEED_SAMPLE_DATA: 'true', RATE_LIMIT_SCALE: '200', CORS_ORIGINS: 'http://localhost:5173', MAX_FAILED_LOGINS: '5',
  GOOGLE_CLIENT_IDS: 'web-client.apps.googleusercontent.com', APPLE_CLIENT_IDS: 'ke.test.services,ke.test.ios', AI_PROVIDER: 'rules', NEW_ACCOUNT_DAILY_STORIES: '3', SITE_URL: 'http://localhost:4000', REDIS_URL: process.env.TEST_REDIS_URL ?? '',
});

let app: INestApplication;
let http: any;
let mail: { outbox: Map<string, { subject: string; text: string }> };
let jobs: { idle: (ms?: number) => Promise<void>; runRecurring: (n: string) => Promise<void> };
let db: { q: (sql: string, p?: unknown[]) => Promise<any[]>; one: (sql: string, p?: unknown[]) => Promise<any> };
const api = '/api/v1';
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
const bearer = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Client': 'app' });

const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const idToken = (claims: Record<string, unknown>, key = pair.privateKey) => {
  const head = enc({ alg: 'RS256', kid: 'k1', typ: 'JWT' });
  const body = enc({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600, iss: 'https://accounts.google.com', aud: 'web-client.apps.googleusercontent.com', email_verified: true, ...claims });
  return `${head}.${body}.${createSign('RSA-SHA256').update(`${head}.${body}`).sign(key).toString('base64url')}`;
};

interface Person { token: string; refresh: string; id: string; username: string }
/** A contributor signed in through the demo route, with profile setup done. */
async function contributor(name: string): Promise<Person> {
  const r = await request(http).post(`${api}/auth/demo`).set('X-Client', 'app').send({ name }).expect(200);
  if (!r.body.user.profileComplete) await request(http).post(`${api}/auth/profile`).set(bearer(r.body.accessToken)).send({ username: name, avatar: 'dhow', language: 'en', theme: 'auto', acceptTerms: true, ageConfirmed: true }).expect(200);
  return { token: r.body.accessToken, refresh: r.body.refreshToken, id: r.body.user.id, username: name };
}
/** Admin sign-in: password, then the code sent by email. */
async function team(email: string, password: string): Promise<Person> {
  const a = await request(http).post(`${api}/auth/admin/login`).send({ email, password }).expect(200);
  expect(a.body.mfaRequired).toBe(true);
  await request(http).post(`${api}/auth/admin/mfa/send`).send({ mfaToken: a.body.mfaToken, channel: 'email' }).expect(200);
  const code = /code is (\d{6})/.exec(mail.outbox.get(email)!.text)![1];
  const s = await request(http).post(`${api}/auth/admin/mfa/verify`).set('X-Client', 'app').send({ mfaToken: a.body.mfaToken, code }).expect(200);
  return { token: s.body.accessToken, refresh: s.body.refreshToken, id: s.body.user.id, username: s.body.user.name };
}
async function post(p: Person, body: Record<string, unknown>, wait = true) {
  const r = await request(http).post(`${api}/stories`).set(bearer(p.token)).send(body);
  if (wait && r.status < 300) await jobs.idle();
  return r;
}
const story = async (id: string, p?: Person) => (await request(http).get(`${api}/stories/${id}`).set(p ? bearer(p.token) : {})).body;

let omari: Person, atieno: Person, baraka: Person, grace: Person, peter: Person, amina: Person, boss: Person;

beforeAll(async () => {
  const { AppDataSource } = await import('../src/database/data-source');
  const { runMigrations } = await import('../src/database/migrate');
  const { seed } = await import('../src/database/seed');
  await AppDataSource.initialize();
  await runMigrations(AppDataSource, () => undefined);
  await seed(AppDataSource, { sample: true, log: () => undefined });
  await AppDataSource.destroy();

  const { Test } = await import('@nestjs/testing');
  const { AppModule } = await import('../src/app.module');
  const { configureApp } = await import('../src/bootstrap');
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication({ bodyParser: false });
  configureApp(app);
  await app.listen(0);
  http = app.getHttpServer();
  mail = mod.get((await import('../src/common/mail.service')).MailService);
  jobs = mod.get((await import('../src/common/jobs.service')).Jobs);
  db = mod.get((await import('../src/common/db')).Db);
  const jwk = { ...(pair.publicKey.export({ format: 'jwk' }) as object), kid: 'k1', alg: 'RS256', use: 'sig' };
  const oauth = mod.get((await import('../src/auth/oauth.service')).OAuthService);
  oauth.useKeysForTesting('google', [jwk]); oauth.useKeysForTesting('apple', [jwk]);

  omari = await contributor('omari_test'); atieno = await contributor('atieno_test'); baraka = await contributor('baraka_test');
  grace = await team('grace@demo.ke', 'admin1234'); peter = await team('peter@demo.ke', 'admin1234'); amina = await team('amina@demo.ke', 'admin1234');
  boss = await team('super@demo.ke', 'super1234pass');
});

afterAll(async () => {
  await app?.close();
  rmSync(storageDir, { recursive: true, force: true });
});

describe('open access for visitors', () => {
  it('answers health checks and sends security headers', async () => {
    const r = await request(http).get(`${api}/health`).expect(200);
    expect(r.body.database).toBe('ok');
    expect(r.headers['content-security-policy']).toContain("default-src 'self'");
    expect(r.headers['x-powered-by']).toBeUndefined();
  });
  it('gives the lists and standard texts, in the reader’s language', async () => {
    const en = await request(http).get(`${api}/config`).expect(200);
    expect(en.body.languages).toHaveLength(20);
    expect(en.body.reportReasons).toHaveLength(5);
    expect(en.body.deletionReasons).toHaveLength(5);
    expect(en.body.rules).toHaveLength(5);
    expect(en.body.limits).toMatchObject({ images: 20, documents: 4 });
    const sw = await request(http).get(`${api}/config`).set('X-Language', 'sw').expect(200);
    expect(sw.body.reportReasons[0].label).toMatch(/Maudhui/);
  });
  it('lets anyone browse the trending feed, open a story and page through it', async () => {
    const a = await request(http).get(`${api}/stories?limit=5`).expect(200);
    expect(a.body.items).toHaveLength(5);
    expect(a.body.nextCursor).toBeTruthy();
    const b = await request(http).get(`${api}/stories?limit=5&cursor=${a.body.nextCursor}`).expect(200);
    expect(b.body.items.some((s: any) => a.body.items.some((x: any) => x.id === s.id))).toBe(false);
    const one = await request(http).get(`${api}/stories/${a.body.items[0].code}`).expect(200);
    expect(one.body).toMatchObject({ id: a.body.items[0].id, status: 'published' });
    expect(one.body.moderation).toBeUndefined();
    expect(one.body.counts.views).toBeUndefined();
  });
  it('offers incidents, places, the map, the timeline, collections, resources, announcements and search without an account', async () => {
    const inc = await request(http).get(`${api}/incidents?q=mtongwe`).expect(200);
    expect(inc.body[0].title).toMatch(/Mtongwe/);
    const page = await request(http).get(`${api}/incidents/${inc.body[0].code}`).expect(200);
    expect(page.body.outcome).toBeTruthy();
    const places = await request(http).get(`${api}/places?q=liko`).expect(200);
    expect(places.body[0].name).toBe('Likoni');
    expect((await request(http).get(`${api}/places?q=kivuko`).expect(200)).body[0].name).toBe('Likoni');
    const map = await request(http).get(`${api}/map?zoom=5`).expect(200);
    expect(map.body.stories.length).toBeGreaterThan(0); expect(map.body.incidents.length).toBeGreaterThan(0); expect(map.body.clustered).toBe(true);
    expect((await request(http).get(`${api}/map?zoom=14&bbox=39.5,-4.2,39.8,-3.9`).expect(200)).body.clustered).toBe(false);
    const tl = await request(http).get(`${api}/timeline`).expect(200);
    expect(tl.body.some((d: any) => d.decade === 1990 && d.incidents.length)).toBe(true);
    expect((await request(http).get(`${api}/collections`).expect(200)).body.length).toBeGreaterThan(0);
    const res = await request(http).get(`${api}/resources`).expect(200);
    expect(res.body.some((r: any) => r.type === 'handbook')).toBe(true);
    expect((await request(http).get(`${api}/resources/contributor-handbook`).expect(200)).body.citation).toMatch(/Remembering the Waters/);
    expect((await request(http).get(`${api}/announcements`).expect(200)).body[0].dates[0].label).toBeTruthy();
    const s = await request(http).get(`${api}/search?q=ferry`).expect(200);
    expect(s.body.stories.length + s.body.incidents.length).toBeGreaterThan(0);
    expect((await request(http).get(`${api}/contributors`).expect(200)).body.length).toBeGreaterThan(0);
  });
  it('asks a visitor to sign in before reacting, commenting, posting, following or reporting', async () => {
    const id = (await request(http).get(`${api}/stories?limit=1`)).body.items[0].id;
    for (const r of [request(http).put(`${api}/stories/${id}/reaction`).send({ type: 'heart' }), request(http).put(`${api}/stories/${id}/favourite`), request(http).post(`${api}/stories/${id}/comments`).send({ text: 'hi' }),
      request(http).post(`${api}/stories`).send({ text: 'x' }), request(http).post(`${api}/reports`).send({ targetType: 'story', targetId: id, reasons: ['spam'] }), request(http).get(`${api}/stories?tab=following`), request(http).get(`${api}/inbox`)]) {
      const x = await r; expect(x.status).toBe(401); expect(x.body.code).toBe('sign_in_required');
    }
    await request(http).post(`${api}/stories/${id}/share`).send({ kind: 'copy_link' }).expect(200);
    expect((await request(http).post(`${api}/stories/${id}/view`).expect(200)).body.counted).toBe(true);
    expect((await request(http).post(`${api}/stories/${id}/view`).expect(200)).body.counted).toBe(false);
    expect((await request(http).get(`${api}/stories/${id}/cite`).expect(200)).body.apa).toMatch(/MS-\d{4}-\d{5}/);
  });
  it('serves pages for search engines and link previews', async () => {
    const s = (await request(http).get(`${api}/stories?limit=1`)).body.items[0];
    const page = await request(http).get(`/stories/${s.code}`).expect(200);
    expect(page.text).toContain('og:title'); expect(page.text).toContain(`rel="canonical" href="http://localhost:4000/stories/${s.code}"`); expect(page.text).toContain('application/ld+json');
    await request(http).get('/stories/MS-1999-99999').expect(404);
    expect((await request(http).get('/sitemap.xml').expect(200)).text).toContain(`/stories/${s.code}`);
    expect((await request(http).get('/robots.txt').expect(200)).text).toContain('Disallow: /api/');
    expect((await request(http).get('/').expect(200)).text).toContain('Remembering the Waters');
  });
});

describe('contributors sign in with Google or Apple only', () => {
  it('has no registration form or password sign-in for contributors', async () => {
    await request(http).post(`${api}/auth/register`).send({ name: 'x', email: 'x@example.com', password: 'abc12345' }).expect(404);
    await request(http).post(`${api}/auth/login`).send({ email: 'x@example.com', password: 'abc12345' }).expect(404);
    const p = await request(http).get(`${api}/auth/providers`).expect(200);
    expect(p.body.google.clientId).toBe('web-client.apps.googleusercontent.com'); expect(p.body.apple.redirectUri).toMatch(/oauth\/apple\/callback$/);
  });
  it('creates a contributor on first Google sign-in, sets up the profile, and signs the same person in again', async () => {
    const first = await request(http).post(`${api}/auth/oauth/google`).set('X-Client', 'app').send({ idToken: idToken({ sub: 'g-100', email: 'Wanjiru@Example.com', name: 'Wanjiru Kamau', picture: 'https://lh3.googleusercontent.com/a/pic' }) }).expect(200);
    expect(first.body).toMatchObject({ created: true, user: { role: 'contributor', profileComplete: false, providerName: 'Wanjiru Kamau' } });
    const t = bearer(first.body.accessToken);
    expect((await request(http).post(`${api}/stories`).set(t).send({ text: 'hello' }).expect(403)).body.code).toBe('profile_incomplete');
    for (const [u, code] of [['adm1n_grace', 'username_reserved'], ['A_D_M_I_N', 'username_reserved'], ['ab', 'username_invalid'], ['omari_test', 'username_taken'], ['wanjiru_k', 'username_available']]) {
      expect((await request(http).get(`${api}/auth/username-available?username=${u}`).set(t).expect(200)).body.code).toBe(code);
    }
    expect((await request(http).post(`${api}/auth/profile`).set(t).send({ username: 'wanjiru_k', avatar: 'sail', language: 'sw', theme: 'dark' }).expect(400)).body.code).toBe('terms_required');
    expect((await request(http).post(`${api}/auth/profile`).set(t).send({ username: 'Admin', acceptTerms: true, ageConfirmed: true }).expect(400)).body.code).toBe('username_reserved');
    const done = await request(http).post(`${api}/auth/profile`).set(t).send({ username: 'wanjiru_k', avatar: 'sail', language: 'sw', theme: 'dark', acceptTerms: true, ageConfirmed: true }).expect(200);
    expect(done.body.user).toMatchObject({ username: 'wanjiru_k', avatar: 'avatar:sail', language: 'sw', theme: 'dark', profileComplete: true });
    expect(done.body.message).toBe('Wasifu umehifadhiwa.');
    const again = await request(http).post(`${api}/auth/oauth/google`).set('X-Client', 'app').send({ idToken: idToken({ sub: 'g-100', email: 'wanjiru@example.com' }) }).expect(200);
    expect(again.body).toMatchObject({ created: false, user: { username: 'wanjiru_k' } });
    const keep = await request(http).post(`${api}/auth/profile`).set(bearer(again.body.accessToken)).send({ useProviderIdentity: true }).expect(200);
    expect(keep.body.user).toMatchObject({ name: 'Wanjiru Kamau', avatar: 'https://lh3.googleusercontent.com/a/pic' });
  });
  it('accepts Apple tokens and refuses forged, expired or wrong-audience ones', async () => {
    const apple = await request(http).post(`${api}/auth/oauth/apple`).set('X-Client', 'app').send({ idToken: idToken({ iss: 'https://appleid.apple.com', aud: 'ke.test.ios', sub: 'a-1', email: 'relay@privaterelay.appleid.com' }), name: 'Juma' }).expect(200);
    expect(apple.body.user.providerName).toBe('Juma');
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    for (const bad of [idToken({ sub: 'g-2' }, other.privateKey), idToken({ sub: 'g-2', exp: Math.floor(Date.now() / 1000) - 3600 }), idToken({ sub: 'g-2', aud: 'someone-else' }), idToken({ sub: 'g-2', iss: 'https://evil.example' }), 'not-a-token']) {
      expect((await request(http).post(`${api}/auth/oauth/google`).send({ idToken: bad }).expect(401)).body.code).toBe('sign_in_failed');
    }
    const cb = await request(http).post(`${api}/auth/oauth/apple/callback`).type('form').send({ code: 'abc', id_token: 'x.y.z', state: 's1' }).expect(303);
    expect(cb.headers.location).toMatch(/^intent:\/\/callback\?code=abc.*scheme=signinwithapple;end$/);
  });
  it('rotates refresh tokens, ends every session when an old one is reused, and lists devices', async () => {
    const p = await contributor('session_test');
    const list = await request(http).get(`${api}/auth/sessions`).set(bearer(p.token)).expect(200);
    expect(list.body.length).toBeGreaterThan(0);
    const r1 = await request(http).post(`${api}/auth/refresh`).set('X-Client', 'app').send({ refreshToken: p.refresh }).expect(200);
    expect((await request(http).post(`${api}/auth/refresh`).set('X-Client', 'app').send({ refreshToken: p.refresh }).expect(401)).body.code).toBe('session_expired');
    await request(http).post(`${api}/auth/refresh`).set('X-Client', 'app').send({ refreshToken: r1.body.refreshToken }).expect(401);
    const web = await request(http).post(`${api}/auth/demo`).send({ name: 'session_test' }).expect(200);
    expect(web.body.refreshToken).toBeUndefined();
    expect(String(web.headers['set-cookie'])).toMatch(/msh_refresh=.*HttpOnly.*SameSite=Strict/);
  });
});

describe('admins: registration, approval and multi-factor sign-in', () => {
  it('registers an admin who waits for Super Admin approval, then signs in with a second factor', async () => {
    expect((await request(http).post(`${api}/auth/admin/register`).send({ fullName: 'Lucy Achieng', email: 'lucy@demo.ke', phone: '+254700000001', staffNumber: 'RW-200', idNumber: '12345678', password: 'password1' }).expect(400)).body.code).toBe('password_breached');
    const reg = await request(http).post(`${api}/auth/admin/register`).send({ fullName: 'Lucy Achieng', email: 'lucy@demo.ke', phone: '+254700000001', staffNumber: 'RW-200', idNumber: '12345678', password: 'Ziwa-Victoria-77' }).expect(201);
    expect(reg.body.message).toMatch(/Super Admin will review/);
    expect((await request(http).post(`${api}/auth/admin/login`).send({ email: 'lucy@demo.ke', password: 'Ziwa-Victoria-77' }).expect(403)).body.code).toBe('admin_awaiting_approval');
    const list = await request(http).get(`${api}/super/admins`).set(bearer(boss.token)).expect(200);
    const lucy = list.body.find((a: any) => a.email === 'lucy@demo.ke');
    expect(lucy).toMatchObject({ status: 'pending', idNumberMasked: '••••5678', adminName: 'Admin – Lucy' });
    expect(JSON.stringify(list.body)).not.toContain('12345678');
    await request(http).get(`${api}/super/admins`).set(bearer(grace.token)).expect(403);
    expect((await request(http).get(`${api}/me/notifications?priority=true`).set(bearer(boss.token)).expect(200)).body.items.some((n: any) => n.kind === 'admin.registration')).toBe(true);
    await request(http).post(`${api}/super/admins/${lucy.id}/decision`).set(bearer(boss.token)).send({ approve: true }).expect(200);
    expect((await request(http).get(`${api}/super/admins/${lucy.id}/id-number`).set(bearer(boss.token)).expect(200)).body.idNumber).toBe('12345678');
    const l = await team('lucy@demo.ke', 'Ziwa-Victoria-77');
    const me = await request(http).get(`${api}/auth/me`).set(bearer(l.token)).expect(200);
    expect(me.body).toMatchObject({ role: 'admin', name: 'Admin – Lucy', avatar: 'logo', badge: 'ADMIN' });
    // An authenticator app as the main second factor.
    const start = await request(http).post(`${api}/auth/admin/mfa/authenticator`).set(bearer(l.token)).expect(201);
    const { totp } = await import('../src/auth/totp');
    expect((await request(http).post(`${api}/auth/admin/mfa/authenticator/confirm`).set(bearer(l.token)).send({ code: '000000' }).expect(400)).body.code).toBe('mfa_wrong');
    await request(http).post(`${api}/auth/admin/mfa/authenticator/confirm`).set(bearer(l.token)).send({ code: totp(start.body.secret) }).expect(200);
    const a = await request(http).post(`${api}/auth/admin/login`).send({ email: 'lucy@demo.ke', password: 'Ziwa-Victoria-77' }).expect(200);
    expect(a.body.methods).toContain('authenticator');
    await request(http).post(`${api}/auth/admin/mfa/verify`).send({ mfaToken: a.body.mfaToken, code: totp(start.body.secret) }).expect(200);
    // Admins cannot change their admin name; contributors cannot use admin routes.
    await request(http).post(`${api}/auth/profile`).set(bearer(l.token)).send({ username: 'lucy' }).expect(403);
    await request(http).get(`${api}/admin/moderation`).set(bearer(omari.token)).expect(403);
  });
  it('locks sign-in after repeated wrong passwords or codes and tells the owner', async () => {
    const a = await request(http).post(`${api}/auth/admin/login`).send({ email: 'amina@demo.ke', password: 'admin1234' }).expect(200);
    expect((await request(http).post(`${api}/auth/admin/mfa/verify`).send({ mfaToken: a.body.mfaToken, code: '123456' }).expect(401)).body.code).toBe('mfa_wrong');
    await db.q(`UPDATE users SET failed_logins = 0 WHERE email = 'amina@demo.ke'`);
    for (let i = 0; i < 4; i++) expect((await request(http).post(`${api}/auth/admin/login`).send({ email: 'amina@demo.ke', password: 'wrong-pass-1' }).expect(401)).body.code).toBe('admin_wrong_login');
    const locked = await request(http).post(`${api}/auth/admin/login`).send({ email: 'amina@demo.ke', password: 'wrong-pass-1' }).expect(429);
    expect(locked.body.message).toMatch(/locked for 15 minutes/);
    expect(mail.outbox.get('amina@demo.ke')!.subject).toMatch(/locked/);
    await request(http).post(`${api}/auth/admin/login`).send({ email: 'amina@demo.ke', password: 'admin1234' }).expect(429);
    await db.q(`UPDATE users SET locked_until = NULL WHERE email = 'amina@demo.ke'`);
    expect((await request(http).post(`${api}/auth/admin/login`).send({ email: 'nobody@demo.ke', password: 'whatever1' }).expect(401)).body.code).toBe('admin_wrong_login');
  });
  it('invites an admin, and keeps the rule that there is always a Super Admin', async () => {
    const inv = await request(http).post(`${api}/super/admins/invite`).set(bearer(boss.token)).send({ email: 'juma@demo.ke', fullName: 'Juma Said' }).expect(201);
    expect(inv.body.message).toBe('Invitation sent to juma@demo.ke.');
    const token = /invite=([\w-]+)/.exec(mail.outbox.get('juma@demo.ke')!.text)![1];
    await request(http).post(`${api}/auth/admin/register`).send({ fullName: 'Juma Said', email: 'juma@demo.ke', phone: '+254700000002', staffNumber: 'RW-201', password: 'Bahari-Hindi-42', inviteToken: 'wrong' }).expect(403);
    await request(http).post(`${api}/auth/admin/register`).send({ fullName: 'Juma Said', email: 'juma@demo.ke', phone: '+254700000002', staffNumber: 'RW-201', password: 'Bahari-Hindi-42', inviteToken: token }).expect(201);
    const juma = await team('juma@demo.ke', 'Bahari-Hindi-42');
    expect((await request(http).post(`${api}/me/delete`).set(bearer(boss.token)).send({ reason: 'privacy' }).expect(409)).body.message).toMatch(/You are the only Super Admin/);
    expect((await request(http).post(`${api}/super/admins/${boss.id}/remove`).set(bearer(boss.token)).send({ reason: 'testing the rule' }).expect(409)).body.code).toBe('last_super_admin');
    expect((await request(http).post(`${api}/super/admins/${juma.id}/remove`).set(bearer(boss.token)).send({ reason: 'Left the project' }).expect(200)).body.message).toBe('Admin – Juma has been removed.');
    await request(http).get(`${api}/auth/me`).set(bearer(juma.token)).expect(401);
  });
});

describe('sharing a story and AI review', () => {
  let green: any;
  it('limits how much a brand-new account can post in its first day', async () => {
    const fresh = await contributor('fresh_test');
    for (let i = 0; i < 3; i++) expect((await post(fresh, { text: `Story number ${i + 1} from a new account.` }, false)).status).toBe(201);
    expect((await post(fresh, { text: 'One too many.' }, false)).body.code).toBe('rate_limited');
    await db.q(`UPDATE users SET created_at = now() - interval '3 days' WHERE username LIKE '%\\_test'`);
    expect((await post(fresh, { text: 'Fine once the account is older.' })).status).toBe(201);
  });
  it('posts a GREEN story with a photo, strips hidden data, and shows it to everyone', async () => {
    const sharp = (await import('sharp')).default;
    const jpg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#2a6fb0' } }).withExif({ IFD0: { Copyright: 'secret-device-data' } }).jpeg().toBuffer();
    const up = await request(http).post(`${api}/media`).set(bearer(omari.token)).field('purpose', 'story').field('altText', 'A blue sea').attach('file', jpg, 'boat.jpg').expect(201);
    expect(up.body).toMatchObject({ kind: 'image', processing: 'done', width: 1200 });
    expect(Object.keys(up.body.urls)).toEqual(expect.arrayContaining(['thumb', 'medium', 'full']));
    const img = await request(http).get(up.body.urls.medium.replace('http://localhost:4000', '')).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); }).expect(200);
    expect(img.headers['content-type']).toBe('image/webp');
    expect((img.body as Buffer).includes('secret-device-data')).toBe(false);
    await request(http).get(up.body.urls.medium.replace('http://localhost:4000', '').replace(/sig=.{6}/, 'sig=AAAAAA')).expect(403);
    const place = (await request(http).get(`${api}/places?q=likoni`)).body[0];
    const r = await post(omari, { title: 'The evening ferry', text: 'We crossed at Likoni every evening. The crew told us where the life jackets were.', mediaIds: [up.body.id], placeId: place.id, eventDate: '1998-06-01', dateApproximate: true,
      category: 'Ferry and passenger transport', vessel: 'MV Nyayo', tags: ['Ferry', '#crew'], rights: 'CC BY-NC 4.0' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ status: 'reviewing', message: 'Checking your story… This takes up to 3 minutes.' });
    green = await story(r.body.id);
    expect(green).toMatchObject({ status: 'published', code: expect.stringMatching(/^MS-\d{4}-\d{5}$/), place: { name: 'Likoni', county: 'Mombasa' }, tags: ['ferry', 'crew'], author: { username: 'omari_test', avatar: 'avatar:dhow' } });
    expect(green.media[0].altText).toBe('A blue sea');
    const st = await request(http).get(`${api}/stories/${green.id}/review`).set(bearer(omari.token)).expect(200);
    expect(st.body).toMatchObject({ done: true, flag: 'GREEN', message: 'Your story is live!' });
    expect((await request(http).get(`${api}/stories?placeId=${place.id}`).expect(200)).body.items.some((s: any) => s.id === green.id)).toBe(true);
    expect((await request(http).get(`${api}/stories?authorId=${omari.id}`).expect(200)).body.items).toHaveLength(1);
    expect((await request(http).get(`/og/stories/${green.code}`).expect(200)).headers['content-type']).toBe('image/webp');
  });
  it('enforces the story rules on the server', async () => {
    expect((await post(omari, { text: '   ' }, false)).body.code).toBe('story_empty');
    expect((await post(omari, { text: 'My grandmother told me this.', postedAs: 'told_by', toldBy: 'Mama Zawadi' }, false)).body.code).toBe('consent_required');
    expect((await post(omari, { text: 'A company story', postedAs: 'company' }, false)).status).toBe(403);
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) ids.push((await request(http).post(`${api}/media`).set(bearer(omari.token)).attach('file', Buffer.from(`%PDF-1.4 sample ${i}`), `doc${i}.pdf`).expect(201)).body.id);
    const other = (await request(http).post(`${api}/media`).set(bearer(atieno.token)).attach('file', PNG, 'a.png').expect(201)).body.id;
    expect((await post(omari, { text: 'x', mediaIds: [other] }, false)).status).toBe(400);
    expect((await request(http).post(`${api}/media`).set(bearer(omari.token)).attach('file', Buffer.from('MZ\x90\x00\x03\x00\x00\x00binary'), 'tool.exe').expect(400)).body.code).toBe('file_unsupported');
    expect((await request(http).post(`${api}/media`).set(bearer(omari.token)).attach('file', Buffer.from('<html><script>alert(1)</script></html>'), 'page.txt').expect(400)).body.code).toBe('file_unsupported');
    await request(http).post(`${api}/media`).attach('file', PNG, 'a.png').expect(401);
    const key = `idem-${Date.now()}`;
    const a = await request(http).post(`${api}/stories`).set(bearer(omari.token)).set('Idempotency-Key', key).send({ text: 'Sent twice on a weak connection.', mediaIds: ids }).expect(201);
    const b = await request(http).post(`${api}/stories`).set(bearer(omari.token)).set('Idempotency-Key', key).send({ text: 'Sent twice on a weak connection.', mediaIds: ids }).expect(201);
    expect(b.body.id).toBe(a.body.id);
    await jobs.idle();
    expect((await story(a.body.id)).media).toHaveLength(2);
  });
  it('resumes an upload that was cut off (tus protocol)', async () => {
    const sharp = (await import('sharp')).default;
    const file = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#0b6fc2' } }).png().toBuffer();
    const meta = `filename ${Buffer.from('lake.png').toString('base64')},purpose ${Buffer.from('story').toString('base64')}`;
    await request(http).post(`${api}/uploads`).set('Tus-Resumable', '1.0.0').set('Upload-Length', String(file.length)).set('Upload-Metadata', meta).expect(401);
    const c = await request(http).post(`${api}/uploads`).set(bearer(omari.token)).set('Tus-Resumable', '1.0.0').set('Upload-Length', String(file.length)).set('Upload-Metadata', meta).expect(201);
    const url = c.headers.location.replace('http://localhost:4000', '');
    const half = Math.floor(file.length / 2);
    const p1 = await request(http).patch(url).set(bearer(omari.token)).set('Tus-Resumable', '1.0.0').set('Upload-Offset', '0').set('Content-Type', 'application/offset+octet-stream').send(file.subarray(0, half)).expect(204);
    expect(p1.headers['upload-offset']).toBe(String(half));
    // The connection dropped: the client asks where to continue.
    expect((await request(http).head(url).set(bearer(omari.token)).expect(200)).headers['upload-offset']).toBe(String(half));
    await request(http).patch(url).set(bearer(omari.token)).set('Upload-Offset', '0').set('Content-Type', 'application/offset+octet-stream').send(file.subarray(0, 10)).expect(409);
    await request(http).head(url).set(bearer(atieno.token)).expect(404);
    const p2 = await request(http).patch(url).set(bearer(omari.token)).set('Upload-Offset', String(half)).set('Content-Type', 'application/offset+octet-stream').send(file.subarray(half)).expect(204);
    expect(p2.headers['upload-media-id']).toBeTruthy();
    const done = await request(http).get(url).set(bearer(omari.token)).expect(200);
    expect(done.body).toMatchObject({ complete: true, media: { kind: 'image', width: 900, name: 'lake.png' } });
  });
  it('converts audio and video for the web, with adaptive streaming, when FFmpeg is installed', async () => {
    const { execFileSync } = await import('child_process');
    const { readFileSync } = await import('fs');
    try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { return; }
    const v = join(storageDir, 'clip.mp4'), a = join(storageDir, 'voice.mp3');
    execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc=duration=3:size=640x360:rate=15', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-metadata', 'location=+00.0000+034.0000/', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', v], { stdio: 'ignore' });
    execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=2', a], { stdio: 'ignore' });
    const vid = await request(http).post(`${api}/media`).set(bearer(atieno.token)).attach('file', readFileSync(v), 'clip.mp4').expect(201);
    const aud = await request(http).post(`${api}/media`).set(bearer(atieno.token)).attach('file', readFileSync(a), 'voice.mp3').expect(201);
    expect(vid.body).toMatchObject({ kind: 'video', durationSeconds: 3 });
    const s = await post(atieno, { text: 'A short clip from the beach.', mediaIds: [vid.body.id, aud.body.id] });
    await jobs.idle(120_000);
    const st = await story(s.body.id);
    expect(st.status).toBe('published');
    const video = st.media.find((m: any) => m.kind === 'video'), audio = st.media.find((m: any) => m.kind === 'audio');
    expect(Object.keys(video.urls)).toEqual(expect.arrayContaining(['poster', 'web', 'hls', 'hls360.m3u8'.replace('.m3u8', '')]));
    expect(video.urls.original).toBeUndefined();
    expect(audio.urls.web).toBeTruthy();
    const local = (u: string) => u.replace('http://localhost:4000', '');
    const master = await request(http).get(local(video.urls.hls)).expect(200);
    expect(master.text).toMatch(/#EXT-X-STREAM-INF:BANDWIDTH=600000/);
    const playlist = await request(http).get(local(master.text.split('\n').find((l: string) => l.startsWith('/api'))!)).expect(200);
    expect(playlist.text).toMatch(/#EXTINF/);
    await request(http).get(local(playlist.text.split('\n').find((l: string) => l.startsWith('/api'))!)).expect(200).expect('content-type', 'video/mp2t');
    const part = await request(http).get(local(video.urls.web)).set('Range', 'bytes=0-99').expect(206);
    expect(part.headers['content-range']).toMatch(/^bytes 0-99\//);
    const tooMany = await request(http).post(`${api}/media`).set(bearer(atieno.token)).attach('file', readFileSync(v), 'clip2.mp4').expect(201);
    expect((await post(atieno, { text: 'two videos', mediaIds: [vid.body.id, tooMany.body.id] }, false)).status).toBe(400);
  }, 180_000);
  it('saves drafts, then sends them', async () => {
    const d = await post(atieno, { text: 'Half a story', draft: true }, false);
    expect(d.body).toMatchObject({ status: 'draft', message: 'Draft saved.' });
    await request(http).get(`${api}/stories/${d.body.id}`).expect(404);
    expect((await request(http).get(`${api}/me/stories?status=drafts`).set(bearer(atieno.token)).expect(200)).body).toHaveLength(1);
    await request(http).patch(`${api}/stories/${d.body.id}`).set(bearer(atieno.token)).send({ text: 'The whole story of the night we fished off Mbita.', draft: true }).expect(200);
    await request(http).patch(`${api}/stories/${d.body.id}`).set(bearer(omari.token)).send({ text: 'hijack' }).expect(403);
    await request(http).post(`${api}/stories/${d.body.id}/submit`).set(bearer(atieno.token)).expect(200);
    await jobs.idle();
    expect((await story(d.body.id)).status).toBe('published');
  });
  it('publishes a YELLOW story with a warning and blocks a RED story for the admins', async () => {
    const y = await post(baraka, { text: 'Call the captain on 0712 345 678 if you want to cross at night.' });
    const ys = await story(y.body.id, baraka);
    expect(ys).toMatchObject({ status: 'published', moderation: { aiFlag: 'YELLOW' } });
    const notes = (await request(http).get(`${api}/me/notifications`).set(bearer(baraka.token)).expect(200)).body.items;
    expect(notes.find((n: any) => n.kind === 'story.yellow').title).toBe('Your story is live, with a warning.');
    const r = await post(baraka, { text: 'To the ferry captain: I will kill you if you leave without us again.' });
    const rs = await story(r.body.id, baraka);
    expect(rs).toMatchObject({ status: 'pending_review', moderation: { aiFlag: 'RED' } });
    expect(rs.moderation.aiExplanation.guidelines[0].key).toBe('harassment');
    await request(http).get(`${api}/stories/${r.body.id}`).expect(404);
    await request(http).get(`${api}/stories/${r.body.id}`).set(bearer(atieno.token)).expect(404);
    const q = await request(http).get(`${api}/admin/moderation?filter=pending`).set(bearer(grace.token)).expect(200);
    expect(q.body.items.some((s: any) => s.id === r.body.id)).toBe(true);
    expect(q.body.counts.red).toBeGreaterThan(0);
    expect((await request(http).get(`${api}/admin/moderation?flag=green&sort=oldest`).set(bearer(grace.token)).expect(200)).body.items.every((s: any) => s.moderation.aiFlag === 'GREEN')).toBe(true);
  });
  it('checks an edit to a published story before it shows, and keeps the edit history', async () => {
    await request(http).patch(`${api}/stories/${green.id}`).set(bearer(omari.token)).send({ text: 'We crossed at Likoni every evening, and the crew always pointed at the life jackets.' }).expect(200);
    await jobs.idle();
    const s = await story(green.id, omari);
    expect(s).toMatchObject({ edited: true, text: expect.stringMatching(/always pointed/) });
    expect(s.editHistory).toHaveLength(1);
    await request(http).patch(`${api}/stories/${green.id}`).set(bearer(omari.token)).send({ text: 'I will kill you all.' }).expect(200);
    await jobs.idle();
    expect((await story(green.id)).text).toMatch(/always pointed/);
  });
});

describe('engagement, comments and social features', () => {
  let id: string;
  beforeAll(async () => { id = (await request(http).get(`${api}/stories?authorId=${omari.id}`)).body.items.find((s: any) => s.title === 'The evening ferry').id; });
  it('reacts, favourites and counts', async () => {
    expect((await request(http).put(`${api}/stories/${id}/reaction`).set(bearer(atieno.token)).send({ type: 'heart' }).expect(200)).body).toMatchObject({ reaction: 'heart', counts: { hearts: 1 } });
    expect((await request(http).put(`${api}/stories/${id}/reaction`).set(bearer(atieno.token)).send({ type: 'laugh' }).expect(200)).body).toMatchObject({ reaction: 'laugh', counts: { hearts: 0, laughs: 1 } });
    expect((await request(http).put(`${api}/stories/${id}/reaction`).set(bearer(atieno.token)).send({ type: 'laugh' }).expect(200)).body).toMatchObject({ reaction: null, counts: { laughs: 0 } });
    const f1 = await request(http).put(`${api}/stories/${id}/favourite`).set(bearer(atieno.token)).expect(200);
    expect(f1.body).toMatchObject({ favourited: true, message: 'Added to Favorites.' });
    expect((await request(http).get(`${api}/stories?tab=favorites`).set(bearer(atieno.token)).expect(200)).body.items[0].id).toBe(id);
    expect((await request(http).put(`${api}/stories/${id}/favourite`).set(bearer(atieno.token)).expect(200)).body).toMatchObject({ favourited: false, message: 'Removed from Favorites.' });
    await jobs.runRecurring('stories.trending');
    expect((await request(http).get(`${api}/stories?limit=3`).expect(200)).body.items).toHaveLength(3);
  });
  it('threads comments, tags people, sorts, and holds a comment that breaks the rules', async () => {
    const c1 = await request(http).post(`${api}/stories/${id}/comments`).set(bearer(atieno.token)).send({ text: 'I remember that ferry, @omari_test!' }).expect(201);
    const c2 = await request(http).post(`${api}/stories/${id}/comments`).set(bearer(baraka.token)).send({ text: 'So do I.', parentId: c1.body.id }).expect(201);
    await request(http).post(`${api}/stories/${id}/comments`).set(bearer(omari.token)).send({ text: 'Thank you both.' }).expect(201);
    await request(http).put(`${api}/comments/${c2.body.id}/reaction`).set(bearer(omari.token)).send({ type: 'heart' }).expect(200);
    const list = await request(http).get(`${api}/stories/${id}/comments`).expect(200);
    expect(list.body.count).toBe(3);
    expect(list.body.items[0].replies[0]).toMatchObject({ text: 'So do I.', replyTo: { username: 'atieno_test' }, reactions: 1 });
    expect((await request(http).get(`${api}/stories/${id}/comments?sort=recent`).expect(200)).body.items[0].text).toBe('Thank you both.');
    const notes = (await request(http).get(`${api}/me/notifications`).set(bearer(omari.token)).expect(200)).body.items.map((n: any) => n.kind);
    expect(notes).toEqual(expect.arrayContaining(['comment.mention', 'story.reaction']));
    const held = await request(http).post(`${api}/stories/${id}/comments`).set(bearer(baraka.token)).send({ text: 'You deserve to die for this.' }).expect(201);
    expect(held.body).toMatchObject({ held: true, message: expect.stringMatching(/not posted/) });
    expect((await request(http).get(`${api}/stories/${id}/comments`).expect(200)).body.count).toBe(3);
    const q = await request(http).get(`${api}/admin/held/comments`).set(bearer(grace.token)).expect(200);
    await request(http).post(`${api}/admin/held/comments/${q.body[0].id}`).set(bearer(grace.token)).send({ allow: false, reason: 'A threat.' }).expect(200);
  });
  it('follows, blocks and mutes', async () => {
    await request(http).put(`${api}/people/${omari.id}/follow`).set(bearer(atieno.token)).send({ on: true }).expect(200);
    expect((await request(http).get(`${api}/stories?tab=following`).set(bearer(atieno.token)).expect(200)).body.items.every((s: any) => s.author.username === 'omari_test')).toBe(true);
    expect((await request(http).get(`${api}/contributors/omari_test`).set(bearer(atieno.token)).expect(200)).body).toMatchObject({ followers: 1, viewer: { following: true } });
    expect((await request(http).get(`${api}/contributors?q=omari_t`).expect(200)).body[0].person.username).toBe('omari_test');
    const b = await request(http).put(`${api}/people/${baraka.id}/block`).set(bearer(omari.token)).send({ on: true }).expect(200);
    expect(b.body.message).toBe('@baraka_test is blocked.');
    // A blocked user cannot view, comment on, react to or message the user who blocked them.
    await request(http).get(`${api}/stories/${id}`).set(bearer(baraka.token)).expect(404);
    await request(http).put(`${api}/stories/${id}/reaction`).set(bearer(baraka.token)).send({ type: 'heart' }).expect(404);
    await request(http).post(`${api}/stories/${id}/comments`).set(bearer(baraka.token)).send({ text: 'hello' }).expect(404);
    expect((await request(http).post(`${api}/inbox`).set(bearer(baraka.token)).send({ toUserId: omari.id, text: 'hello' }).expect(403)).body.code).toBe('blocked_interaction');
    await request(http).get(`${api}/contributors/omari_test`).set(bearer(baraka.token)).expect(404);
    expect((await request(http).get(`${api}/me/blocked`).set(bearer(omari.token)).expect(200)).body).toHaveLength(1);
    await request(http).put(`${api}/people/${baraka.id}/block`).set(bearer(omari.token)).send({ on: false }).expect(200);
    await request(http).get(`${api}/stories/${id}`).set(bearer(baraka.token)).expect(200);
  });
  it('delivers messages, requests, read receipts and live updates', async () => {
    const socket = connect(`http://localhost:${http.address().port}`, { auth: { token: omari.token }, transports: ['websocket'] });
    const events: string[] = [];
    await new Promise<void>((res, rej) => { socket.on('ready', () => res()); socket.on('connect_error', rej); });
    socket.onAny((e) => events.push(e));
    const m = await request(http).post(`${api}/inbox`).set(bearer(baraka.token)).set('Idempotency-Key', 'm-1').send({ toUserId: omari.id, text: 'Habari, may I ask about your story?' }).expect(201);
    expect((await request(http).post(`${api}/inbox`).set(bearer(baraka.token)).set('Idempotency-Key', 'm-1').send({ toUserId: omari.id, text: 'Habari, may I ask about your story?' }).expect(201)).body.id).toBe(m.body.id);
    await new Promise((r) => setTimeout(r, 300));
    expect(events).toEqual(expect.arrayContaining(['message', 'counts', 'notification']));
    socket.close();
    const inbox = await request(http).get(`${api}/inbox`).set(bearer(omari.token)).expect(200);
    expect(inbox.body).toMatchObject({ unread: 1, conversations: [], requests: [{ unread: 1, with: { username: 'baraka_test' } }] });
    await request(http).post(`${api}/inbox/${m.body.conversationId}/accept`).set(bearer(omari.token)).expect(200);
    expect((await request(http).post(`${api}/inbox/${m.body.conversationId}/read`).set(bearer(omari.token)).expect(200)).body.inbox).toBe(0);
    await request(http).post(`${api}/inbox`).set(bearer(omari.token)).send({ conversationId: m.body.conversationId, text: 'Karibu, ask away.' }).expect(201);
    const thread = await request(http).get(`${api}/inbox/${m.body.conversationId}`).set(bearer(baraka.token)).expect(200);
    expect(thread.body.items.map((x: any) => x.text)).toEqual(['Karibu, ask away.', 'Habari, may I ask about your story?']);
    expect(thread.body.items[1].seen).toBe(true);
    await request(http).get(`${api}/inbox/${m.body.conversationId}`).set(bearer(atieno.token)).expect(404);
    expect((await request(http).post(`${api}/inbox`).set(bearer(baraka.token)).send({ conversationId: m.body.conversationId, text: 'I will kill you' }).expect(201)).body.held).toBe(true);
    const help = await request(http).post(`${api}/inbox`).set(bearer(atieno.token)).send({ toAdmins: true, topic: 'Account help', text: 'How do I change my photo?' }).expect(201);
    expect((await request(http).get(`${api}/inbox`).set(bearer(grace.token)).expect(200)).body.conversations.some((c: any) => c.id === help.body.conversationId && c.topic === 'Account help')).toBe(true);
    const bad = connect(`http://localhost:${http.address().port}`, { auth: { token: 'nope' }, transports: ['websocket'] });
    await new Promise<void>((res) => bad.on('disconnect', () => res()));
  });
});

describe('moderation, approvals, reports and account actions', () => {
  let red: any, removed: any;
  it('overrides an AI ban only when the other admins approve', async () => {
    red = (await request(http).get(`${api}/admin/moderation?filter=blocked`).set(bearer(grace.token)).expect(200)).body.items[0];
    expect((await request(http).post(`${api}/admin/stories/${red.id}/override`).set(bearer(grace.token)).send({ reason: '' }).expect(400)).body.code).toBeDefined();
    const o = await request(http).post(`${api}/admin/stories/${red.id}/override`).set(bearer(grace.token)).send({ reason: 'It quotes a threat the storyteller received; it is testimony, not a threat.' }).expect(200);
    expect(o.body).toMatchObject({ message: 'Override submitted for approval.', approval: { status: 'pending', mine: true } });
    const reqId = o.body.approval.id;
    expect((await story(red.id, grace)).status).toBe('pending_review');
    expect((await request(http).post(`${api}/admin/approvals/${reqId}/vote`).set(bearer(grace.token)).send({ vote: 'approve', justification: 'my own' }).expect(403)).body.code).toBe('approval_own');
    expect((await request(http).get(`${api}/admin/approvals/waiting`).set(bearer(peter.token)).expect(200)).body.some((a: any) => a.id === reqId)).toBe(true);
    const lucy = await team('lucy@demo.ke', 'Ziwa-Victoria-77').catch(() => null);
    const v1 = await request(http).post(`${api}/admin/approvals/${reqId}/vote`).set(bearer(peter.token)).send({ vote: 'approve', justification: 'Agreed: it is a quoted threat.' }).expect(200);
    expect(v1.body.status).toBe('pending'); expect(v1.body.progress).toMatch(/^1 of \d approved$/);
    const v2 = await request(http).post(`${api}/admin/approvals/${reqId}/vote`).set(bearer(amina.token)).send({ vote: 'approve', justification: 'Agreed.' }).expect(200);
    if (v2.body.status === 'pending' && lucy) await request(http).post(`${api}/admin/approvals/${reqId}/vote`).set(bearer(lucy.token)).send({ vote: 'approve', justification: 'Agreed.' }).expect(200);
    const s = await story(red.id);
    expect(s.status).toBe('published');
    expect((await story(red.id, grace)).moderation.overridden).toBe(true);
    expect((await request(http).get(`${api}/admin/moderation?filter=overridden`).set(bearer(grace.token)).expect(200)).body.items.some((x: any) => x.id === red.id)).toBe(true);
  });
  it('removes a story with a reason, lets the contributor Ask Why, and needs a different admin for the second review', async () => {
    removed = (await post(atieno, { text: 'An ordinary story about the fish market at Dunga.' })).body;
    await request(http).post(`${api}/admin/stories/${removed.id}/remove`).set(bearer(grace.token)).send({ reason: '' }).expect(400);
    const r = await request(http).post(`${api}/admin/stories/${removed.id}/remove`).set(bearer(grace.token)).send({ reason: 'Posted twice.' }).expect(200);
    expect(r.body.message).toBe('Story deleted. The Contributor has been notified.');
    await request(http).get(`${api}/stories/${removed.id}`).expect(404);
    const note = (await request(http).get(`${api}/me/notifications?priority=true`).set(bearer(atieno.token)).expect(200)).body.items.find((n: any) => n.kind === 'story.removed');
    expect(note.title).toMatch(/^Your story MS-\d{4}-\d{5} was removed by an admin\.$/);
    expect(note.data.askWhy).toBe(true);
    const ask = await request(http).post(`${api}/stories/${removed.id}/ask-why`).set(bearer(atieno.token)).send({ subject: 'Why?', description: 'I only posted it once.' }).expect(200);
    expect(ask.body.message).toMatch(/sent to the admins/);
    await request(http).post(`${api}/stories/${removed.id}/ask-why`).set(bearer(omari.token)).send({ description: 'not mine' }).expect(403);
    expect((await request(http).get(`${api}/inbox/${ask.body.conversationId}`).set(bearer(peter.token)).expect(200)).body.conversation.topic).toMatch(/^Story MS-.* issue$/);
    await request(http).post(`${api}/inbox`).set(bearer(peter.token)).send({ conversationId: ask.body.conversationId, text: 'You are right; we will look again.' }).expect(201);
    await request(http).post(`${api}/admin/stories/${removed.id}/restore`).set(bearer(grace.token)).send({ reason: 'Second look' }).expect(403);
    await request(http).post(`${api}/admin/stories/${removed.id}/restore`).set(bearer(peter.token)).send({ reason: 'It was not a duplicate.' }).expect(200);
    expect((await story(removed.id)).status).toBe('published');
    expect((await request(http).get(`${api}/admin/stories/${removed.id}/history`).set(bearer(grace.token)).expect(200)).body.map((d: any) => d.adminAction)).toEqual(expect.arrayContaining(['remove', 'restore']));
  });
  it('locks and hides comments with a reason shown to contributors', async () => {
    await request(http).post(`${api}/admin/stories/${removed.id}/comments-lock`).set(bearer(grace.token)).send({ on: true }).expect(400);
    await request(http).post(`${api}/admin/stories/${removed.id}/comments-lock`).set(bearer(grace.token)).send({ on: true, reason: 'The discussion became heated.' }).expect(200);
    const c = await request(http).post(`${api}/stories/${removed.id}/comments`).set(bearer(omari.token)).send({ text: 'Too late?' }).expect(403);
    expect(c.body).toMatchObject({ code: 'comments_locked', details: { reason: 'The discussion became heated.' } });
    await request(http).post(`${api}/admin/stories/${removed.id}/comments-lock`).set(bearer(grace.token)).send({ on: false }).expect(200);
    await request(http).post(`${api}/stories/${removed.id}/comments`).set(bearer(omari.token)).send({ text: 'Nice market.' }).expect(201);
    await request(http).post(`${api}/admin/stories/${removed.id}/comments-hide`).set(bearer(grace.token)).send({ on: true, reason: 'Under review.' }).expect(200);
    expect((await request(http).get(`${api}/stories/${removed.id}/comments`).expect(200)).body).toMatchObject({ hidden: true, hiddenReason: 'Under review.', count: 1, items: [] });
    expect((await request(http).get(`${api}/stories/${removed.id}/comments`).set(bearer(grace.token)).expect(200)).body.items).toHaveLength(1);
  });
  it('takes reports, groups them, and warns, suspends or removes with the account holder kept informed', async () => {
    const target = (await post(baraka, { text: 'Buy my boat engine, best price in Kisumu.' })).body;
    expect((await request(http).post(`${api}/reports`).set(bearer(omari.token)).send({ targetType: 'story', targetId: target.id }).expect(400)).body.message).toBe('Pick at least one reason or describe the issue.');
    const rep = await request(http).post(`${api}/reports`).set(bearer(omari.token)).send({ targetType: 'story', targetId: target.id, reasons: ['spam'] }).expect(201);
    expect(rep.body.message).toBe('Report sent. You will receive a confirmation in INBOX.');
    await request(http).post(`${api}/reports`).set(bearer(atieno.token)).send({ targetType: 'story', targetId: target.id, description: 'This is an advert.' }).expect(201);
    expect((await request(http).get(`${api}/inbox`).set(bearer(omari.token)).expect(200)).body.conversations.some((c: any) => c.issueType === 'report' && c.lastMessage.system)).toBe(true);
    const queue = await request(http).get(`${api}/admin/reports`).set(bearer(grace.token)).expect(200);
    const group = queue.body.find((g: any) => g.targetId === target.id);
    expect(group).toMatchObject({ count: 2, target: { author: { username: 'baraka_test' } } });
    await request(http).post(`${api}/admin/reports/story/${target.id}/notes`).set(bearer(grace.token)).send({ note: 'Second advert this week.' }).expect(200);
    const drop = await request(http).post(`${api}/admin/reports/story/${target.id}/action`).set(bearer(grace.token)).send({ action: 'drop', reason: 'Advertising is not allowed.' }).expect(200);
    expect(drop.body.message).toBe('Story dropped. The Contributor has been notified.');
    expect((await request(http).get(`${api}/admin/reports`).set(bearer(grace.token)).expect(200)).body.some((g: any) => g.targetId === target.id)).toBe(false);
    expect((await request(http).post(`${api}/admin/accounts/${baraka.id}/action`).set(bearer(grace.token)).send({ action: 'warn', reason: 'Please do not advertise.' }).expect(200)).body.message).toBe('Warning sent to @baraka_test.');
    expect((await request(http).get(`${api}/auth/me`).set(bearer(baraka.token)).expect(200)).body).toMatchObject({ status: 'warned', warnings: 1 });
    expect((await request(http).post(`${api}/admin/accounts/${baraka.id}/action`).set(bearer(grace.token)).send({ action: 'suspend', reason: 'Advertising again.', days: 7 }).expect(200)).body.message).toBe('Account suspended for 7 days. The account holder has been notified.');
    await request(http).get(`${api}/auth/me`).set(bearer(baraka.token)).expect(401);
    const signIn = await request(http).post(`${api}/auth/demo`).send({ name: 'baraka_test' }).expect(403);
    expect(signIn.body).toMatchObject({ code: 'account_suspended', message: expect.stringMatching(/^Your account is suspended until \d+ \w+ \d{4}\.$/), details: { reason: 'Advertising again.' } });
    await request(http).post(`${api}/auth/suspension/ask-why`).send({ token: signIn.body.details.askWhyToken, description: 'It was one advert.' }).expect(200);
    await db.q(`UPDATE users SET suspended_until = now() - interval '1 minute' WHERE id = $1`, [baraka.id]);
    baraka = await contributor('baraka_test');
    // Permanent deletion is a terminal action: proposed, approved by the other admins, then final.
    const del = await request(http).post(`${api}/admin/accounts/${baraka.id}/action`).set(bearer(grace.token)).send({ action: 'delete', reason: 'Repeated advertising after a suspension.' }).expect(200);
    expect(del.body.message).toBe('Deletion proposed. It takes effect when the approval rule is met.');
    await request(http).get(`${api}/auth/me`).set(bearer(baraka.token)).expect(200);
    expect((await request(http).get(`${api}/me/notifications?priority=true`).set(bearer(baraka.token)).expect(200)).body.items.some((n: any) => n.kind === 'account.review')).toBe(true);
    const lucy = await team('lucy@demo.ke', 'Ziwa-Victoria-77');
    for (const a of [peter, amina, lucy]) await request(http).post(`${api}/admin/approvals/${del.body.approval.id}/vote`).set(bearer(a.token)).send({ vote: 'approve', justification: 'Agreed.' });
    await request(http).get(`${api}/auth/me`).set(bearer(baraka.token)).expect(401);
    expect((await request(http).post(`${api}/auth/demo`).send({ name: 'baraka_test' }).expect(403)).body.code).toBe('account_removed');
  });
  it('sends an overdue or changes-requested request the right way', async () => {
    const s = (await post(grace, { title: 'A notice from the team', text: 'Life jackets save lives. Wear one on every crossing.', postedAs: 'company' })).body;
    expect((await story(s.id, grace)).status).toBe('awaiting_approval');
    const col = await request(http).post(`${api}/admin/collections`).set(bearer(grace.token)).send({ title: 'Women of the Lake', description: 'Stories from women in the fishing communities.', items: [{ storyId: s.id }], submit: true, justification: 'Checked and credited.' }).expect(201);
    expect(col.body.message).toBe('Submitted for approval.');
    const open = (await request(http).get(`${api}/admin/approvals?status=open`).set(bearer(peter.token)).expect(200)).body;
    const colReq = open.find((a: any) => a.type === 'collection');
    await request(http).post(`${api}/admin/approvals/${colReq.id}/vote`).set(bearer(peter.token)).send({ vote: 'changes', justification: 'Add a cover image.' }).expect(200);
    expect((await request(http).get(`${api}/admin/approvals/${colReq.id}`).set(bearer(grace.token)).expect(200)).body.status).toBe('changes_requested');
    await request(http).post(`${api}/admin/approvals/${colReq.id}/resubmit`).set(bearer(grace.token)).send({ justification: 'Cover added.' }).expect(200);
    await db.q(`UPDATE approval_requests SET deadline = now() - interval '1 hour' WHERE id = $1`, [colReq.id]);
    await jobs.runRecurring('approvals.overdue');
    await request(http).post(`${api}/super/approvals/${colReq.id}/decide`).set(bearer(grace.token)).send({ approve: true, justification: 'x y z' }).expect(403);
    await request(http).post(`${api}/super/approvals/${colReq.id}/decide`).set(bearer(boss.token)).send({ approve: true, justification: 'Decided after the deadline.' }).expect(200);
    expect((await request(http).get(`${api}/collections`).expect(200)).body.some((c: any) => c.title === 'Women of the Lake')).toBe(true);
  });
});

describe('incidents, import, resources, safety concerns and announcements', () => {
  it('creates incident records, links stories, takes suggestions and suggests matches', async () => {
    const place = (await request(http).get(`${api}/places?q=mbita`)).body[0];
    const inc = await request(http).post(`${api}/admin/incidents`).set(bearer(grace.token)).send({ title: 'MV Rusinga grounding', eventDate: '2005-03-10', placeId: place.id, vessel: 'MV Rusinga', incidentType: 'Grounding', summary: 'The ferry ran aground in low water.', outcome: 'No lives lost.', sources: 'Daily press, March 2005.' }).expect(201);
    expect(inc.body).toMatchObject({ code: expect.stringMatching(/^INC-\d{4}$/), waterBody: 'Lake Victoria', message: 'Incident record saved.' });
    await request(http).post(`${api}/admin/incidents`).set(bearer(omari.token)).send({ title: 'nope nope' }).expect(403);
    const match = await request(http).post(`${api}/incidents/match`).set(bearer(omari.token)).send({ text: 'I was aboard the MV Rusinga when it stuck near Mbita in 2005.' }).expect(200);
    expect(match.body[0].id).toBe(inc.body.id);
    const st = await post(omari, { text: 'I was aboard the MV Rusinga when it stuck near Mbita.', incidentId: inc.body.id, suggestIncident: { title: 'Dunga canoe capsizing, 2010', details: 'Three fishermen were rescued.' } });
    expect((await story(st.body.id)).incident).toMatchObject({ code: inc.body.code });
    expect((await request(http).get(`${api}/incidents/${inc.body.id}`).expect(200)).body.linked).toHaveLength(1);
    expect((await request(http).get(`${api}/stories?incidentId=${inc.body.id}`).expect(200)).body.items).toHaveLength(1);
    const suggested = await request(http).get(`${api}/incidents?status=suggested`).set(bearer(grace.token)).expect(200);
    expect(suggested.body[0].title).toBe('Dunga canoe capsizing, 2010');
    expect((await request(http).get(`${api}/incidents?status=suggested`).expect(200)).body.every((i: any) => i.status === 'published')).toBe(true);
  });
  it('checks a metadata spreadsheet row by row, then imports the batch after approval', async () => {
    const tpl = await request(http).get(`${api}/admin/import/template`).set(bearer(grace.token)).expect(200);
    expect(tpl.text).toMatch(/title,type,text,date/);
    await request(http).post(`${api}/media`).set(bearer(grace.token)).field('purpose', 'import').attach('file', PNG, 'usenge-notice.png').expect(201);
    await request(http).post(`${api}/media`).set(bearer(grace.token)).field('purpose', 'consent').attach('file', Buffer.from('%PDF-1.4 consent'), 'consent-achieng.pdf').expect(201);
    const csv = ['title,type,text,date,place,incident,language,storyteller,anonymous,consent_type,consent_form,validated,files,source_institution,source_reference,rights',
      '"The night the wind turned",testimony,"We were four in the boat when the wind turned, near Usenge.",1999,Usenge,,luo,Achieng Odhiambo,no,Signed form,consent-achieng.pdf,yes,,,,CC BY-NC 4.0',
      '"Beach safety notice",record,"Notice posted by the beach management unit.",2012-05-01,Usenge,,en,,,,,,usenge-notice.png,Usenge BMU,BMU/2012/14,All rights reserved',
      '"Not yet validated",testimony,"A story still to be confirmed.",2001,Kisumu,,en,Otieno,no,Signed form,,no,,,,',
      '"Unknown place",record,"A record from somewhere.",2001,Atlantis,No such incident,en,,,,,,missing.jpg,,,'].join('\n');
    const check = await request(http).post(`${api}/admin/import`).set(bearer(grace.token)).attach('spreadsheet', Buffer.from(csv), 'batch1.csv').expect(201);
    expect(check.body).toMatchObject({ ready: 2, needAttention: 2, message: '2 of 4 items are ready. 2 need attention.' });
    expect(check.body.rows[2].problems).toEqual(['Not yet validated with the storyteller.']);
    expect(check.body.rows[3].problems.length).toBeGreaterThanOrEqual(4);
    const sub = await request(http).post(`${api}/admin/import/${check.body.id}/submit`).set(bearer(grace.token)).send({}).expect(200);
    expect(sub.body.message).toBe('Batch submitted for approval.');
    const req = (await request(http).get(`${api}/admin/approvals?status=open`).set(bearer(peter.token)).expect(200)).body.find((a: any) => a.type === 'import_batch');
    const lucy = await team('lucy@demo.ke', 'Ziwa-Victoria-77');
    for (const a of [peter, amina, lucy]) await request(http).post(`${api}/admin/approvals/${req.id}/vote`).set(bearer(a.token)).send({ vote: 'approve', justification: 'Checked.' });
    await jobs.idle();
    expect((await request(http).get(`${api}/admin/import/${check.body.id}`).set(bearer(grace.token)).expect(200)).body).toMatchObject({ status: 'approved', itemsCreated: 2 });
    const t = (await request(http).get(`${api}/stories?q=wind turned&tab=recent`).expect(200)).body.items[0];
    expect(t).toMatchObject({ type: 'testimony', consentLabel: 'Shared with consent', toldBy: 'Achieng Odhiambo', language: 'luo', place: { name: 'Usenge', county: 'Siaya' } });
    const rec = (await request(http).get(`${api}/stories?type=record&q=Beach safety notice&tab=recent`).expect(200)).body.items[0];
    expect(rec).toMatchObject({ typeLabel: 'Historical record', source: { institution: 'Usenge BMU', reference: 'BMU/2012/14' }, author: { name: 'Admin', avatar: 'logo' } });
    expect(rec.media).toHaveLength(1);
  });
  it('records validation and consent withdrawal for testimonies, and safety correction notes', async () => {
    const t = (await post(grace, { type: 'testimony', title: 'My father’s boat', text: 'He built it at Dunga in 1975.', postedAs: 'told_by', toldBy: 'Mzee Okello', consentConfirmed: true })).body;
    expect((await story(t.id, grace)).status).toBe('awaiting_validation');
    await request(http).get(`${api}/stories/${t.id}`).expect(404);
    await request(http).post(`${api}/admin/stories/${t.id}/validate`).set(bearer(grace.token)).send({ storyteller: 'Mzee Okello', consentType: 'Signed form', consentDate: '2026-11-01', restrictions: { noDownloads: true } }).expect(200);
    expect(await story(t.id)).toMatchObject({ status: 'published', consentLabel: 'Shared with consent', allowDownload: false });
    await request(http).post(`${api}/admin/stories/${t.id}/correction`).set(bearer(grace.token)).send({ note: 'Always wear a life jacket, whatever the distance.', link: 'https://kma.go.ke/' }).expect(200);
    expect((await story(t.id)).correction).toMatchObject({ note: 'Always wear a life jacket, whatever the distance.' });
    await request(http).post(`${api}/admin/stories/${t.id}/withdraw-consent`).set(bearer(grace.token)).send({ reason: 'The family asked for it to be taken down.' }).expect(200);
    await request(http).get(`${api}/stories/${t.id}`).expect(404);
    const csv = await request(http).get(`${api}/incidents/export.csv`).expect(200);
    expect(csv.text).toMatch(/code,title,eventDate/); expect(csv.text).toMatch(/Mtongwe ferry disaster,1994-04-29/);
    expect((await request(http).get(`${api}/stories/${(await request(http).get(`${api}/stories?limit=1`)).body.items[0].id}/cite`).expect(200)).body.dublinCore['dc:identifier']).toMatch(/^MS-/);
    await request(http).post(`${api}/admin/export/archive`).set(bearer(boss.token)).send({ includeMedia: true }).expect(202);
    await jobs.idle();
    expect((await request(http).get(`${api}/admin/export/archive`).set(bearer(boss.token)).expect(200)).body[0]).toMatchObject({ status: 'ready' });
  });
  it('reads .xlsx spreadsheets too', async () => {
    const { parseXlsx, toDate } = await import('../src/common/spreadsheet');
    const { ZipWriter } = await import('../src/common/zip');
    const { readFileSync } = await import('fs');
    const path = join(storageDir, 't.xlsx');
    const z = new ZipWriter(path);
    await z.add('xl/sharedStrings.xml', Buffer.from('<sst><si><t>title</t></si><si><t>date</t></si><si><t>Mama &amp; the boat</t></si></sst>'));
    await z.add('xl/worksheets/sheet1.xml', Buffer.from('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>36526</v></c></row></sheetData></worksheet>'));
    await z.close();
    const rows = parseXlsx(readFileSync(path));
    expect(rows).toEqual([['title', 'date'], ['Mama & the boat', '36526']]);
    expect(toDate('36526')).toBe('2000-01-01'); expect(toDate('1994')).toBe('1994-01-01'); expect(toDate('29/04/1994')).toBe('1994-04-29'); expect(toDate('soon')).toBeNull();
  });
  it('publishes learning resources and counts views and downloads', async () => {
    const file = await request(http).post(`${api}/media`).set(bearer(grace.token)).field('purpose', 'resource').attach('file', Buffer.from('%PDF-1.4 brief'), 'brief.pdf').expect(201);
    const r = await request(http).post(`${api}/admin/resources`).set(bearer(grace.token)).send({ title: 'Policy brief: ferry safety', type: 'policy_brief', summary: 'Four recommendations.', audience: 'Policymakers', language: 'en', mediaId: file.body.id }).expect(201);
    expect(r.body.message).toBe('Resource published.');
    expect((await request(http).get(`${api}/resources?type=policy_brief&audience=Policymakers`).expect(200)).body).toHaveLength(1);
    const dl = await request(http).post(`${api}/resources/${r.body.id}/download`).expect(200);
    await request(http).get(dl.body.url.replace('http://localhost:4000', '')).expect(200).expect('content-disposition', /attachment/);
    expect((await request(http).get(`${api}/resources/${r.body.slug}`).expect(200)).body).toMatchObject({ downloads: 1, hasFile: true });
    await request(http).post(`${api}/media`).set(bearer(omari.token)).field('purpose', 'resource').attach('file', PNG, 'a.png').expect(403);
  });
  it('takes safety concerns from visitors, apart from content reports, and is clear it is not an emergency service', async () => {
    expect((await request(http).post(`${api}/safety-concerns`).send({ placeName: 'Likoni' }).expect(400)).body.message).toBe('Describe the concern before sending.');
    expect((await request(http).post(`${api}/safety-concerns`).send({ description: 'spam', website: 'http://bot.example' }).expect(400)).body.code).toBe('human_check_failed');
    const c = await request(http).post(`${api}/safety-concerns`).send({ placeName: 'Likoni', description: 'The evening boat to the island is overloaded and has no life jackets.' }).expect(201);
    expect(c.body).toMatchObject({ message: 'Thank you. Your safety concern has been sent to the project team.', notice: 'This is not an emergency service. In an emergency, call 999 or 112.', emergencyNumbers: ['999', '112'] });
    const mine = await request(http).post(`${api}/safety-concerns`).set(bearer(omari.token)).send({ placeName: 'Mbita', description: 'Missing life jackets on the water bus.' }).expect(201);
    const q = await request(http).get(`${api}/admin/safety-concerns?status=new`).set(bearer(grace.token)).expect(200);
    expect(q.body).toHaveLength(2);
    await request(http).get(`${api}/admin/safety-concerns`).set(bearer(omari.token)).expect(403);
    const id = q.body.find((x: any) => x.code === mine.body.code).id;
    const up = await request(http).patch(`${api}/admin/safety-concerns/${id}`).set(bearer(grace.token)).send({ status: 'acknowledged', note: 'Called the beach management unit.', referral: 'Referred to the county maritime office.' }).expect(200);
    expect(up.body.message).toBe('Concern acknowledged. The sender has been notified.');
    expect((await request(http).get(`${api}/admin/safety-concerns?status=referred`).set(bearer(grace.token)).expect(200)).body[0]).toMatchObject({ referral: 'Referred to the county maritime office.' });
    expect((await request(http).post(`${api}/feedback`).send({ text: 'Please add Giriama.' }).expect(201)).body.message).toBe('Thank you for your feedback.');
  });
  it('orders announcements by last change and counts unread ones', async () => {
    const before = (await request(http).get(`${api}/me/notifications`).set(bearer(omari.token)).expect(200)).body.counts.announcements;
    const a = await request(http).post(`${api}/admin/announcements`).set(bearer(grace.token)).send({ title: 'Heritage Week', summary: 'Share your ferry stories.', description: 'A week of stories.', dates: [{ date: '2026-12-01', endDate: '2026-12-07', label: 'Heritage Week' }], sendPush: true }).expect(201);
    expect(a.body.message).toBe('Announcement published.');
    expect((await request(http).get(`${api}/me/notifications`).set(bearer(omari.token)).expect(200)).body.counts.announcements).toBe(before + 1);
    expect((await request(http).post(`${api}/announcements/${a.body.id}/read`).set(bearer(omari.token)).expect(200)).body.announcements).toBe(before);
    const first = (await request(http).get(`${api}/announcements`).set(bearer(omari.token)).expect(200)).body;
    expect(first[0]).toMatchObject({ id: a.body.id, unread: false, edited: false });
    await request(http).patch(`${api}/admin/announcements/${first[1].id}`).set(bearer(grace.token)).send({ title: 'Welcome (updated)', summary: 'New dates.' }).expect(200);
    const after = (await request(http).get(`${api}/announcements`).set(bearer(omari.token)).expect(200)).body;
    expect(after[0]).toMatchObject({ id: first[1].id, edited: true, unread: true });
  });
});

describe('profile, data and deletion', () => {
  it('saves settings, reminders and notification choices', async () => {
    const s = await request(http).patch(`${api}/me/settings`).set(bearer(omari.token)).send({ theme: 'dark', highContrast: true, textSize: 'large', lowData: true, readReceipts: false, quietHours: { from: '22:00', to: '06:00' }, notifications: { engagement: { push: false } } }).expect(200);
    expect(s.body.user).toMatchObject({ theme: 'dark', settings: { highContrast: true, lowData: true, notifications: { engagement: { inApp: true, push: false }, messages: { push: true } } } });
    const r = await request(http).post(`${api}/me/reminders`).set(bearer(omari.token)).send({ subject: 'Record Mzee Ali', dueAt: new Date(Date.now() - 1000).toISOString() }).expect(201);
    expect(r.body.message).toBe('Reminder saved.');
    await jobs.runRecurring('reminders.due');
    expect((await request(http).get(`${api}/me/notifications?priority=true`).set(bearer(omari.token)).expect(200)).body.items.some((n: any) => n.kind === 'reminder.due')).toBe(true);
    await request(http).put(`${api}/me/reminders/${r.body.id}/done`).set(bearer(omari.token)).send({ on: true }).expect(200);
    expect((await request(http).get(`${api}/me/notifications?priority=true`).set(bearer(omari.token)).expect(200)).body.items.some((n: any) => n.kind === 'reminder.due')).toBe(false);
    await request(http).post(`${api}/me/push-tokens`).set(bearer(omari.token)).send({ platform: 'android', token: 'fcm-token-1' }).expect(200);
  });
  it('prepares ZIP downloads of a story and of all my data', async () => {
    const s = (await request(http).get(`${api}/stories?authorId=${omari.id}`)).body.items.find((x: any) => x.title === 'The evening ferry');
    const z = await request(http).post(`${api}/stories/${s.id}/download`).expect(202);
    await jobs.idle();
    const ready = await request(http).get(`${api}/stories/downloads/${z.body.exportId}`).expect(200);
    expect(ready.body).toMatchObject({ status: 'ready', message: 'Your download is ready.' });
    const file = await request(http).get(ready.body.url.replace('http://localhost:4000', '')).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); }).expect(200);
    expect((file.body as Buffer).subarray(0, 2).toString()).toBe('PK');
    expect((file.body as Buffer).includes(`${s.code}/story.txt`)).toBe(true);
    const no = (await post(atieno, { text: 'Please do not download this one.', allowDownload: false })).body;
    expect((await request(http).post(`${api}/stories/${no.id}/download`).expect(403)).body.code).toBe('download_not_allowed');
    await request(http).post(`${api}/me/export`).set(bearer(omari.token)).expect(202);
    await jobs.idle();
    expect((await request(http).get(`${api}/me/exports`).set(bearer(omari.token)).expect(200)).body[0]).toMatchObject({ status: 'ready', url: expect.stringContaining('/media/file/') });
  });
  it('deletes an account with a reason, hides its content at once, and restores it within 30 days', async () => {
    const p = await contributor('leaving_test');
    const s = (await post(p, { text: 'My one story before I go.' })).body;
    expect((await request(http).post(`${api}/me/delete`).set(bearer(p.token)).send({}).expect(400)).body.code).toBe('deletion_reason_required');
    expect((await request(http).post(`${api}/me/delete`).set(bearer(p.token)).send({ reason: 'privacy', otherReason: 'Moving away.' }).expect(200)).body.message).toMatch(/Sign in within 30 days/);
    await request(http).get(`${api}/stories/${s.id}`).expect(404);
    await request(http).get(`${api}/auth/me`).set(bearer(p.token)).expect(401);
    const back = await request(http).post(`${api}/auth/demo`).send({ name: 'leaving_test' }).expect(409);
    expect(back.body).toMatchObject({ code: 'account_deleted_restore', message: expect.stringMatching(/scheduled for permanent deletion on .* Do you want to restore it\?/) });
    const restored = await request(http).post(`${api}/auth/restore`).set('X-Client', 'app').send({ token: back.body.details.restoreToken }).expect(200);
    expect(restored.body.message).toBe('Welcome back! Your account has been restored.');
    expect((await story(s.id)).status).toBe('published');
    await request(http).post(`${api}/me/delete`).set(bearer(restored.body.accessToken)).send({ otherReason: 'Really going now.' }).expect(200);
    await db.q(`UPDATE users SET purge_at = now() - interval '1 minute' WHERE id = $1`, [p.id]);
    await db.q(`UPDATE stories SET purge_at = now() - interval '1 minute' WHERE author_id = $1`, [p.id]);
    await jobs.runRecurring('users.purge');
    expect(await db.one(`SELECT 1 AS x FROM users WHERE id = $1`, [p.id])).toBeNull();
    expect(await db.one(`SELECT 1 AS x FROM stories WHERE id = $1`, [s.id])).toBeNull();
  });
});

describe('analytics, PDF reports and the audit log', () => {
  it('reports the project measures and live chart series', async () => {
    await jobs.runRecurring('analytics.daily');
    const sum = await request(http).get(`${api}/admin/analytics/summary`).set(bearer(boss.token)).expect(200);
    expect(sum.body.publishedStories).toBeGreaterThan(10); expect(sum.body.testimonies).toBeGreaterThan(0); expect(sum.body.incidentsMapped).toBeGreaterThan(0);
    expect(sum.body.countyList).toEqual(expect.arrayContaining(['Mombasa', 'Siaya'])); expect(sum.body.safetyConcerns).toBe(2); expect(sum.body.monthlyActiveUsers).toBeGreaterThan(0);
    const flags = await request(http).get(`${api}/admin/analytics/series?chart=flags&period=week`).set(bearer(grace.token)).expect(200);
    expect(flags.body.series.map((s: any) => s.name)).toEqual(['GREEN', 'YELLOW', 'RED']);
    expect(flags.body.series[2].values.reduce((a: number, b: number) => a + b, 0)).toBeGreaterThan(0);
    for (const period of ['day', 'month', 'year']) expect((await request(http).get(`${api}/admin/analytics/series?chart=stories&period=${period}`).set(bearer(grace.token)).expect(200)).body.labels.length).toBeGreaterThan(0);
    await request(http).get(`${api}/admin/analytics/summary`).set(bearer(omari.token)).expect(403);
    // Super Admins see analytics and manage admins, but do not moderate, post or engage.
    await request(http).get(`${api}/admin/moderation`).set(bearer(boss.token)).expect(403);
    await request(http).post(`${api}/stories`).set(bearer(boss.token)).send({ text: 'A story from the Super Admin.' }).expect(403);
    const anyId = (await request(http).get(`${api}/stories?limit=1`)).body.items[0].id;
    await request(http).put(`${api}/stories/${anyId}/reaction`).set(bearer(boss.token)).send({ type: 'heart' }).expect(403);
    await request(http).get(`${api}/stories/${anyId}`).set(bearer(boss.token)).expect(200);
    expect((await request(http).get(`${api}/admin/analytics/ai`).set(bearer(boss.token)).expect(200)).body).toMatchObject({ provider: 'rules', thresholds: { yellowAbove: 20, redFrom: 70 } });
  });
  it('generates a PDF report in the background', async () => {
    const today = new Date().toISOString().slice(0, 10), from = new Date(Date.now() - 20 * 86400_000).toISOString().slice(0, 10);
    const r = await request(http).post(`${api}/admin/analytics/reports`).set(bearer(boss.token)).send({ from, to: today, charts: ['stories', 'flags'] }).expect(202);
    expect(r.body.message).toBe('Generating report…');
    await jobs.idle();
    const list = await request(http).get(`${api}/admin/analytics/reports`).set(bearer(boss.token)).expect(200);
    expect(list.body[0]).toMatchObject({ status: 'ready' });
    const pdf = await request(http).get(list.body[0].url.replace('http://localhost:4000', '')).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); }).expect(200);
    expect((pdf.body as Buffer).subarray(0, 8).toString()).toBe('%PDF-1.4');
    expect((pdf.body as Buffer).length).toBeGreaterThan(1500);
  });
  it('keeps a permanent audit log: admins see their own actions, Super Admins see all, and nobody can change it', async () => {
    const own = await request(http).get(`${api}/admin/audit-log`).set(bearer(grace.token)).expect(200);
    expect(own.body.items.length).toBeGreaterThan(5);
    expect(own.body.items.every((e: any) => e.actorId === grace.id)).toBe(true);
    const all = await request(http).get(`${api}/admin/audit-log?action=story.remove`).set(bearer(boss.token)).expect(200);
    expect(all.body.items[0]).toMatchObject({ action: 'story.remove', reason: expect.any(String), ip: expect.any(String) });
    await expect(db.q(`UPDATE activity_log SET summary = 'tampered' WHERE id = $1`, [all.body.items[0].id])).rejects.toThrow(/cannot be edited or deleted/);
    await expect(db.q(`DELETE FROM activity_log WHERE id = $1`, [all.body.items[0].id])).rejects.toThrow(/cannot be edited or deleted/);
    const log = JSON.stringify((await request(http).get(`${api}/admin/audit-log`).set(bearer(boss.token)).expect(200)).body);
    expect(log).not.toContain('admin1234'); expect(log).not.toContain('12345678');
  });
  it('answers every error in one shape, in the reader’s language', async () => {
    const r = await request(http).post(`${api}/stories`).set('X-Language', 'sw').send({ text: 'x' }).expect(401);
    expect(r.body).toMatchObject({ statusCode: 401, code: 'sign_in_required', message: expect.stringMatching(/^Ingia ili/) });
    const v = await request(http).post(`${api}/stories`).set(bearer(omari.token)).send({ text: 'x', surprise: true }).expect(400);
    expect(v.body).toMatchObject({ code: 'invalid_input', details: expect.arrayContaining([expect.stringMatching(/surprise/)]) });
    expect((await request(http).get(`${api}/stories/not-a-story`).expect(404)).body.code).toBe('not_found');
    const old = await request(http).get(`${api}/config`).set('X-App-Version', '1.4.0').expect(426);
    expect(old.body).toMatchObject({ code: 'app_update_required', message: 'A new version of the app is available. Please update to continue.' });
    await request(http).get(`${api}/config`).set('X-App-Version', '2.0.0').expect(200);
    expect((await request(http).get(`${api}/super/jobs`).set(bearer(boss.token)).expect(200)).body.failed).toBe(0);
  });
});
