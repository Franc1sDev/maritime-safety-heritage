import { inflateRawSync } from 'zlib';

/** Reads the metadata spreadsheet for bulk import: CSV (UTF-8) or the first sheet of an .xlsx workbook. Returns rows of text cells. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  const s = input.replace(/^﻿/, '');
  const delim = (s.split('\n')[0].match(/;/g)?.length ?? 0) > (s.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cell); cell = ''; rows.push(row); row = []; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function unzip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a valid .xlsx file.');
  const count = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    if (usize < 50_000_000 && /^xl\/(sharedStrings\.xml|workbook\.xml|worksheets\/sheet\d+\.xml)$/.test(name)) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + csize);
      out.set(name, method === 0 ? data : inflateRawSync(data, { maxOutputLength: 50_000_000 }));
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const colIndex = (ref: string) => { let n = 0; for (const ch of ref.replace(/\d/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

export function parseXlsx(buf: Buffer): string[][] {
  const files = unzip(buf);
  const shared: string[] = [];
  const ss = files.get('xl/sharedStrings.xml')?.toString('utf8') ?? '';
  for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(unescape([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')));
  const sheetName = [...files.keys()].filter((k) => k.startsWith('xl/worksheets/')).sort()[0];
  const sheet = files.get(sheetName ?? '')?.toString('utf8') ?? '';
  const rows: string[][] = [];
  for (const r of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const c of r[1].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /r="([A-Z]+\d+)"/.exec(c[1])?.[1] ?? ''; const type = /t="(\w+)"/.exec(c[1])?.[1] ?? '';
      const v = /<v>([\s\S]*?)<\/v>/.exec(c[2] ?? '')?.[1] ?? '';
      const inline = [...(c[2] ?? '').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('');
      const value = type === 's' ? shared[Number(v)] ?? '' : type === 'inlineStr' ? unescape(inline) : unescape(v);
      const i = ref ? colIndex(ref) : row.length;
      while (row.length < i) row.push('');
      row[i] = value;
    }
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => (c ?? '').trim() !== ''));
}

/** Excel stores dates as day numbers; this turns either form into YYYY-MM-DD (or null when it is not a date). */
export function toDate(v: string): string | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{5}(\.\d+)?$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400_000).toISOString().slice(0, 10);
  m = /^(\d{4})-(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-01`;
  return null;
}
export const yes = (v: string) => /^(y|yes|true|1|ndiyo|ndio)$/i.test((v ?? '').trim());
