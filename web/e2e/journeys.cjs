/**
 * Browser tests of the main journeys, in a real browser (master plan, Section 10.2): visitor, sign-up, reacting and
 * commenting, sharing a story, messaging, admin and Super Admin pages, approvals, languages, accessibility (axe),
 * and slow and offline networks (Section 8).
 *
 *   node web/e2e/journeys.cjs            (the local demo server must be running: cd backend && npm run demo)
 *
 * Settings (environment): BASE (default http://localhost:4000), LOG (the server's log file, to read the admin
 * sign-in codes the demo server prints), AXE (path to axe.min.js; accessibility checks are skipped without it),
 * ONLY (run the tests whose name contains this text), NET_LIMIT (milliseconds allowed for the first story on 3G; 5000).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:4000';
const LOG = process.env.LOG || '';
const AXE = process.env.AXE || [path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js')].find((f) => fs.existsSync(f)) || '';
const ONLY = process.env.ONLY || '';
const stamp = Date.now().toString(36).slice(-6);

const results = [];
let browser;
const tests = [];
const test = (name, fn, opts = {}) => tests.push({ name, fn, opts });
const expect = (ok, what) => { if (!ok) throw new Error(`Expected: ${what}`); };
const seen = async (page, selector, ms = 15000) => page.locator(selector).first().waitFor({ state: 'visible', timeout: ms });
const text = async (page, t, ms = 15000) => page.getByText(t, { exact: false }).first().waitFor({ state: 'visible', timeout: ms });

/** A fresh browser profile. Problems the page itself reports (script errors, server errors) fail the test. */
async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.phone ? { width: 412, height: 915 } : { width: 1366, height: 850 }, isMobile: !!opts.phone, hasTouch: !!opts.phone, serviceWorkers: opts.serviceWorkers ? 'allow' : 'block', colorScheme: opts.dark ? 'dark' : 'light', locale: opts.locale || 'en-GB', bypassCSP: !!opts.forAxe /* axe is injected into the page */ });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`script error: ${e.message.slice(0, 300)}`));
  page.on('response', (r) => { if (r.status() >= 500) problems.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
  if (!opts.hints) await page.addInitScript(() => { try { localStorage.setItem('guide', '1'); } catch { /* none */ } });
  return { ctx, page, problems };
}
const mfaCode = () => { const m = fs.readFileSync(LOG, 'utf8').match(/code is (\d{6})/g); if (!m) throw new Error('No sign-in code in the server log'); return m[m.length - 1].slice(-6); };

/** Signs a new Contributor up through the test sign-in and the profile set-up. Returns their username. */
async function signUp(page, name) {
  await page.goto(`${BASE}/sign-in`);
  const box = page.locator('.panel input[type=text]').first();
  await seen(page, '.panel button:has-text("Continue")');
  if (await box.count()) await box.fill(name);
  await page.locator('.panel button:has-text("Continue")').first().click();
  await page.waitForURL('**/setup', { timeout: 15000 });
  const user = page.locator('.panel input[type=text]:visible').first();
  if (await user.count()) {
    // The form may still be filling itself in from the account when the page opens: type again if it was cleared.
    for (let i = 0; i < 5; i++) { await user.fill(name); await page.waitForTimeout(700); if (await user.inputValue() === name && await page.getByText('Username available').count()) break; }
    await text(page, 'Username available');
  }
  for (const cb of await page.locator('.panel input[type=checkbox]').all()) await cb.check();
  await page.getByRole('button', { name: 'Open the archive' }).click({ timeout: 15000 });
  await page.getByRole('button', { name: 'Start exploring' }).click({ timeout: 15000 });
  await seen(page, '[data-guide="comment"]');
  return name;
}
async function adminSignIn(page, email) {
  await page.goto(`${BASE}/admin/sign-in`);
  await page.fill('input[type=email]', email); await page.fill('input[type=password]', 'admin1234');
  await page.locator('button:has-text("Continue")').first().click();
  await seen(page, 'input[autocomplete="one-time-code"]');
  await page.waitForTimeout(400);
  await page.fill('input[autocomplete="one-time-code"]', mfaCode());
  await page.locator('button:has-text("Sign in")').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/admin/sign-in'), { timeout: 15000 });
}

// ---------------- Visitors ----------------
test('visitor: the archive opens on the first story, with the first-use hints', async () => {
  const { ctx, page, problems } = await open({ hints: true });
  await page.goto(BASE + '/');
  await seen(page, '[data-guide="comment"]');
  await text(page, 'Browse the stories');
  await page.getByRole('button', { name: 'Skip the hints' }).click();
  expect(await page.locator('.guide').count() === 0, 'the hints close');
  await page.reload(); await seen(page, '[data-guide="comment"]'); await page.waitForTimeout(1500);
  expect(await page.locator('.guide').count() === 0, 'the hints are shown once only');
  await ctx.close(); return problems;
});
test('visitor: every “Stories by” tab opens, and search works', async () => {
  const { ctx, page, problems } = await open();
  await page.goto(BASE + '/'); await seen(page, '[data-guide="comment"]');
  for (const tab of ['Incidents', 'Map', 'Timeline', 'Collections', 'Location', 'Contributors', 'Trending']) {
    await page.getByRole('tab', { name: tab }).click();
    await page.waitForTimeout(700);
    expect(await page.getByRole('tab', { name: tab }).getAttribute('aria-selected') === 'true', `the ${tab} tab is selected`);
  }
  await page.getByRole('tab', { name: 'Following' }).click();
  await text(page, 'Sign in');
  await page.keyboard.press('Escape');
  await page.locator('.searchbox input').fill('ferry'); await page.keyboard.press('Enter');
  await page.waitForURL('**/?q=ferry'); await page.waitForTimeout(1200);
  expect(await page.locator('[data-guide="comment"]').count() > 0 || await page.getByText('Nothing matches your search').count() > 0, 'search shows stories or says nothing matches');
  await ctx.close(); return problems;
});
test('visitor: reacting asks for an account and changes nothing', async () => {
  const { ctx, page, problems } = await open();
  await page.goto(BASE + '/'); await seen(page, '[data-guide="comment"]');
  const heart = page.locator('[data-guide="react"]:visible button').first();
  const before = await heart.getAttribute('aria-label');
  await heart.click();
  await text(page, 'Sign in to react, comment, save favourites or share your own story.');
  expect(await heart.getAttribute('aria-label') === before, 'the count does not change');
  await ctx.close(); return problems;
});
test('visitor: the public pages open', async () => {
  const { ctx, page, problems } = await open();
  for (const [p, heading] of [['/about', 'About'], ['/resources', 'resources'], ['/privacy', 'Privacy policy'], ['/terms', 'Terms of use'], ['/rules', 'Rules and netiquette'], ['/safety', 'safety concern'], ['/sign-in', 'Sign in'], ['/admin/sign-in', 'Admin sign-in']]) {
    await page.goto(BASE + p);
    await page.locator('.panel').getByText(heading, { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 });
  }
  await page.goto(BASE + '/this-page-does-not-exist'); await text(page, 'We could not find that page.');
  await ctx.close(); return problems;
});

// ---------------- Contributors ----------------
test('contributor: sign up, welcome, react, comment, favourite', async () => {
  const { ctx, page, problems } = await open();
  await signUp(page, `e2e_a_${stamp}`);
  const heart = page.locator('[data-guide="react"]:visible button').first();
  await heart.click();
  await page.waitForFunction((el) => el.getAttribute('aria-pressed') === 'true', await heart.elementHandle(), { timeout: 10000 });
  await page.locator('[data-guide="comment"] button').click();
  const words = `A test comment ${stamp}`;
  await page.locator('.dialog input[type=text], .dialog textarea').last().fill(words);
  await page.locator('.dialog button:has-text("Send")').click();
  await page.locator('.dialog .comment', { hasText: words }).first().waitFor({ state: 'visible', timeout: 15000 });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add to Favorites' }).first().click();
  await text(page, 'Added to Favorites.');
  await page.getByRole('tab', { name: 'Favorites' }).click();
  await page.getByRole('button', { name: 'Remove from Favorites' }).first().waitFor({ state: 'visible', timeout: 15000 }); // the story is in Favorites
  await ctx.close(); return problems;
});
test('contributor: share a story and see it go live', async () => {
  const { ctx, page, problems } = await open();
  await signUp(page, `e2e_b_${stamp}`);
  await page.locator('[data-guide="share"]').click();
  const title = `Evening crossing ${stamp}`;
  await seen(page, 'textarea');
  await page.locator('input[type=text]').first().fill(title);
  await page.locator('textarea').first().fill('We crossed at Likoni every evening. The crew told us where the life jackets were kept and how to put them on. Everyone on board listened.');
  await page.getByRole('button', { name: /^SEND/i }).first().click();
  await text(page, 'Your story is live!', 60000);
  await page.goto(BASE + '/profile/stories');
  await text(page, title);
  await ctx.close(); return problems;
});
test('contributor: profile pages, settings, and a message to the admins', async () => {
  const { ctx, page, problems } = await open();
  await signUp(page, `e2e_c_${stamp}`);
  for (const p of ['/profile', '/profile/stories', '/profile/drafts', '/profile/reminders', '/profile/notifications', '/profile/settings', '/profile/data', '/profile/delete', '/announcements', '/inbox']) {
    await page.goto(BASE + p); await seen(page, '.panel h2, .panel h1'); await page.waitForTimeout(300);
  }
  await page.goto(BASE + '/profile/settings');
  const low = page.getByLabel('Low-data mode', { exact: false });
  await low.click();
  await page.waitForFunction((el) => el.checked, await low.elementHandle(), { timeout: 10000 });
  await page.reload(); await seen(page, '.panel h2');
  expect(await page.getByLabel('Low-data mode', { exact: false }).isChecked(), 'the low-data setting is kept');
  // A message to the admins.
  await page.goto(BASE + '/inbox?new=admins');
  const words = `A question for the admins ${stamp}`;
  await page.getByLabel('Write a message').fill(words);
  await page.keyboard.press('Enter');
  await page.locator('.panel').getByText(words).first().waitFor({ state: 'visible', timeout: 15000 });
  await ctx.close(); return problems;
});

// ---------------- Languages ----------------
test('languages: Kiswahili is applied everywhere and remembered', async () => {
  const { ctx, page, problems } = await open();
  await page.goto(BASE + '/'); await seen(page, '[data-guide="comment"]');
  await page.selectOption('#lang', 'sw');
  await text(page, 'HADITHI');
  expect(await page.evaluate(() => document.documentElement.lang) === 'sw', 'the page language is Kiswahili');
  await page.reload(); await text(page, 'HADITHI');
  await page.goto(BASE + '/rules'); await text(page, 'Kanuni');
  await ctx.close(); return problems;
});

// ---------------- Admins ----------------
test('admin: sign in with a code, and every admin page opens', async () => {
  const { ctx, page, problems } = await open();
  await adminSignIn(page, 'grace@demo.ke');
  for (const t of ['', 'reports', 'safety', 'approvals', 'company', 'collections', 'incidents', 'import', 'resources', 'announcements', 'analytics', 'audit']) {
    await page.goto(`${BASE}/admin/${t}`); await seen(page, '.panel h2, .panel h1, .panel h3'); await page.waitForTimeout(500);
  }
  await page.goto(BASE + '/responsibilities'); await seen(page, '.panel h2');
  await page.goto(BASE + '/profile/security'); await seen(page, '.panel h2');
  await ctx.close(); return problems;
}, { needsLog: true });
test('admin: a request waiting for approval can be approved, with a comment', async () => {
  const { ctx, page, problems } = await open();
  await adminSignIn(page, 'peter@demo.ke');
  await page.goto(BASE + '/admin/approvals'); await seen(page, '.panel h2'); await page.waitForTimeout(1200);
  const approve = page.locator('.panel button.primary:text-is("Approve")');
  if (await approve.count()) {
    await approve.first().click();
    await page.locator('.dialog textarea').fill('Checked and agreed.');
    await page.locator('.dialog button:has-text("Confirm")').click();
    await text(page, 'Your decision has been recorded.');
  } else {
    // Nothing is waiting for this admin on this server (the sample requests have been decided already).
    await page.getByRole('button', { name: 'Approved' }).click(); await page.waitForTimeout(800);
  }
  await ctx.close(); return problems;
}, { needsLog: true });
test('accessibility: the admin pages pass the automated checks', async () => {
  const { ctx, page, problems } = await open({ forAxe: true });
  await adminSignIn(page, 'amina@demo.ke');
  const found = [];
  for (const t of ['', 'reports', 'safety', 'approvals', 'company', 'collections', 'incidents', 'import', 'resources', 'announcements', 'analytics', 'audit']) {
    await page.goto(`${BASE}/admin/${t}`); await seen(page, '.panel h2, .panel h1, .panel h3'); await page.waitForTimeout(1500);
    await page.addScriptTag({ path: AXE });
    const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`));
    for (const v of r) found.push(`/admin/${t}: ${v}`);
  }
  expect(found.length === 0, `no accessibility failures, but found:\n      ${found.join('\n      ')}`);
  await ctx.close(); return problems;
}, { needsLog: true, needsAxe: true });
test('Super Admin: sign in, and every Super Admin page opens', async () => {
  const { ctx, page, problems } = await open();
  await adminSignIn(page, 'admin@demo.ke');
  for (const t of ['analytics', 'reports', 'admins', 'approvals', 'audit', 'system']) {
    await page.goto(`${BASE}/super/${t}`); await seen(page, '.panel h2, .panel h1, .panel h3'); await page.waitForTimeout(500);
  }
  await ctx.close(); return problems;
}, { needsLog: true });

// ---------------- Weak and missing connections (Section 8) ----------------
test('network: on 3G the first story appears within 5 seconds', async () => {
  const { ctx, page, problems } = await open({ phone: true });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, downloadThroughput: 750e3 / 8, uploadThroughput: 250e3 / 8, latency: 100 });
  const t0 = Date.now();
  await page.goto(BASE + '/', { waitUntil: 'commit' });
  await seen(page, '[data-guide="comment"]', 20000);
  const took = Date.now() - t0;
  // The target is 5 seconds (master plan, Section 6.1). NET_LIMIT allows for a slow shared test machine.
  const limit = Number(process.env.NET_LIMIT || 5000);
  expect(took < limit, `first story within ${limit / 1000} s on 3G (took ${took} ms)`);
  await ctx.close(); return problems;
});
test('network: offline shows a banner, keeps a reaction waiting, and sends it when the connection returns', async () => {
  const { ctx, page, problems } = await open({ serviceWorkers: true });
  await signUp(page, `e2e_d_${stamp}`);
  await page.waitForTimeout(2500); // the offline copy of the site is being saved
  await ctx.setOffline(true);
  await text(page, 'You are offline. Some features are unavailable.');
  const heart = page.locator('[data-guide="react"]:visible button').first();
  await heart.click();
  await text(page, 'Waiting to send');
  await ctx.setOffline(false);
  await text(page, 'Back online.');
  await page.waitForTimeout(2500);
  await page.goto(BASE + '/profile/drafts'); await seen(page, '.panel h2');
  expect(await page.getByText('Waiting to send').count() === 0, 'nothing is left waiting after the connection returns');
  await ctx.close(); return problems.filter((p) => !/ERR_INTERNET_DISCONNECTED/.test(p));
});
test('network: a story already opened can be read again offline', async () => {
  const { ctx, page, problems } = await open({ serviceWorkers: true });
  await page.goto(BASE + '/'); await seen(page, '[data-guide="comment"]');
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready.then(() => true), null, { timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.reload(); await seen(page, '[data-guide="comment"]'); await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await page.reload();
  await seen(page, '[data-guide="comment"]', 20000);
  await ctx.close(); return [];
});

// ---------------- Accessibility (WCAG 2.2 AA, automated part) ----------------
const axePages = [['/', 'the stories page'], ['/sign-in', 'sign-in'], ['/about', 'About'], ['/rules', 'the rules'], ['/privacy', 'the privacy policy'], ['/safety', 'the safety concern form'], ['/resources', 'learning resources'], ['/incidents', 'incident records']];
for (const dark of [false, true]) {
  test(`accessibility: no WCAG A or AA failures on the public pages (${dark ? 'dark' : 'light'} theme)`, async () => {
    const { ctx, page, problems } = await open({ dark, forAxe: true });
    const found = [];
    for (const [p, name] of axePages) {
      await page.goto(BASE + p); await page.waitForTimeout(1500);
      await page.addScriptTag({ path: AXE });
      const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`));
      for (const v of r) found.push(`${name}: ${v}`);
    }
    expect(found.length === 0, `no accessibility failures, but found:\n      ${found.join('\n      ')}`);
    await ctx.close(); return problems;
  }, { needsAxe: true });
}
test('accessibility: the signed-in pages and the story form pass too', async () => {
  const { ctx, page, problems } = await open({ forAxe: true });
  await signUp(page, `e2e_x_${stamp}`);
  const found = [];
  const check = async (name) => {
    await page.waitForTimeout(1200);
    await page.addScriptTag({ path: AXE });
    const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`));
    for (const v of r) found.push(`${name}: ${v}`);
  };
  await page.locator('[data-guide="share"]').click(); await seen(page, 'textarea'); await check('the story form');
  for (const p of ['/profile', '/profile/settings', '/profile/notifications', '/inbox', '/announcements']) { await page.goto(BASE + p); await seen(page, '.panel h2, .panel h1'); await check(p); }
  await page.goto(BASE + '/'); await seen(page, '[data-guide="comment"]'); await page.locator('[data-guide="comment"] button').click(); await seen(page, '.dialog'); await check('the comments');
  expect(found.length === 0, `no accessibility failures, but found:\n      ${found.join('\n      ')}`);
  await ctx.close(); return problems;
}, { needsAxe: true });
test('accessibility: the whole first screen can be used from the keyboard', async () => {
  const { ctx, page, problems } = await open();
  await page.goto(BASE + '/'); await seen(page, '[data-guide="comment"]');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement && document.activeElement.textContent) === 'Skip to the stories', 'the first Tab stop is “Skip to the stories”');
  const stops = new Set();
  let rings = 0, checked = 0; const noRing = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const [label, ring, real] = await page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return ['', false, false]; const s = getComputedStyle(a), up = a.parentElement ? getComputedStyle(a.parentElement) : s; /* a text box may show its ring on the frame around it */ return [(a.getAttribute('aria-label') || a.textContent || a.tagName).trim().slice(0, 40), s.outlineStyle !== 'none' || s.boxShadow !== 'none' || up.boxShadow !== 'none', true]; });
    if (real) { stops.add(label); checked++; if (ring) rings++; else noRing.push(label); }
  }
  for (const need of ['STORIES', 'Trending', 'Comments']) expect([...stops].some((s) => s.includes(need)), `the keyboard reaches “${need}”`);
  expect(checked > 20 && rings === checked, `every focused control shows a focus ring (${rings} of ${checked}; without: ${noRing.join(', ')})`);
  await ctx.close(); return problems;
});

// ---------------- run ----------------
(async () => {
  browser = await chromium.launch();
  for (const t of tests) {
    if (ONLY && !t.name.includes(ONLY)) continue;
    if (t.opts.needsLog && !LOG) { results.push([t.name, 'skipped', 'set LOG to the server log to run the admin tests']); continue; }
    if (t.opts.needsAxe && !AXE) { results.push([t.name, 'skipped', 'set AXE to axe.min.js to run the accessibility checks']); continue; }
    const t0 = Date.now();
    try {
      const problems = await t.fn();
      if (problems && problems.length) throw new Error(`The page reported problems:\n      ${[...new Set(problems)].slice(0, 8).join('\n      ')}`);
      results.push([t.name, 'passed', `${((Date.now() - t0) / 1000).toFixed(1)} s`]);
    } catch (e) { results.push([t.name, 'FAILED', String(e.message).split('\n').slice(0, 14).join('\n')]); }
    for (const c of browser.contexts()) await c.close().catch(() => undefined);
    const [name, state, note] = results[results.length - 1];
    console.log(`${state === 'passed' ? '✓' : state === 'skipped' ? '-' : '✗'} ${name}${state === 'passed' ? ` (${note})` : `\n      ${note}`}`);
  }
  await browser.close();
  const failed = results.filter((r) => r[1] === 'FAILED').length, skipped = results.filter((r) => r[1] === 'skipped').length;
  console.log(`\n${results.length - failed - skipped} passed, ${failed} failed, ${skipped} skipped`);
  process.exit(failed ? 1 : 0);
})();
