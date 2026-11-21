/**
 * Lighthouse on a simulated mid-range phone on a slow 4G connection (Lighthouse's defaults).
 *
 *   node tests/perf/lighthouse.cjs http://localhost:4000/
 *
 * The master plan's target (Section 6.1) is a performance score of 90 or higher. Shared test machines vary from run
 * to run, so three runs are made and the middle one is used; the check fails below MIN_PERFORMANCE (default 80)
 * or if accessibility, best practices or SEO fall below 95.
 * Settings: LIGHTHOUSE (path to the lighthouse command), CHROME_PATH (the browser; Playwright's Chromium if not set).
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const url = process.argv[2] || 'http://localhost:4000/';
const bin = process.env.LIGHTHOUSE || 'lighthouse';
let chrome = process.env.CHROME_PATH;
if (!chrome) { try { chrome = require('playwright').chromium.executablePath(); } catch { /* use whatever Chrome is installed */ } }
const min = Number(process.env.MIN_PERFORMANCE || 80);
const runs = [];
for (let i = 0; i < 3; i++) {
  const out = path.join(os.tmpdir(), `lighthouse-${process.pid}-${i}.json`);
  execFileSync(process.execPath, [bin, url, '--quiet', '--chrome-flags=--headless=new --no-sandbox --disable-gpu', '--output=json', `--output-path=${out}`, '--only-categories=performance,accessibility,best-practices,seo'], { env: { ...process.env, ...(chrome ? { CHROME_PATH: chrome } : {}) }, stdio: ['ignore', 'ignore', 'inherit'] });
  const r = JSON.parse(fs.readFileSync(out, 'utf8'));
  const score = (k) => Math.round(r.categories[k].score * 100);
  runs.push({ performance: score('performance'), accessibility: score('accessibility'), bestPractices: score('best-practices'), seo: score('seo'),
    firstPaint: r.audits['first-contentful-paint'].displayValue, largestPaint: r.audits['largest-contentful-paint'].displayValue, blocking: r.audits['total-blocking-time'].displayValue, shift: r.audits['cumulative-layout-shift'].displayValue });
  console.log(`run ${i + 1}:`, JSON.stringify(runs[i]));
}
const mid = [...runs].sort((a, b) => a.performance - b.performance)[1];
console.log(`\nMiddle run: performance ${mid.performance}, accessibility ${mid.accessibility}, best practices ${mid.bestPractices}, SEO ${mid.seo}`);
const bad = [];
if (mid.performance < min) bad.push(`performance ${mid.performance} is below ${min}`);
for (const [k, name] of [['accessibility', 'accessibility'], ['bestPractices', 'best practices'], ['seo', 'SEO']]) if (Math.min(...runs.map((x) => x[k])) < 95) bad.push(`${name} fell below 95`);
if (bad.length) { console.error('Failed: ' + bad.join('; ')); process.exit(1); }
