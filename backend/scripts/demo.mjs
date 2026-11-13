// Runs the API and website with a private, temporary PostgreSQL (no installation needed).
// Data is kept in .demo-db between runs; delete that folder to start fresh.
// Usage: npm run build && npm run demo
import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, '.demo-db');
const secretsFile = join(dir, 'demo-secrets.json');
const port = Number(process.env.DEMO_DB_PORT || 55432);
const fresh = !existsSync(join(dir, 'data', 'PG_VERSION'));
mkdirSync(dir, { recursive: true });
if (!existsSync(secretsFile)) {
  const r = () => randomBytes(36).toString('base64url');
  writeFileSync(secretsFile, JSON.stringify({ db: r(), access: r(), refresh: r(), media: r() }));
}
const s = JSON.parse(readFileSync(secretsFile, 'utf8'));
const pg = new EmbeddedPostgres({ databaseDir: join(dir, 'data'), user: 'postgres', password: s.db, port, persistent: true, onLog: () => {} });

if (fresh) { console.log('Creating the demo database (first run takes a minute)...'); await pg.initialise(); }
await pg.start();
if (fresh) await pg.createDatabase('maritime_demo');

const env = {
  ...process.env, NODE_ENV: 'development', DB_HOST: 'localhost', DB_PORT: String(port), DB_USER: 'postgres', DB_PASSWORD: s.db, DB_NAME: 'maritime_demo',
  JWT_ACCESS_SECRET: s.access, JWT_REFRESH_SECRET: s.refresh, MEDIA_SIGNING_SECRET: s.media, STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: join(dir, 'storage'),
  SEED_ADMIN_EMAIL: 'admin@demo.ke', SEED_ADMIN_PASSWORD: 'admin1234', SEED_SAMPLE_DATA: 'true', PORT: process.env.PORT || '4000',
};
const run = (file) => new Promise((res, rej) => spawn(process.execPath, [join(root, 'dist', file)], { stdio: 'inherit', env }).on('exit', (c) => (c ? rej(new Error(file + ' failed')) : res())));
await run('database/migrate.js');
await run('database/seed.js');
const api = spawn(process.execPath, [join(root, 'dist', 'main.js')], { stdio: 'inherit', env });
const stop = async () => { api.kill(); await pg.stop().catch(() => {}); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
api.on('exit', async (c) => { await pg.stop().catch(() => {}); process.exit(c ?? 0); });
