// Starts a throwaway PostgreSQL server (embedded-postgres, no installation needed), runs the Jest suite against it, then removes it.
import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = 15432 + Math.floor(Math.random() * 1000);
// The folder must not exist yet: the database creates it with the right owner (this matters when the tests run as root, as in CI containers).
const dir = join(tmpdir(), `msh-pg-${process.pid}-${Date.now()}`);
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'test-password', port, persistent: false, onLog: (m) => { if (process.env.PG_DEBUG) console.log(m); }, onError: (m) => { if (process.env.PG_DEBUG) console.error(m); } });

let code = 1;
try {
  console.log('Starting a temporary PostgreSQL server (first run can take a minute)...');
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('msh_test');
  console.log('Database ready; running tests.');
  code = await new Promise((resolve) => {
    const jest = spawn(process.execPath, ['node_modules/jest/bin/jest.js', '--runInBand', '--forceExit', ...process.argv.slice(2)], {
      stdio: 'inherit', env: { ...process.env, DB_PORT: String(port), DB_PASSWORD: 'test-password', DB_NAME: 'msh_test' },
    });
    jest.on('exit', (c) => resolve(c ?? 1));
  });
} catch (e) {
  console.error('Could not start the test database:', e);
} finally {
  await pg.stop().catch(() => {});
  rmSync(dir, { recursive: true, force: true });
}
process.exit(code);
