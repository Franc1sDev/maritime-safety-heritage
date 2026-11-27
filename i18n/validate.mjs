// Checks one language's translation files against the English source: node i18n/validate.mjs <code>
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const code = process.argv[2];
let bad = 0, same = 0, total = 0;
const ph = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
for (let i = 1; i <= 6; i++) {
  const src = JSON.parse(readFileSync(join(dir, 'source', `part${i}.json`), 'utf8'));
  const file = join(dir, 'out', code, `part${i}.json`);
  if (!existsSync(file)) { console.log(`MISSING FILE part${i}.json`); bad++; continue; }
  let out; try { out = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { console.log(`part${i}.json is not valid JSON: ${e.message}`); bad++; continue; }
  for (const k of src) {
    total++;
    const v = out[k];
    if (typeof v !== 'string' || !v.trim()) { console.log(`part${i}: missing or empty: ${JSON.stringify(k).slice(0, 90)}`); bad++; continue; }
    if (ph(k) !== ph(v)) { console.log(`part${i}: placeholders differ: ${JSON.stringify(k).slice(0, 70)} -> ${JSON.stringify(v).slice(0, 70)}`); bad++; }
    if ((k.match(/\n/g) ?? []).length !== (v.match(/\n/g) ?? []).length) { console.log(`part${i}: line breaks differ: ${JSON.stringify(k).slice(0, 70)}`); bad++; }
    if (v === k && /[a-z]{4,}/.test(k)) same++;
  }
  for (const k of Object.keys(out)) if (!src.includes(k)) { console.log(`part${i}: extra key not in the source: ${JSON.stringify(k).slice(0, 90)}`); bad++; }
}
console.log(`${code}: ${total} phrases checked, ${bad} problem(s), ${same} left identical to English`);
process.exit(bad ? 1 : 0);
