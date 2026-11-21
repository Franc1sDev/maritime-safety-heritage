// One shared translation source (Section 3.1.6): the website's interface text is copied to the apps, so wording is identical everywhere.
// Run after changing web/src/locales/*.ts:  node scripts/sync-translations.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'mobile-app/assets/i18n'), { recursive: true });
for (const code of ['sw', 'luo']) {
  const src = readFileSync(join(root, `web/src/locales/${code}.ts`), 'utf8');
  const body = src.slice(src.indexOf('= {') + 2, src.lastIndexOf('};') + 1);
  const map = new Function(`return (${body});`)();
  let extra = {};
  try { extra = JSON.parse(readFileSync(join(root, `mobile-app/assets/i18n/${code}.app.json`), 'utf8')); } catch { /* none yet */ }
  writeFileSync(join(root, `mobile-app/assets/i18n/${code}.json`), JSON.stringify({ ...map, ...extra }, null, 0));
  console.log(code, Object.keys(map).length, '+', Object.keys(extra).length);
}
