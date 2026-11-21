// Load test for k6 (https://k6.io): the same journeys as node-load.mjs, with the release targets as pass/fail thresholds.
//
//   k6 run tests/load/k6-archive.js                              a typical day (default)
//   k6 run -e PROFILE=peak tests/load/k6-archive.js              a peak, such as a “Heritage Week” call for stories
//   k6 run -e PROFILE=viral tests/load/k6-archive.js             one story going viral
//   k6 run -e BASE=https://staging.example.org tests/load/k6-archive.js
//
// The server must allow the test sign-in (DEMO_SIGN_IN=true: staging only, never production) and have
// RATE_LIMIT_SCALE raised, because every simulated person comes from the same address.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://localhost:4000';
const API = `${BASE}/api/v1`;
const PROFILE = __ENV.PROFILE || 'day';
const profiles = {
  day: [{ duration: '30s', target: 100 }, { duration: '2m', target: 100 }, { duration: '20s', target: 0 }],
  peak: [{ duration: '1m', target: 1000 }, { duration: '3m', target: 1000 }, { duration: '30s', target: 0 }],
  viral: [{ duration: '20s', target: 2000 }, { duration: '2m', target: 2000 }, { duration: '20s', target: 0 }],
  smoke: [{ duration: '5s', target: 20 }, { duration: '15s', target: 20 }, { duration: '5s', target: 0 }],
};
export const options = {
  stages: profiles[PROFILE] || profiles.day,
  // The targets in the master plan, Section 6.1: 95% of requests under 300 ms, and (almost) no failures.
  thresholds: { http_req_duration: ['p(95)<300'], http_req_failed: ['rate<0.01'], checks: ['rate>0.99'] },
};
const json = { headers: { 'Content-Type': 'application/json', 'X-Client': 'load-test' } };
const auth = (token) => ({ headers: { 'Content-Type': 'application/json', 'X-Client': 'load-test', Authorization: `Bearer ${token}` } });
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Accounts and something to read, made once before the test starts.
export function setup() {
  const people = [];
  for (let i = 0; i < 40; i++) {
    const name = `load_${i}`;
    const r = http.post(`${API}/auth/demo`, JSON.stringify({ name }), json);
    if (r.status !== 200) throw new Error('The test sign-in is off on this server (DEMO_SIGN_IN).');
    const s = r.json();
    if (!s.user.profileComplete) http.post(`${API}/auth/profile`, JSON.stringify({ username: name, avatar: 'dhow', language: 'en', theme: 'auto', acceptTerms: true, ageConfirmed: true }), auth(s.accessToken));
    people.push({ token: s.accessToken, id: s.user.id });
  }
  const stories = http.get(`${API}/stories?tab=trending&limit=6`).json().items.map((s) => s.id);
  if (!stories.length) throw new Error('No stories to read. Load the sample data first.');
  return { people, stories };
}

export default function (data) {
  // Three in four are signed in; the rest are visitors, who can only browse.
  const me = __VU % 4 === 3 ? null : data.people[__VU % data.people.length];
  const roll = Math.random() * 100;
  // In the “viral” profile nearly everyone opens the same story.
  const id = PROFILE === 'viral' && Math.random() < 0.9 ? data.stories[0] : pick(data.stories);
  if (!me || roll < 70) {
    const p = me ? auth(me.token) : json;
    check(http.get(`${API}/stories?tab=${pick(['trending', 'recent'])}&limit=6`, p), { 'feed opens': (r) => r.status === 200 });
    check(http.get(`${API}/stories/${id}`, p), { 'story opens': (r) => r.status === 200 });
    check(http.get(`${API}/stories/${id}/comments`, p), { 'comments open': (r) => r.status === 200 });
    http.post(`${API}/stories/${id}/view`, '{}', p);
    if (Math.random() < 0.3) check(http.get(`${API}/incidents`, p), { 'incidents open': (r) => r.status === 200 });
    if (Math.random() < 0.2) check(http.get(`${API}/stories?q=${pick(['ferry', 'boat', 'lake', 'storm'])}&limit=6`, p), { 'search answers': (r) => r.status === 200 });
  } else if (roll < 85) {
    check(http.put(`${API}/stories/${id}/reaction`, JSON.stringify({ type: pick(['heart', 'heartbreak', 'laugh']) }), auth(me.token)), { 'reaction saved': (r) => r.status === 200 });
    if (Math.random() < 0.5) check(http.post(`${API}/stories/${id}/comments`, JSON.stringify({ text: `Thank you for sharing this. (${Math.random().toString(36).slice(2, 8)})` }), auth(me.token)), { 'comment accepted': (r) => r.status === 201 });
  } else if (roll < 88) {
    check(http.post(`${API}/stories`, JSON.stringify({ title: 'Load test story', text: 'We crossed at Likoni every evening. The crew told us where the life jackets were kept. Written by the load test.', category: 'Ferry and passenger transport', rights: 'All rights reserved', draft: true }), auth(me.token)), { 'story saved': (r) => r.status === 201 });
  } else {
    check(http.get(`${API}/me/notifications`, auth(me.token)), { 'notifications open': (r) => r.status === 200 });
    check(http.get(`${API}/inbox`, auth(me.token)), { 'inbox opens': (r) => r.status === 200 });
    const other = pick(data.people);
    if (other.id !== me.id && Math.random() < 0.5) check(http.post(`${API}/inbox`, JSON.stringify({ toUserId: other.id, text: 'Hello from the load test.' }), auth(me.token)), { 'message sent': (r) => r.status === 201 });
  }
  // People read for a while between actions.
  sleep(PROFILE === 'smoke' ? 1 + Math.random() : 8 + Math.random() * 14);
}
