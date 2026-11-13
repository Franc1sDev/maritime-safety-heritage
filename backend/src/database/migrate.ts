import { config } from '../config/config';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { AppDataSource } from './data-source';

/** Applies every SQL file in ./migrations that has not been applied yet, in name order, each in a transaction. */
export async function runMigrations(ds: DataSource, log = console.log): Promise<string[]> {
  await ds.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name varchar(200) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set<string>((await ds.query(`SELECT name FROM schema_migrations`)).map((r: { name: string }) => r.name));
  const dir = join(__dirname, 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(join(dir, file), 'utf8');
    await ds.transaction(async (m) => {
      await m.query(sql);
      await m.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file]);
    });
    log(`Applied ${file}`);
    applied.push(file);
  }
  if (!applied.length) log('Database is up to date.');
  return applied;
}

if (require.main === module) {
  AppDataSource.initialize()
    .then((ds) => runMigrations(ds).then(() => ds.destroy()))
    .catch((e) => {
      const parts = [e.message, e.code, ...(e.errors ?? []).map((x: Error & { code?: string }) => `${x.code ?? ''} ${x.message}`)].filter(Boolean);
      console.error(`Migration failed (database ${config.db.host}:${config.db.port}/${config.db.name}, ssl ${config.db.ssl}):`, parts.join(' | '));
      process.exit(1);
    });
}
