// Starts a throwaway PostgreSQL server (embedded-postgres, no installation needed), runs the Jest suite against it, then removes it.
import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = 15432 + Math.floor(Math.random() * 1000);
const dir = mkdtempSync(join(tmpdir(), 'msh-pg-'));
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'test-password', port, persistent: false, onLog: () => {} });

let code = 1;
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('msh_test');
  code = await new Promise((resolve) => {
    const jest = spawn(process.execPath, ['node_modules/jest/bin/jest.js', '--runInBand', ...process.argv.slice(2)], {
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
