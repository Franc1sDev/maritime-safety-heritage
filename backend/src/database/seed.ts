import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { hashPassword, PASSWORD_RULE } from '../common/crypto';
import { config } from '../config/config';
import { AppDataSource } from './data-source';
import { PLACES } from './places';

const CATEGORY: Record<string, string> = { ferry: 'Ferry and passenger transport', fishing: 'Fishing life', rescue: 'Rescue and survival', storm: 'Storms and weather', swim: 'Youth and learning', flood: 'Rivers and floods', boat: 'Boat-building and vessels', harbour: 'Trade and port life' };

/**
 * Prepares a new database: the places list and the first Super Admin, and (outside production, or when asked) sample
 * content so the archive is not empty. Sample items are placeholders, not real testimonies. Safe to run again.
 */
export async function seed(ds: DataSource, opts = { sample: config.seed.sampleData, log: console.log as (m: string) => void }) {
  const { log } = opts;
  const q = (sql: string, p: unknown[] = []) => ds.query(sql, p);
  const rows = async (sql: string, p: unknown[] = []) => { const r = await q(sql, p); return (Array.isArray(r) && Array.isArray(r[0]) && typeof r[1] === 'number' ? r[0] : r) as any[]; };

  for (const [name, type, county, waterBody, lat, lng, alt] of PLACES) {
    await q(`INSERT INTO places (name, type, county, water_body, latitude, longitude, alt_names, search) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (lower(name)) DO NOTHING`,
      [name, type, county, waterBody, lat, lng, alt ?? [], [name, ...(alt ?? []), county, waterBody].join(' ').toLowerCase()]);
  }

  // The first Super Admin, only while the archive has none (so restarts never need the seed password again).
  const adminEmail = config.seed.adminEmail.trim().toLowerCase();
  const have = (await rows(`SELECT count(*)::int AS n FROM users WHERE role = 'super_admin'`))[0].n;
  if (!have && !(await rows(`SELECT 1 FROM users WHERE email = $1`, [adminEmail])).length) {
    let pw = config.seed.adminPassword;
    // With no seed password (hosted setups), the account gets a random one and its owner sets their own with "Forgot password".
    const viaEmail = !pw && config.isProd;
    if (viaEmail) pw = `${randomBytes(24).toString('base64url')}a1`;
    if ((!PASSWORD_RULE.test(pw) && pw.length < 16) || pw.startsWith('change-me')) throw new Error('Set SEED_ADMIN_PASSWORD in .env (8+ characters, letters and numbers) before seeding.');
    const [u] = await rows(`INSERT INTO users (name, email, password_hash, role, provider, profile_complete, password_set) VALUES ('Archive Super Admin', $1, $2, 'super_admin', 'password', true, true) RETURNING id`, [adminEmail, await hashPassword(pw)]);
    await q(`INSERT INTO admin_profiles (user_id, admin_name, email_verified, approved_at) VALUES ($1, 'Super Admin', true, now())`, [u.id]);
    log(viaEmail ? `Created the Super Admin account ${adminEmail}. Set its password with "Forgot password" on the admin sign-in page.` : `Created the Super Admin account ${adminEmail}`);
  }

  if (!opts.sample) return;
  if ((await rows(`SELECT count(*)::int AS n FROM stories`))[0].n > 0) { log('The archive already has stories; sample data skipped.'); return; }
  const data = JSON.parse(readFileSync(join(__dirname, 'sample-data.json'), 'utf8')) as { records: Array<Record<string, any>> };

  // Demo accounts are for development and showcases only.
  const admins: string[] = [];
  if (!config.isProd) {
    for (const [name, email] of [['Grace Wanjiru', 'grace@demo.ke'], ['Peter Otieno', 'peter@demo.ke'], ['Amina Hassan', 'amina@demo.ke']]) {
      let [u] = await rows(`SELECT id FROM users WHERE email = $1`, [email]);
      if (!u) {
        [u] = await rows(`INSERT INTO users (name, email, password_hash, role, provider, profile_complete, password_set) VALUES ($1,$2,$3,'admin','password',true,true) RETURNING id`, [name, email, await hashPassword('admin1234')]);
        await q(`INSERT INTO admin_profiles (user_id, admin_name, staff_number, email_verified, approved_at) VALUES ($1,$2,$3,true,now())`, [u.id, `Admin – ${name.split(' ')[0]}`, `RW-${100 + admins.length}`]);
      }
      admins.push(u.id);
    }
    log('Demo admin accounts ready (grace@demo.ke, peter@demo.ke, amina@demo.ke; password admin1234).');
  }
  const contributors: string[] = [];
  const people: Array<[string, string, string]> = [['mzee_omari', 'dhow', 'sw'], ['mama_atieno', 'fish', 'luo'], ['lamu_sailor', 'sail', 'en'], ['kisumu_boats', 'canoe', 'en'], ['shimoni_guide', 'turtle', 'en'], ['turkana_fisher', 'heron', 'en']];
  for (const [username, avatar, language] of people) {
    const [u] = await rows(`INSERT INTO users (name, username, role, provider, google_sub, avatar, language, profile_complete, accepted_terms_at, age_confirmed, password_set, trained)
      VALUES ($1,$1,'contributor','google',$2,$3,$4,true,now(),true,false,$5) ON CONFLICT DO NOTHING RETURNING id`, [username, `demo-${username}`, avatar, language, contributors.length < 3]);
    if (u) contributors.push(u.id);
  }
  if (!contributors.length) return;
  const author = (i: number) => contributors[i % contributors.length];
  const placeId = async (name: string) => (await rows(`SELECT id FROM places WHERE lower(name) = lower($1) OR search ILIKE '%' || lower($1) || '%' ORDER BY (lower(name) = lower($1)) DESC LIMIT 1`, [name.split(',')[0].replace(/ (beach|crossing|channel|harbour|port)$/i, '')]))[0]?.id ?? null;

  const incidents: Record<string, string> = {};
  const incidentRows: Array<[string, string, boolean, string, string, string, string, string, string]> = [
    ['Mtongwe ferry disaster', '1994-04-29', false, 'Mtongwe', 'MV Mtongwe', 'Capsizing', 'The passenger ferry MV Mtongwe capsized shortly after leaving the Mtongwe ramp for Mombasa Island, with far more people aboard than it was built to carry.', 'More than 270 people died. It remains the deadliest ferry accident in Kenya’s history, and led to public inquiries into overloading and ferry maintenance.', 'Press reports, April–May 1994; commission of inquiry report (sample catalogue entry to be completed from the project’s research).'],
    ['Likoni ferry vehicle accident', '2019-09-29', false, 'Likoni', 'MV Harambee', 'Person overboard', 'A car slid off the ferry MV Harambee midstream in the Likoni Channel with a mother and her young daughter inside.', 'Both died. The recovery took 13 days and drew national attention to ferry safety, ramp barriers and rescue readiness.', 'Press reports, September–October 2019 (sample catalogue entry to be completed from the project’s research).'],
    ['Lake Victoria passenger boat capsizing (sample record)', '2012-08-15', true, 'Mbita', '', 'Capsizing', 'Sample incident record: a passenger boat capsized in the afternoon wind between the mainland and the islands.', 'Sample outcome: fishermen from nearby beaches carried out the rescue.', 'Sample entry, to be replaced by the project’s research.'],
  ];
  for (const [title, date, approx, place, vessel, type, summary, outcome, sources] of incidentRows) {
    const pid = await placeId(place);
    const [i] = await rows(`INSERT INTO incidents (title, event_date, date_approximate, place_id, place_name, latitude, longitude, water_body, vessel, incident_type, summary, outcome, sources, created_by)
      SELECT $1,$2,$3,p.id,p.name,p.latitude,p.longitude,p.water_body,$5,$6,$7,$8,$9,$10 FROM places p WHERE p.id = $4 RETURNING id`, [title, date, approx, pid, vessel, type, summary, outcome, sources, admins[0] ?? null]);
    if (i) incidents[title] = i.id;
  }

  let n = 0;
  for (const r of data.records) {
    const type = r.type === 'record' || r.type === 'photo' ? 'record' : r.type === 'testimony' || r.type === 'oral' ? (n % 2 ? 'community' : 'testimony') : 'community';
    const pid = await placeId(r.place);
    const body = [r.summary, ...(r.transcript ?? []).map((t: { text: string }) => t.text), r.body].filter(Boolean).join('\n\n');
    const lower = `${r.title} ${body}`.toLowerCase();
    const category = Object.entries(CATEGORY).find(([k]) => lower.includes(k))?.[1] ?? 'Safety lessons';
    const posted = type === 'record' ? 'company' : type === 'testimony' ? 'told_by' : 'self';
    const language = /kiswahili/i.test(r.language ?? '') ? 'sw' : /dholuo|luo/i.test(r.language ?? '') ? 'luo' : 'en';
    const published = new Date(Date.now() - (n * 5 + 2) * 3600_000);
    const incident = /likoni/i.test(r.place) && n === 0 ? incidents['Likoni ferry vehicle accident'] : /mbita|mfangano/i.test(r.place) ? incidents['Lake Victoria passenger boat capsizing (sample record)'] : null;
    const [s] = await rows(
      `INSERT INTO stories (type, author_id, posted_as, told_by, title, body, language, incident_id, place_id, place_name, county, water_body, latitude, longitude, event_date, date_approximate, category, tags, rights, consent_confirmed, validated,
                            status, ai_flag, ai_score, published_at, created_at, view_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,true,$20,'published','GREEN',4,$21,$21,$22) RETURNING id`,
      [type, type === 'community' ? author(n) : admins[0] ?? author(n), posted, posted === 'told_by' ? (r.narrator || 'Storyteller') : '', `${r.title} (sample)`, body, language, incident, pid, r.place, r.county, r.waterBody === 'Rivers' ? 'Tana River' : r.waterBody.replace(' coast', ''),
        r.latitude, r.longitude, r.year ? `${r.year}-01-01` : null, true, category, (r.subjects ?? []).slice(0, 6), ['CC BY-NC 4.0', 'CC BY 4.0'].includes(r.rights) ? r.rights : 'All rights reserved', type === 'testimony', published, r.views ?? 0]);
    if (type === 'record') await q(`INSERT INTO record_sources (story_id, institution, reference, original_date, creator, rights_statement, obtained) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [s.id, 'Remembering the Waters project collection (sample)', r.identifier, String(r.year ?? ''), r.creator || r.photographer || '', r.rights, 'Sample catalogue entry']);
    if (type === 'testimony') await q(`INSERT INTO consent_records (story_id, storyteller, consent_type, consent_date, validated_at) VALUES ($1,$2,'Signed form', now()::date, now())`, [s.id, r.narrator || 'Storyteller']);
    // A little sample engagement, so trending, counts and comments have something to show.
    for (let k = 0; k < contributors.length; k++) {
      if ((n + k) % 3 === 0) await q(`INSERT INTO reactions (story_id, user_id, type) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [s.id, contributors[k], ['heart', 'heartbreak', 'heart', 'laugh'][(n + k) % 4]]);
      if ((n + k) % 5 === 0) await q(`INSERT INTO favourites (story_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [s.id, contributors[k]]);
    }
    if (n % 2 === 0) {
      const [c] = await rows(`INSERT INTO comments (story_id, author_id, body, language) VALUES ($1,$2,$3,'en') RETURNING id`, [s.id, author(n + 1), 'Thank you for sharing this. We tell the same thing to the young crews on our beach.']);
      await q(`INSERT INTO comments (story_id, author_id, parent_id, body, language) VALUES ($1,$2,$3,$4,'en')`, [s.id, author(n + 2), c.id, 'True. My uncle used to say it every morning before we pushed off.']);
    }
    n++;
  }
  await q(`UPDATE stories s SET hearts = (SELECT count(*) FROM reactions r WHERE r.story_id = s.id AND r.type = 'heart'), heartbreaks = (SELECT count(*) FROM reactions r WHERE r.story_id = s.id AND r.type = 'heartbreak'),
    laughs = (SELECT count(*) FROM reactions r WHERE r.story_id = s.id AND r.type = 'laugh'), favourite_count = (SELECT count(*) FROM favourites f WHERE f.story_id = s.id), comment_count = (SELECT count(*) FROM comments c WHERE c.story_id = s.id AND c.status = 'published')`);
  await q(`UPDATE stories SET trending_score = ((hearts + heartbreaks + laughs) * 3 + comment_count * 4 + favourite_count * 4 + view_count * 0.2 + 1) / power(extract(epoch FROM (now() - published_at)) / 3600 + 2, 1.5)`);
  await q(`INSERT INTO follows (follower_id, followee_id) VALUES ($1,$2), ($1,$3) ON CONFLICT DO NOTHING`, [contributors[0], contributors[1], contributors[2]]);

  const [col] = await rows(`INSERT INTO collections (title, description, kind, status, published_at, created_by) VALUES ('Likoni Ferry Stories (sample)', 'Stories, records and photographs about the Likoni and Mtongwe crossings.', 'collection', 'published', now(), $1) RETURNING id`, [admins[0] ?? null]);
  await q(`INSERT INTO collection_items (collection_id, story_id, position) SELECT $1, id, row_number() OVER (ORDER BY published_at) FROM stories WHERE county = 'Mombasa'`, [col.id]);
  await q(`INSERT INTO resources (slug, title, type, summary, body, audience, language, created_by) VALUES
    ('contributor-handbook', 'Contributor handbook (draft)', 'handbook', 'How to upload materials, document stories and use the archive.', $2, 'General public', 'en', $1),
    ('life-jackets-learning-summary', 'Why life jackets go unused: a learning summary (sample)', 'learning_summary', 'What the stories collected so far say about life jackets on ferries and small boats.', 'Sample learning summary. The project team will replace this text with the published summary.', 'Policymakers', 'en', $1)
    ON CONFLICT (slug) DO NOTHING`, [admins[0] ?? null, 'This draft handbook explains, step by step, how to share a story, how to record audio and video, how to name files, and how consent is recorded.\n\nThe final handbook, with screenshots of the platform, is published here at go-live.']);
  await q(`INSERT INTO announcements (title, summary, description, dates, created_by) VALUES ('Welcome to Remembering the Waters', 'The archive is open for testing.', 'Thank you for helping to test the archive. Share a story, react, comment and tell us what to improve.', $2, $1)`,
    [admins[0] ?? null, JSON.stringify([{ date: new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10), endDate: null, label: 'Community feedback session' }])]);
  await q(`INSERT INTO analytics_daily (day, metric, value) SELECT (published_at AT TIME ZONE 'Africa/Nairobi')::date, 'story.published', count(*) FROM stories GROUP BY 1 ON CONFLICT (day, metric) DO UPDATE SET value = EXCLUDED.value`);
  await q(`INSERT INTO analytics_daily (day, metric, value) SELECT (published_at AT TIME ZONE 'Africa/Nairobi')::date, 'flag.green', count(*) FROM stories GROUP BY 1 ON CONFLICT (day, metric) DO UPDATE SET value = EXCLUDED.value`);
  await q(`INSERT INTO activity_log (actor_name, action, summary, details) VALUES ('System', 'seed', 'Sample content loaded', $1)`, [JSON.stringify({ stories: n })]);
  log(`Sample content ready: ${n} stories, ${Object.keys(incidents).length} incident records, ${PLACES.length} places.`);
}

if (require.main === module) {
  AppDataSource.initialize()
    .then((ds) => seed(ds).then(() => ds.destroy()))
    .catch((e) => { console.error('Seeding failed:', e.message); process.exit(1); });
}
