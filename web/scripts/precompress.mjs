// After the build: leaves a Brotli (.br) and gzip (.gz) copy beside every text file in dist/, so the server can send
// the small copy to browsers that accept it. Run by "npm run build".
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TEXT = new Set(['.js', '.css', '.svg', '.json', '.webmanifest', '.txt']);
let before = 0, after = 0, files = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { walk(path); continue; }
    if (!TEXT.has(extname(name))) continue;
    const data = readFileSync(path);
    if (data.length < 1024) continue; // too small to be worth it
    const br = brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: data.length } });
    writeFileSync(`${path}.br`, br);
    writeFileSync(`${path}.gz`, gzipSync(data, { level: 9 }));
    before += data.length; after += br.length; files++;
  }
};
walk(dist);
console.log(`precompressed ${files} files: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB (Brotli)`);
