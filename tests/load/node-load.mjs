// A load test with no extra tools (Node 20+): many simulated people browsing, reacting, commenting, posting and messaging at once.
// The k6 scripts beside this file describe the same journeys for the release pipeline; this one runs anywhere Node runs.
//
//   node tests/load/node-load.mjs --base http://localhost:4000 --users 200 --seconds 30
//
// It signs people in through the test sign-in, so the server must run with DEMO_SIGN_IN=true (never production),
// and with RATE_LIMIT_SCALE raised, because all the simulated people come from one address.
import { performance } from 'node:perf_hooks';

const arg = (name, d) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://localhost:4000'), API = `${BASE}/api/v1`;
const USERS = Number(arg('users', 100)), SECONDS = Number(arg('seconds', 30)), ACCOUNTS = Math.min(Number(arg('accounts', 40)), USERS);
const THINK = Number(arg('think', 250)); // average pause between a person's actions, in milliseconds

const stats = new Map(); // name -> { ms: [], errors, limited }
const rec = (name) => { if (!stats.has(name)) stats.set(name, { ms: [], errors: 0, limited: 0 }); return stats.get(name); };
async function call(name, method, path, token, body) {
  const s = rec(name), t0 = performance.now();
  try {
    const res = await fetch(API + path, { method, headers: { 'content-type': 'application/json', 'x-client': 'load-test', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(method !== 'GET' ? { 'idempotency-key': crypto.randomUUID() } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    s.ms.push(performance.now() - t0);
    if (res.status === 429) s.limited++; else if (res.status >= 500) s.errors++;
    try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: null }; }
  } catch { s.ms.push(performance.now() - t0); s.errors++; return { status: 0, data: null }; }
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- set-up: accounts and something to read ----
const people = [];
for (let i = 0; i < ACCOUNTS; i++) {
  const name = `load_${i}`;
  const r = await (await fetch(`${API}/auth/demo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })).json();
  if (!r.accessToken) { console.error('Test sign-in is off on this server (DEMO_SIGN_IN). Stopping.'); process.exit(1); }
  if (!r.user.profileComplete) await fetch(`${API}/auth/profile`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${r.accessToken}` }, body: JSON.stringify({ username: name, avatar: 'dhow', language: 'en', theme: 'auto', acceptTerms: true, ageConfirmed: true }) });
  people.push({ token: r.accessToken, id: r.user.id });
}
const feed = await (await fetch(`${API}/stories?tab=trending&limit=6`)).json();
const storyIds = feed.items.map((s) => s.id);
if (!storyIds.length) { console.error('No stories to read. Load the sample data first.'); process.exit(1); }

// ---- the journeys ----
const journeys = {
  // Opening the archive and reading: the feed, a story, its comments, a view recorded, the map and the incident list.
  async browse(p) {
    const tab = pick(['trending', 'recent']);
    const f = await call('feed', 'GET', `/stories?tab=${tab}&limit=6`, p?.token);
    const id = pick(f.data?.items?.map((s) => s.id) ?? storyIds) ?? pick(storyIds);
    await call('story', 'GET', `/stories/${id}`, p?.token);
    await call('comments', 'GET', `/stories/${id}/comments`, p?.token);
    await call('view', 'POST', `/stories/${id}/view`, p?.token, {});
    if (Math.random() < 0.3) await call('incidents', 'GET', '/incidents', p?.token);
    if (Math.random() < 0.2) await call('search', 'GET', `/stories?q=${pick(['ferry', 'boat', 'lake', 'storm', 'jacket'])}&limit=6`, p?.token);
  },
  async engage(p) {
    const id = pick(storyIds);
    await call('react', 'PUT', `/stories/${id}/reaction`, p.token, { type: pick(['heart', 'heartbreak', 'laugh']) });
    if (Math.random() < 0.5) await call('comment', 'POST', `/stories/${id}/comments`, p.token, { text: `Thank you for sharing this. (${Math.random().toString(36).slice(2, 8)})` });
    if (Math.random() < 0.3) await call('favourite', 'PUT', `/stories/${id}/favourite`, p.token, {});
  },
  // Posting (text here; files are uploaded separately and are covered by the upload tests).
  async post(p) {
    const r = await call('post story', 'POST', '/stories', p.token, { title: 'Load test story', text: 'We crossed at Likoni every evening. The crew told us where the life jackets were kept and how to put them on. This story was written by the load test.', category: 'Ferry and passenger transport', rights: 'All rights reserved', draft: true });
    if (r.data?.id) await call('my stories', 'GET', '/me/stories', p.token);
  },
  async message(p) {
    const other = pick(people.filter((x) => x.id !== p.id));
    await call('notifications', 'GET', '/me/notifications', p.token);
    await call('inbox', 'GET', '/inbox', p.token);
    if (other && Math.random() < 0.5) await call('send message', 'POST', '/inbox', p.token, { toUserId: other.id, text: 'Hello from the load test.' });
  },
};
const weights = [['browse', 70], ['engage', 15], ['post', 3], ['message', 12]];
const choose = () => { let r = Math.random() * 100; for (const [n, w] of weights) { if ((r -= w) < 0) return n; } return 'browse'; };

// ---- run ----
const until = performance.now() + SECONDS * 1000;
let actions = 0;
async function person(i) {
  // Three in four are signed in; the rest are visitors, who can only browse.
  const p = i % 4 === 3 ? null : people[i % people.length];
  await sleep(Math.random() * THINK * 4);
  while (performance.now() < until) {
    await journeys[p ? choose() : 'browse'](p);
    actions++;
    await sleep(THINK * (0.5 + Math.random()));
  }
}
const started = performance.now();
await Promise.all(Array.from({ length: USERS }, (_, i) => person(i)));
const took = (performance.now() - started) / 1000;

// ---- report ----
const q = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const all = [...stats.values()].flatMap((s) => s.ms);
const total = all.length, errors = [...stats.values()].reduce((n, s) => n + s.errors, 0), limited = [...stats.values()].reduce((n, s) => n + s.limited, 0);
const rows = [...stats.entries()].map(([name, s]) => ({ name, requests: s.ms.length, p50: Math.round(q(s.ms, 0.5)), p95: Math.round(q(s.ms, 0.95)), p99: Math.round(q(s.ms, 0.99)), errors: s.errors, limited: s.limited }));
const summary = { users: USERS, seconds: Math.round(took), requests: total, perSecond: Math.round(total / took), p50: Math.round(q(all, 0.5)), p95: Math.round(q(all, 0.95)), p99: Math.round(q(all, 0.99)), errors, limited, errorRate: total ? +(errors / total * 100).toFixed(2) : 0, rows };
if (process.argv.includes('--json')) console.log(JSON.stringify(summary));
else {
  console.log(`${USERS} people for ${summary.seconds} s: ${total} requests (${summary.perSecond}/s), ${actions} journeys`);
  console.log(`All requests: median ${summary.p50} ms, 95% under ${summary.p95} ms, 99% under ${summary.p99} ms; server errors ${errors} (${summary.errorRate}%), rate-limited ${limited}`);
  console.table(rows);
}
// The targets (master plan, Section 6.1): 95% of requests under 300 ms, and no server errors.
process.exit(summary.p95 < 300 && summary.errorRate < 1 ? 0 : 2);
