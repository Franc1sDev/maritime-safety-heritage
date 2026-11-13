import { readFileSync } from 'fs';
import { join } from 'path';
import { DataSource, In } from 'typeorm';
import { config } from '../config/config';
import { hashPassword, PASSWORD_RULE, slugify } from '../common/crypto';
import { buildSearchText } from '../common/search-text';
import { AppDataSource } from './data-source';
import { Activity, ArchiveRecord, ContactMessage, Subject, Submission, TranscriptSegment, User, WaterBody } from './entities';

export const WATER_BODIES: Array<Pick<WaterBody, 'name' | 'kind' | 'latitude' | 'longitude'>> = [
  { name: 'Indian Ocean coast', kind: 'ocean', latitude: -4.05, longitude: 39.67 },
  { name: 'Lake Victoria', kind: 'lake', latitude: -0.3, longitude: 34.3 },
  { name: 'Lake Turkana', kind: 'lake', latitude: 3.6, longitude: 36.1 },
  { name: 'Lake Naivasha', kind: 'lake', latitude: -0.77, longitude: 36.35 },
  { name: 'Lake Baringo', kind: 'lake', latitude: 0.63, longitude: 36.08 },
  { name: 'Rivers', kind: 'river', latitude: null, longitude: null },
];

interface SampleData {
  records: Array<Record<string, any>>;
  users: Array<{ name: string; email: string; password: string; role: 'user' | 'admin'; status: 'active' | 'suspended'; organisation: string }>;
  submissions: Array<Record<string, any>>;
  messages: Array<Record<string, any>>;
}

export async function seed(ds: DataSource, opts = { sample: config.seed.sampleData, log: console.log as (m: string) => void }) {
  const { log } = opts;
  const wbRepo = ds.getRepository(WaterBody);
  for (const wb of WATER_BODIES) {
    if (!(await wbRepo.findOneBy({ name: wb.name }))) await wbRepo.save(wbRepo.create(wb));
  }
  const users = ds.getRepository(User);

  // First admin account
  const adminEmail = config.seed.adminEmail.trim().toLowerCase();
  if (!(await users.findOneBy({ email: adminEmail }))) {
    const pw = config.seed.adminPassword;
    if (!PASSWORD_RULE.test(pw) || pw.startsWith('change-me')) {
      throw new Error('Set SEED_ADMIN_PASSWORD in .env (8+ characters, letters and numbers) before seeding.');
    }
    await users.save(users.create({ name: 'Archive administrator', email: adminEmail, passwordHash: await hashPassword(pw), role: 'admin', organisation: 'Remembering the Waters' }));
    log(`Created admin account ${adminEmail}`);
  }

  if (!opts.sample) return;
  if ((await ds.getRepository(ArchiveRecord).count({ withDeleted: true })) > 0) {
    log('Archive already has records; sample data skipped.');
    return;
  }
  const data: SampleData = JSON.parse(readFileSync(join(__dirname, 'sample-data.json'), 'utf8'));

  // Demo accounts are for development and showcases only
  if (!config.isProd) {
    for (const u of data.users) {
      const email = u.email.toLowerCase();
      if (await users.findOneBy({ email })) continue;
      await users.save(users.create({ name: u.name, email, passwordHash: await hashPassword(u.password), role: u.role, status: u.status, organisation: u.organisation }));
    }
    log(`Demo accounts ready (${data.users.length}).`);
  }

  const subjRepo = ds.getRepository(Subject);
  const labels = [...new Set(data.records.flatMap((r) => r.subjects as string[]))];
  for (const label of labels) {
    const slug = slugify(label);
    if (!(await subjRepo.findOneBy({ slug }))) await subjRepo.save(subjRepo.create({ slug, label }));
  }
  const subjects = await subjRepo.findBy({ slug: In(labels.map(slugify)) });
  const wbs = await wbRepo.find();
  const recRepo = ds.getRepository(ArchiveRecord);
  const byIdentifier: Record<string, string> = {};

  for (const r of data.records) {
    const added = new Date(r.added);
    const wb = wbs.find((w) => w.name === r.waterBody) ?? null;
    const rec = recRepo.create({
      type: r.type, format: r.format, title: r.title, summary: r.summary, body: r.body, year: r.year,
      waterBodyId: wb?.id ?? null, waterBody: wb, county: r.county, place: r.place, latitude: r.latitude, longitude: r.longitude,
      creator: r.creator, narrator: r.narrator, interviewer: r.interviewer, photographer: r.photographer,
      language: r.language, rights: r.rights, consent: r.consent, durationSeconds: r.durationSeconds,
      status: r.status, views: r.views, publishedAt: r.status === 'published' ? added : null, createdAt: added,
      subjects: subjects.filter((s) => (r.subjects as string[]).map(slugify).includes(s.slug)),
      transcript: (r.transcript as Array<{ startSeconds: number; text: string }>).map((t, i) =>
        Object.assign(new TranscriptSegment(), { position: i, startSeconds: t.startSeconds, text: t.text })),
    });
    rec.searchText = buildSearchText({ ...rec, identifier: r.identifier });
    const saved = await recRepo.save(rec);
    const fresh = await recRepo.findOneByOrFail({ id: saved.id });
    byIdentifier[r.identifier] = fresh.identifier;
  }
  log(`Sample records added (${data.records.length}).`);

  const subRepo = ds.getRepository(Submission);
  for (const s of data.submissions) {
    const by = await users.findOneBy({ email: String(s.by).toLowerCase() });
    if (!by) continue;
    await subRepo.save(subRepo.create({
      submittedById: by.id, type: s.type, title: s.title, description: s.description, year: s.year,
      waterBodyId: wbs.find((w) => w.name === s.waterBody)?.id ?? null, place: s.place, consentConfirmed: true,
      status: s.status, reviewNote: s.reviewNote, createdAt: new Date(s.date),
      reviewedAt: s.status === 'pending' ? null : new Date(s.date),
    }));
  }
  const msgRepo = ds.getRepository(ContactMessage);
  for (const m of data.messages) {
    await msgRepo.save(msgRepo.create({ name: m.name, email: m.email, subject: m.subject, body: m.body, read: m.read, createdAt: new Date(m.date) }));
  }
  await ds.getRepository(Activity).save({ action: 'seed', actorName: 'System', summary: 'Sample content loaded', details: { records: data.records.length } });
  log('Sample submissions and messages added.');
}

if (require.main === module) {
  AppDataSource.initialize()
    .then((ds) => seed(ds).then(() => ds.destroy()))
    .catch((e) => {
      console.error('Seeding failed:', e.message);
      process.exit(1);
    });
}
