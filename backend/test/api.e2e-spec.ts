/**
 * End-to-end tests: a throwaway PostgreSQL server, the real migration and seed, and real HTTP requests.
 * Run with `npm test`.
 */
import { INestApplication } from '@nestjs/common';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';

// The database itself is started by test/run-e2e.mjs, which passes DB_PORT.
if (!process.env.DB_PORT) throw new Error('Run the tests with "npm test", which starts a temporary database.');
const storageDir = mkdtempSync(join(tmpdir(), 'msh-storage-'));
Object.assign(process.env, {
  NODE_ENV: 'test', DB_HOST: 'localhost', DB_USER: 'postgres',
  STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: storageDir, SEED_ADMIN_EMAIL: 'admin@demo.ke', SEED_ADMIN_PASSWORD: 'admin1234',
  SEED_SAMPLE_DATA: 'true', RATE_LIMIT_SCALE: '50', CORS_ORIGINS: 'http://localhost:5173', MAX_FAILED_LOGINS: '5',
});

let app: INestApplication;
let http: any;
let mail: { outbox: Map<string, { subject: string; text: string }> };

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

async function login(email: string, password: string, app = true) {
  const r = await request(http).post('/api/v1/auth/login').set(app ? { 'X-Client': 'app' } : {}).send({ email, password });
  return r;
}
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

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
  const { MailService } = await import('../src/common/mail.service');
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication({ bodyParser: false });
  configureApp(app);
  await app.init();
  http = app.getHttpServer();
  mail = mod.get(MailService);
});

afterAll(async () => {
  await app?.close();
  rmSync(storageDir, { recursive: true, force: true });
});

describe('basics and security headers', () => {
  it('serves the website from the same address, with a strict content security policy', async () => {
    const r = await request(http).get('/').expect(200);
    expect(r.text).toContain('Maritime Safety Heritage Archive');
    expect(r.headers['content-security-policy']).toMatch(/script-src 'self'/);
    expect(r.headers['x-frame-options']).toBe('SAMEORIGIN');
    await request(http).get('/assets/app.js').expect(200);
  });

  it('reports health without signing in', async () => {
    const r = await request(http).get('/api/v1/health').expect(200);
    expect(r.body.database).toBe('ok');
    expect(r.headers['x-powered-by']).toBeUndefined();
    expect(r.headers['content-security-policy']).toBeDefined();
  });

  it('requires sign-in to read the archive', async () => {
    await request(http).get('/api/v1/records').expect(401);
    await request(http).get('/api/v1/vocab').expect(401);
    await request(http).get('/api/v1/records').set(bearer('not-a-token')).expect(401);
  });

  it('only allows listed web origins', async () => {
    const ok = await request(http).options('/api/v1/auth/login').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'POST');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const bad = await request(http).options('/api/v1/auth/login').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects unexpected fields', async () => {
    const r = await request(http).post('/api/v1/auth/login').send({ email: 'admin@demo.ke', password: 'x', role: 'admin' }).expect(400);
    expect(JSON.stringify(r.body.message)).toContain('role');
  });
});

describe('accounts', () => {
  it('signs in and never returns the password hash', async () => {
    const r = await login('researcher@demo.ke', 'demo1234');
    expect(r.status).toBe(200);
    expect(r.body.accessToken).toBeTruthy();
    expect(r.body.refreshToken).toBeTruthy();
    expect(JSON.stringify(r.body)).not.toMatch(/scrypt|passwordHash/);
    const me = await request(http).get('/api/v1/auth/me').set(bearer(r.body.accessToken)).expect(200);
    expect(me.body.role).toBe('user');
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const a = await login('researcher@demo.ke', 'wrong-pass1');
    const b = await login('nobody@demo.ke', 'wrong-pass1');
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('locks an account after 5 failed attempts', async () => {
    await request(http).post('/api/v1/auth/register').send({ name: 'Lock Test', email: 'lock@test.ke', password: 'lockme123' }).expect(201);
    for (let i = 0; i < 5; i++) expect((await login('lock@test.ke', 'nope12345')).status).toBe(401);
    const r = await login('lock@test.ke', 'lockme123');
    expect(r.status).toBe(429);
    expect(r.body.message).toMatch(/Try again in/);
  });

  it('enforces the password rule on registration', async () => {
    await request(http).post('/api/v1/auth/register').send({ name: 'Weak', email: 'weak@test.ke', password: 'short' }).expect(400);
    await request(http).post('/api/v1/auth/register').send({ name: 'Dup', email: 'researcher@demo.ke', password: 'longenough1' }).expect(409);
  });

  it('rotates refresh tokens and ends every session when an old one is reused', async () => {
    const first = (await login('researcher@demo.ke', 'demo1234')).body;
    const second = await request(http).post('/api/v1/auth/refresh').set('X-Client', 'app').send({ refreshToken: first.refreshToken }).expect(200);
    expect(second.body.refreshToken).not.toBe(first.refreshToken);
    await request(http).post('/api/v1/auth/refresh').set('X-Client', 'app').send({ refreshToken: first.refreshToken }).expect(401);
    // the reuse ended the newer session too
    await request(http).post('/api/v1/auth/refresh').set('X-Client', 'app').send({ refreshToken: second.body.refreshToken }).expect(401);
  });

  it('uses an httpOnly cookie for the website and needs the custom header to refresh', async () => {
    const r = await login('researcher@demo.ke', 'demo1234', false);
    expect(r.body.refreshToken).toBeUndefined();
    const cookie = r.headers['set-cookie'][0] as string;
    expect(cookie).toMatch(/msh_refresh=.+HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    const pair = cookie.split(';')[0];
    await request(http).post('/api/v1/auth/refresh').set('Cookie', pair).send({}).expect(401);
    await request(http).post('/api/v1/auth/refresh').set('Cookie', pair).set('X-Requested-With', 'XMLHttpRequest').send({}).expect(200);
  });

  it('resets a forgotten password with the emailed link, once', async () => {
    await request(http).post('/api/v1/auth/forgot-password').send({ email: 'unknown@test.ke' }).expect(202);
    await request(http).post('/api/v1/auth/forgot-password').send({ email: 'researcher@demo.ke' }).expect(202);
    const token = /token=([\w-]+)/.exec(mail.outbox.get('researcher@demo.ke')!.text)![1];
    await request(http).post('/api/v1/auth/reset-password').send({ token, password: 'newpass123' }).expect(204);
    await request(http).post('/api/v1/auth/reset-password').send({ token, password: 'again12345' }).expect(401);
    expect((await login('researcher@demo.ke', 'newpass123')).status).toBe(200);
    // put the demo password back for the other tests
    const t = (await login('researcher@demo.ke', 'newpass123')).body.accessToken;
    await request(http).post('/api/v1/auth/change-password').set(bearer(t)).send({ currentPassword: 'newpass123', newPassword: 'demo1234' }).expect(204);
  });
});

describe('archive', () => {
  let user: string, admin: string;
  beforeAll(async () => {
    user = (await login('researcher@demo.ke', 'demo1234')).body.accessToken;
    admin = (await login('admin@demo.ke', 'admin1234')).body.accessToken;
  });

  it('lists vocabularies', async () => {
    const r = await request(http).get('/api/v1/vocab').set(bearer(user)).expect(200);
    expect(r.body.waterBodies.map((w: { name: string }) => w.name)).toContain('Lake Victoria');
    expect(r.body.subjects.length).toBeGreaterThan(10);
  });

  it('finds items by full-text search, including words in transcripts', async () => {
    const r = await request(http).get('/api/v1/records').query({ q: 'life jackets' }).set(bearer(user)).expect(200);
    expect(r.body.items.slice(0, 3).map((i: { identifier: string }) => i.identifier)).toContain('MSH-0001');
    expect(r.body.items[0].snippet).toContain('⟦');
    const t = await request(http).get('/api/v1/records').query({ q: 'ramp' }).set(bearer(user)).expect(200);
    expect(t.body.items.map((i: { identifier: string }) => i.identifier)).toContain('MSH-0001');
    const none = await request(http).get('/api/v1/records').query({ q: "'); DROP TABLE records; --" }).set(bearer(user)).expect(200);
    expect(none.body.total).toBe(0);
  });

  it('filters and pages', async () => {
    const r = await request(http).get('/api/v1/records').query({ type: 'oral,photo', pageSize: 2, sort: 'oldest' }).set(bearer(user)).expect(200);
    expect(r.body.items.length).toBeLessThanOrEqual(2);
    expect(r.body.items.every((i: { type: string }) => ['oral', 'photo'].includes(i.type))).toBe(true);
    await request(http).get('/api/v1/records').query({ pageSize: 1000 }).set(bearer(user)).expect(400);
  });

  it('opens an item by identifier with transcript and citation, and counts the view', async () => {
    const r = await request(http).get('/api/v1/records/MSH-0001').set(bearer(user)).expect(200);
    expect(r.body.transcript.length).toBeGreaterThan(3);
    expect(r.body.citation).toContain('MSH-0001');
    const again = await request(http).get('/api/v1/records/MSH-0001').set(bearer(user)).expect(200);
    expect(again.body.views).toBe(r.body.views + 1);
  });

  it('offers search filters and related items', async () => {
    const f = await request(http).get('/api/v1/records/facets').set(bearer(user)).expect(200);
    expect(f.body.counties.map((c: { value: string }) => c.value)).toContain('Mombasa');
    expect(f.body.decades.length).toBeGreaterThan(2);
    const r = await request(http).get('/api/v1/records/MSH-0001').set(bearer(user)).expect(200);
    expect(r.body.related.length).toBeGreaterThan(0);
    expect(r.body.related.map((x: { identifier: string }) => x.identifier)).not.toContain('MSH-0001');
  });

  it('does not count views by admins', async () => {
    const admin2 = (await login('admin@demo.ke', 'admin1234')).body.accessToken;
    const a = await request(http).get('/api/v1/records/MSH-0002').set(bearer(admin2)).expect(200);
    const b = await request(http).get('/api/v1/records/MSH-0002').set(bearer(admin2)).expect(200);
    expect(b.body.views).toBe(a.body.views);
  });

  it('returns map points', async () => {
    const r = await request(http).get('/api/v1/records/map').set(bearer(user)).expect(200);
    expect(r.body.length).toBeGreaterThan(5);
    expect(typeof r.body[0].latitude).toBe('number');
  });

  it('stops normal users from changing the archive', async () => {
    await request(http).post('/api/v1/records').set(bearer(user)).send({ type: 'oral', format: 'audio', title: 'Nope' }).expect(403);
    await request(http).get('/api/v1/users').set(bearer(user)).expect(403);
    await request(http).get('/api/v1/reports/summary').set(bearer(user)).expect(403);
  });

  it('lets an admin catalogue, publish, unpublish, delete and restore an item', async () => {
    const created = await request(http).post('/api/v1/records').set(bearer(admin)).send({
      type: 'oral', format: 'audio', title: 'Test interview about boat lamps', subjects: ['lamps', 'Night fishing'], waterBodyId: 2,
      transcript: [{ startSeconds: 0, text: 'We always carried a paraffin lamp.' }],
    }).expect(201);
    const id = created.body.id;
    expect(created.body.identifier).toMatch(/^MSH-\d{4}$/);
    expect(created.body.status).toBe('draft');
    await request(http).get(`/api/v1/records/${id}`).set(bearer(user)).expect(404);

    const blocked = await request(http).post(`/api/v1/records/${id}/publish`).set(bearer(admin)).expect(400);
    expect(blocked.body.message).toMatch(/summary/);
    await request(http).patch(`/api/v1/records/${id}`).set(bearer(admin))
      .send({ summary: 'A test interview.', rights: 'CC BY-NC 4.0', consent: 'Signed form' }).expect(200);
    await request(http).post(`/api/v1/records/${id}/publish`).set(bearer(admin)).expect(200);

    const found = await request(http).get('/api/v1/records').query({ q: 'paraffin' }).set(bearer(user)).expect(200);
    expect(found.body.items.map((i: { id: string }) => i.id)).toContain(id);

    await request(http).post(`/api/v1/records/${id}/unpublish`).set(bearer(admin)).expect(200);
    await request(http).get(`/api/v1/records/${id}`).set(bearer(user)).expect(404);
    await request(http).delete(`/api/v1/records/${id}`).set(bearer(admin)).expect(204);
    const del = await request(http).get('/api/v1/records/deleted').set(bearer(admin)).expect(200);
    expect(del.body.map((d: { id: string }) => d.id)).toContain(id);
    await request(http).post(`/api/v1/records/${id}/restore`).set(bearer(admin)).expect(200);
  });
});

describe('submissions and media', () => {
  let user: string, admin: string, subId: string;
  beforeAll(async () => {
    user = (await login('researcher@demo.ke', 'demo1234')).body.accessToken;
    admin = (await login('admin@demo.ke', 'admin1234')).body.accessToken;
  });

  it('rejects files that are not what they claim to be', async () => {
    const r = await request(http).post('/api/v1/submissions').set(bearer(user))
      .field('type', 'photo').field('title', 'Fake image').field('description', 'This is not really an image.').field('consentConfirmed', 'true')
      .attach('files', Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00'), { filename: 'photo.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/not a supported file/);
  });

  it('requires consent', async () => {
    await request(http).post('/api/v1/submissions').set(bearer(user))
      .field('type', 'photo').field('title', 'No consent').field('description', 'Missing the consent tick box.').expect(400);
  });

  it('accepts a story with a photo and shows it under My submissions', async () => {
    const r = await request(http).post('/api/v1/submissions').set(bearer(user))
      .field('type', 'photo').field('title', 'Grandfather at Kisumu pier').field('description', 'A photograph of my grandfather on the pier in 1968.')
      .field('year', '1968').field('waterBodyId', '2').field('consentConfirmed', 'true')
      .attach('files', PNG, { filename: '../../etc/passwd.png', contentType: 'image/png' })
      .expect(201);
    subId = r.body.id;
    expect(r.body.reference).toMatch(/^SUB-\d{4}$/);
    expect(r.body.files[0].mimeType).toBe('image/png');
    expect(r.body.files[0].originalName).not.toContain('/');
    const mine = await request(http).get('/api/v1/submissions/mine').set(bearer(user)).expect(200);
    expect(mine.body.items.map((s: { id: string }) => s.id)).toContain(subId);
  });

  it('serves files only through valid, unexpired signed links, with byte ranges', async () => {
    const sub = await request(http).get(`/api/v1/submissions/${subId}`).set(bearer(user)).expect(200);
    const url: string = sub.body.files[0].url;
    const full = await request(http).get(url).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); }).expect(200);
    expect(Buffer.compare(full.body, PNG)).toBe(0);
    expect(full.headers['x-content-type-options']).toBe('nosniff');
    const part = await request(http).get(url).set('Range', 'bytes=0-7').expect(206);
    expect(part.headers['content-range']).toBe(`bytes 0-7/${PNG.length}`);
    await request(http).get(url.replace(/sig=[^&]+/, 'sig=forged')).expect(403);
    await request(http).get(url.replace(/exp=\d+/, 'exp=1000')).expect(403);
  });

  it('keeps other people out of a submission', async () => {
    const other = await request(http).post('/api/v1/auth/register').set('X-Client', 'app').send({ name: 'Other', email: 'other@test.ke', password: 'otherpass1' }).expect(201);
    await request(http).get(`/api/v1/submissions/${subId}`).set(bearer(other.body.accessToken)).expect(404);
  });

  it('lets an admin approve it into a draft record with the file attached', async () => {
    const queue = await request(http).get('/api/v1/submissions').query({ status: 'pending' }).set(bearer(admin)).expect(200);
    expect(queue.body.items[0].submittedBy.email).toBeTruthy();
    const r = await request(http).post(`/api/v1/submissions/${subId}/approve`).set(bearer(admin)).send({ reviewNote: 'Thank you' }).expect(200);
    expect(r.body.submission.status).toBe('approved');
    const rec = await request(http).get(`/api/v1/records/${r.body.recordId}`).set(bearer(admin)).expect(200);
    expect(rec.body.status).toBe('draft');
    expect(rec.body.format).toBe('image');
    expect(rec.body.media.length).toBe(1);
    expect(mail.outbox.get('researcher@demo.ke')!.subject).toMatch(/accepted/);
    await request(http).post(`/api/v1/submissions/${subId}/approve`).set(bearer(admin)).send({}).expect(409);
  });

  it('lets an admin upload a file to a record and delete it', async () => {
    const list = await request(http).get('/api/v1/records').set(bearer(admin)).expect(200);
    const id = list.body.items[0].id;
    const up = await request(http).post(`/api/v1/records/${id}/media`).set(bearer(admin)).attach('file', Buffer.from('%PDF-1.4\n%test\n'), 'scan.pdf').expect(201);
    expect(up.body.mimeType).toBe('application/pdf');
    expect(up.body.sha256).toHaveLength(64);
    await request(http).delete(`/api/v1/media/${up.body.id}`).set(bearer(admin)).expect(204);
  });
});

describe('messages, users and reports', () => {
  let admin: string;
  beforeAll(async () => { admin = (await login('admin@demo.ke', 'admin1234')).body.accessToken; });

  it('takes contact messages without sign-in and drops spam', async () => {
    await request(http).post('/api/v1/messages').send({ name: 'Teacher', email: 'teacher@school.ke', subject: 'Lessons', body: 'Can we use this in class?' }).expect(202);
    await request(http).post('/api/v1/messages').send({ name: 'Bot', email: 'bot@spam.ke', subject: 'Buy', body: 'Cheap things here now', website: 'http://spam' }).expect(202);
    const r = await request(http).get('/api/v1/messages').set(bearer(admin)).expect(200);
    const subjects = r.body.items.map((m: { subject: string }) => m.subject);
    expect(subjects).toContain('Lessons');
    expect(subjects).not.toContain('Buy');
  });

  it('creates accounts with a one-time password, suspends them, and protects the last admin', async () => {
    const c = await request(http).post('/api/v1/users').set(bearer(admin)).send({ name: 'New Staff', email: 'staff@test.ke', role: 'user' }).expect(201);
    expect(c.body.temporaryPassword).toBeTruthy();
    expect((await login('staff@test.ke', c.body.temporaryPassword)).status).toBe(200);
    await request(http).patch(`/api/v1/users/${c.body.user.id}`).set(bearer(admin)).send({ status: 'suspended' }).expect(200);
    expect((await login('staff@test.ke', c.body.temporaryPassword)).status).toBe(403);
    const me = await request(http).get('/api/v1/auth/me').set(bearer(admin)).expect(200);
    await request(http).patch(`/api/v1/users/${me.body.id}`).set(bearer(admin)).send({ role: 'user' }).expect(400);
  });

  it('shows dashboard figures, the audit log and CSV exports', async () => {
    const s = await request(http).get('/api/v1/reports/summary').set(bearer(admin)).expect(200);
    expect(s.body.totals.published).toBeGreaterThan(5);
    expect(s.body.viewsByMonth).toHaveLength(12);
    const a = await request(http).get('/api/v1/reports/activity').query({ action: 'login' }).set(bearer(admin)).expect(200);
    expect(a.body.items.length).toBeGreaterThan(0);
    const csv = await request(http).get('/api/v1/reports/export').query({ kind: 'records' }).set(bearer(admin)).expect(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('MSH-0001');
  });
});
