import { deflateSync } from 'zlib';

/**
 * A small PDF writer for the analytics reports: A4 pages, the standard Helvetica fonts, text, lines and bars.
 * It has no outside dependencies, so reports can be generated on any server.
 */
const W = 595.28, H = 841.89, M = 48;
const enc = (s: string) => {
  // Standard fonts use WinAnsi; typographic punctuation is mapped and anything else falls back to "?".
  const map: Record<string, string> = { '–': '\x96', '—': '\x97', '‘': '\x91', '’': '\x92', '“': '\x93', '”': '\x94', '•': '\x95', '…': '\x85', '€': '\x80' };
  let out = '';
  for (const ch of s) { const c = map[ch] ?? ch; const code = c.charCodeAt(0); out += code > 255 ? '?' : code === 40 || code === 41 || code === 92 ? `\\${c}` : c; }
  return out;
};
// Approximate Helvetica widths (per 1000 units) are enough for wrapping report text.
const width = (s: string, size: number, bold = false) => { let w = 0; for (const ch of s) w += 'iljtfI.,:;|!\'’ '.includes(ch) ? 290 : 'mwMW@'.includes(ch) ? 860 : /[A-Z0-9]/.test(ch) ? 660 : 540; return (w * size * (bold ? 1.06 : 1)) / 1000; };

export class Pdf {
  private pages: string[] = [];
  private cur = '';
  y = H - M;
  constructor(private readonly footer = '') { this.newPage(); }

  newPage() { if (this.cur) this.pages.push(this.cur); this.cur = ''; this.y = H - M; }
  private need(h: number) { if (this.y - h < M + 24) this.newPage(); }
  private rgb(hex: string) { const n = parseInt(hex, 16); return `${((n >> 16) & 255) / 255} ${((n >> 8) & 255) / 255} ${(n & 255) / 255}`; }

  text(s: string, opts: { size?: number; bold?: boolean; color?: string; x?: number; maxWidth?: number; gap?: number } = {}) {
    const size = opts.size ?? 10.5, x = opts.x ?? M, max = opts.maxWidth ?? W - M - x;
    for (const para of s.split('\n')) {
      const lines: string[] = []; let line = '';
      for (const word of para.split(/\s+/)) { const t = line ? `${line} ${word}` : word; if (width(t, size, opts.bold) > max && line) { lines.push(line); line = word; } else line = t; }
      lines.push(line);
      for (const l of lines) {
        this.need(size * 1.45);
        this.y -= size * 1.45;
        this.cur += `BT /${opts.bold ? 'F2' : 'F1'} ${size} Tf ${this.rgb(opts.color ?? '1B2A3A')} rg ${x.toFixed(1)} ${this.y.toFixed(1)} Td (${enc(l)}) Tj ET\n`;
      }
    }
    this.y -= opts.gap ?? 4;
  }
  heading(s: string) { this.y -= 8; this.text(s, { size: 14, bold: true, color: '0B4F8A', gap: 6 }); }
  rule() { this.need(10); this.y -= 6; this.cur += `${this.rgb('C9D6E3')} RG 0.6 w ${M} ${this.y.toFixed(1)} m ${W - M} ${this.y.toFixed(1)} l S\n`; this.y -= 6; }

  /** Key figures in a row of boxes. */
  stats(items: Array<{ label: string; value: string }>) {
    const per = 4, bw = (W - 2 * M - (per - 1) * 10) / per, bh = 52;
    for (let i = 0; i < items.length; i += per) {
      this.need(bh + 10);
      const top = this.y;
      items.slice(i, i + per).forEach((it, k) => {
        const x = M + k * (bw + 10);
        this.cur += `${this.rgb('EEF4FA')} rg ${x.toFixed(1)} ${(top - bh).toFixed(1)} ${bw.toFixed(1)} ${bh} re f\n`;
        this.cur += `BT /F2 16 Tf ${this.rgb('0B4F8A')} rg ${(x + 8).toFixed(1)} ${(top - 24).toFixed(1)} Td (${enc(it.value)}) Tj ET\n`;
        this.cur += `BT /F1 8.5 Tf ${this.rgb('44576B')} rg ${(x + 8).toFixed(1)} ${(top - 40).toFixed(1)} Td (${enc(it.label.slice(0, 30))}) Tj ET\n`;
      });
      this.y = top - bh - 10;
    }
  }

  /** A bar chart of one or more series over the same labels. */
  chart(title: string, labels: string[], series: Array<{ name: string; color: string; values: number[] }>) {
    const h = 150, w = W - 2 * M;
    this.need(h + 60);
    this.text(title, { size: 11, bold: true, gap: 2 });
    const top = this.y - 6, base = top - h, max = Math.max(1, ...series.flatMap((s) => s.values));
    this.cur += `${this.rgb('C9D6E3')} RG 0.6 w ${M} ${base.toFixed(1)} m ${M + w} ${base.toFixed(1)} l S\n`;
    for (const frac of [0.5, 1]) {
      const gy = base + h * frac;
      this.cur += `${this.rgb('E6EDF4')} RG 0.4 w ${M} ${gy.toFixed(1)} m ${M + w} ${gy.toFixed(1)} l S\n`;
      this.cur += `BT /F1 7 Tf ${this.rgb('6B7C8E')} rg ${(M + 2).toFixed(1)} ${(gy + 2).toFixed(1)} Td (${Math.round(max * frac)}) Tj ET\n`;
    }
    const n = Math.max(1, labels.length), slot = w / n, bar = Math.max(1.2, Math.min(22, (slot * 0.8) / series.length));
    series.forEach((s, si) => s.values.forEach((v, i) => {
      const bh = (v / max) * h; const x = M + i * slot + (slot - bar * series.length) / 2 + si * bar;
      if (bh > 0) this.cur += `${this.rgb(s.color)} rg ${x.toFixed(1)} ${base.toFixed(1)} ${(bar - 0.6).toFixed(1)} ${bh.toFixed(1)} re f\n`;
    }));
    const step = Math.ceil(n / 12);
    labels.forEach((l, i) => { if (i % step === 0) this.cur += `BT /F1 7 Tf ${this.rgb('44576B')} rg ${(M + i * slot + 1).toFixed(1)} ${(base - 10).toFixed(1)} Td (${enc(l)}) Tj ET\n`; });
    let lx = M;
    series.forEach((s) => {
      this.cur += `${this.rgb(s.color)} rg ${lx.toFixed(1)} ${(base - 26).toFixed(1)} 8 8 re f\nBT /F1 8 Tf ${this.rgb('44576B')} rg ${(lx + 11).toFixed(1)} ${(base - 25).toFixed(1)} Td (${enc(s.name)}) Tj ET\n`;
      lx += 22 + width(s.name, 8);
    });
    this.y = base - 40;
  }

  table(head: string[], rows: string[][]) {
    const cw = (W - 2 * M) / head.length;
    const line = (cells: string[], bold: boolean) => {
      this.need(16); this.y -= 14;
      cells.forEach((c, i) => { this.cur += `BT /${bold ? 'F2' : 'F1'} 9 Tf ${this.rgb(bold ? '0B4F8A' : '1B2A3A')} rg ${(M + i * cw).toFixed(1)} ${this.y.toFixed(1)} Td (${enc(String(c).slice(0, Math.floor(cw / 4.6)))}) Tj ET\n`; });
    };
    line(head, true); this.rule();
    rows.forEach((r) => line(r, false));
    this.y -= 8;
  }

  build(): Buffer {
    if (this.cur) { this.pages.push(this.cur); this.cur = ''; }
    const objs: Buffer[] = [];
    const add = (b: string | Buffer) => { objs.push(Buffer.isBuffer(b) ? b : Buffer.from(b, 'latin1')); return objs.length; };
    add('<< /Type /Catalog /Pages 2 0 R >>'); add('');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids: number[] = [];
    this.pages.forEach((content, i) => {
      const foot = `BT /F1 8 Tf 0.42 0.49 0.56 rg ${M} 28 Td (${enc(this.footer)}) Tj ET\nBT /F1 8 Tf 0.42 0.49 0.56 rg ${W - M - 50} 28 Td (Page ${i + 1} of ${this.pages.length}) Tj ET\n`;
      const data = deflateSync(Buffer.from(content + foot, 'latin1'));
      const c = add(Buffer.concat([Buffer.from(`<< /Length ${data.length} /Filter /FlateDecode >>\nstream\n`, 'latin1'), data, Buffer.from('\nendstream', 'latin1')]));
      kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${c} 0 R >>`));
    });
    objs[1] = Buffer.from(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`, 'latin1');
    const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
    const offsets: number[] = []; let pos = parts[0].length;
    objs.forEach((o, i) => { offsets.push(pos); const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), o, Buffer.from('\nendobj\n', 'latin1')]); parts.push(b); pos += b.length; });
    const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
    parts.push(Buffer.from(xref, 'latin1'));
    return Buffer.concat(parts);
  }
}
