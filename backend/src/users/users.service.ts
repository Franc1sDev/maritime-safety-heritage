import { Injectable, OnModuleInit } from '@nestjs/common';
import { tmpdir } from 'os';
import { join } from 'path';
import { AuthService } from '../auth/auth.service';
import { Audit } from '../common/audit.service';
import { Db } from '../common/db';
import { AuthUser, RequestMeta } from '../common/decorators';
import { Jobs } from '../common/jobs.service';
import { DELETION_REASONS, fail, text } from '../common/messages';
import { Notify } from '../common/notify.service';
import { ZipWriter } from '../common/zip';
import { MediaService } from '../media/media.service';
import { mergeSettings, personSql } from './profile';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(private readonly db: Db, private readonly audit: Audit, private readonly notify: Notify, private readonly jobs: Jobs, private readonly media: MediaService, private readonly auth: AuthService) {}

  onModuleInit() {
    this.jobs.handle('user.export', async ({ exportId }) => { await this.buildExport(exportId); });
    this.jobs.every('users.purge', 3600_000, () => this.purge());
    this.jobs.every('reminders.due', 60_000, () => this.fireReminders());
  }

  /** A Contributor's public profile. */
  async profile(usernameOrId: string, viewer?: AuthUser | null) {
    const byId = /^[0-9a-f]{8}-/i.test(usernameOrId);
    const u = await this.db.one(
      `SELECT u.id, u.created_at, ${personSql('u', 'ap')} AS card,
              (SELECT count(*)::int FROM stories s WHERE s.author_id = u.id AND s.status = 'published' AND s.posted_as IN ('self','told_by')) AS stories,
              (SELECT count(*)::int FROM follows f WHERE f.followee_id = u.id) AS followers, (SELECT count(*)::int FROM follows f WHERE f.follower_id = u.id) AS following,
              EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $2::uuid AND f.followee_id = u.id) AS followed,
              EXISTS (SELECT 1 FROM blocks b WHERE b.user_id = $2::uuid AND b.target_id = u.id AND b.kind = 'block') AS blocked,
              EXISTS (SELECT 1 FROM blocks b WHERE b.user_id = $2::uuid AND b.target_id = u.id AND b.kind = 'mute') AS muted,
              EXISTS (SELECT 1 FROM blocks b WHERE b.user_id = u.id AND b.target_id = $2::uuid AND b.kind = 'block') AS blocked_me
         FROM users u LEFT JOIN admin_profiles ap ON ap.user_id = u.id
        WHERE ${byId ? 'u.id = $1::uuid' : 'lower(u.username) = lower($1)'} AND u.status IN ('active','warned','suspended')`, [usernameOrId, viewer?.id ?? null]);
    if (!u || u.blockedMe) return fail(404, 'not_found');
    return { ...u.card, stories: u.stories, followers: u.followers, following: u.following, joinedAt: u.createdAt, viewer: { following: u.followed, blocked: u.blocked, muted: u.muted, own: viewer?.id === u.id } };
  }

  /** The Contributors tab: everyone who has posted at least one story, with search as the user types. */
  async contributors(q: string | undefined, viewer?: AuthUser | null) {
    const term = (q ?? '').trim().replace(/^@/, '');
    return this.db.q(
      `SELECT ${personSql('u', 'ap')} AS person, count(s.id)::int AS stories FROM users u LEFT JOIN admin_profiles ap ON ap.user_id = u.id
         JOIN stories s ON s.author_id = u.id AND s.status = 'published' AND s.posted_as IN ('self','told_by')
        WHERE u.role = 'contributor' AND u.status IN ('active','warned','suspended') AND ($1 = '' OR strpos(lower(u.username), lower($1)) > 0 OR (u.use_provider_identity AND strpos(lower(u.provider_name), lower($1)) > 0))
          AND ($2::uuid IS NULL OR NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id = $2 AND b.target_id = u.id) OR (b.user_id = u.id AND b.target_id = $2 AND b.kind = 'block')))
        GROUP BY u.id, ap.user_id ORDER BY (lower(u.username) = lower($1)) DESC, count(s.id) DESC, u.username LIMIT 50`, [term, viewer?.id ?? null]);
  }
  /** People to tag, as @username is typed. */
  async mentionSearch(q: string, viewer: AuthUser) {
    return this.db.q(`SELECT ${personSql('u', 'ap')} AS person FROM users u LEFT JOIN admin_profiles ap ON ap.user_id = u.id WHERE u.status IN ('active','warned') AND strpos(lower(u.username), lower($1)) = 1 AND u.id <> $2 ORDER BY u.username LIMIT 8`, [q.replace(/^@/, ''), viewer.id]);
  }

  async saveSettings(user: AuthUser, patch: Record<string, any>, meta: RequestMeta) {
    const u = await this.db.one(`SELECT settings FROM users WHERE id = $1`, [user.id]);
    const cur = mergeSettings(u?.settings);
    const next = mergeSettings({ ...cur, ...patch, notifications: { ...cur.notifications, ...(patch.notifications ?? {}) }, quietHours: { ...cur.quietHours, ...(patch.quietHours ?? {}) } });
    const set = ['settings = $2']; const params: unknown[] = [user.id, JSON.stringify(next)];
    if (patch.language) { params.push(patch.language); set.push(`language = $${params.length}`); }
    if (patch.theme) { params.push(patch.theme); set.push(`theme = $${params.length}`); }
    await this.db.q(`UPDATE users SET ${set.join(', ')}, updated_at = now() WHERE id = $1`, params);
    return { user: await this.auth.me(user.id), message: text('settings_saved', patch.language ?? meta.lang) };
  }

  // ----- follow, block, mute -----
  async follow(user: AuthUser, targetId: string, on: boolean) {
    if (targetId === user.id) return fail(400, 'invalid_input');
    const t = await this.profile(targetId, user);
    if (t.viewer.blocked) return fail(403, 'blocked_interaction');
    if (on) {
      const r = await this.db.q(`INSERT INTO follows (follower_id, followee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING follower_id`, [user.id, targetId]);
      if (r.length) await this.notify.send(targetId, { group: 'engagement', kind: 'follow', title: `${user.name} started following you`, link: `/contributors/${user.username}` });
      // Following someone accepts their message requests.
      await this.db.q(`UPDATE conversation_members m SET is_request = false FROM conversations c WHERE c.id = m.conversation_id AND m.user_id = $1 AND c.direct_key = $2`, [user.id, [user.id, targetId].sort().join(':')]);
    } else await this.db.q(`DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2`, [user.id, targetId]);
    return { following: on };
  }
  async following(user: AuthUser) { return this.db.q(`SELECT ${personSql('u', 'ap')} AS person FROM follows f JOIN users u ON u.id = f.followee_id LEFT JOIN admin_profiles ap ON ap.user_id = u.id WHERE f.follower_id = $1 ORDER BY f.created_at DESC`, [user.id]); }

  /** A blocked user cannot view, comment on, react to or message the user who blocked them. Muting only quietens their notifications. */
  async block(user: AuthUser, targetId: string, kind: 'block' | 'mute', on: boolean, meta: RequestMeta) {
    if (targetId === user.id) return fail(400, 'invalid_input');
    const t = await this.db.one(`SELECT id, username, role FROM users WHERE id = $1`, [targetId]);
    if (!t) return fail(404, 'not_found');
    if (t.role !== 'contributor') return fail(403, 'forbidden');
    if (on) {
      await this.db.q(`INSERT INTO blocks (user_id, target_id, kind) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [user.id, targetId, kind]);
      if (kind === 'block') await this.db.q(`DELETE FROM follows WHERE (follower_id = $1 AND followee_id = $2) OR (follower_id = $2 AND followee_id = $1)`, [user.id, targetId]);
    } else await this.db.q(`DELETE FROM blocks WHERE user_id = $1 AND target_id = $2 AND kind = $3`, [user.id, targetId, kind]);
    return { [kind === 'block' ? 'blocked' : 'muted']: on, message: on ? text(kind === 'block' ? 'user_blocked' : 'user_muted', meta.lang, { name: t.username }) : '' };
  }
  async blocked(user: AuthUser) { return this.db.q(`SELECT b.kind, b.created_at, ${personSql('u', 'ap')} AS person FROM blocks b JOIN users u ON u.id = b.target_id LEFT JOIN admin_profiles ap ON ap.user_id = u.id WHERE b.user_id = $1 ORDER BY b.created_at DESC`, [user.id]); }

  // ----- deleting the account -----
  /** The account and its content are hidden at once and permanently erased after a 30-day recovery period. */
  async deleteAccount(user: AuthUser, dto: { reason?: string; otherReason?: string }, meta: RequestMeta) {
    if (!DELETION_REASONS.some((r) => r.key === dto.reason) && !dto.otherReason?.trim()) return fail(400, 'deletion_reason_required');
    if (user.role === 'super_admin') {
      const others = await this.db.one(`SELECT count(*)::int AS n FROM users WHERE role = 'super_admin' AND status = 'active' AND id <> $1`, [user.id]);
      if (!others?.n) return fail(409, 'last_super_admin');
    }
    const reason = [DELETION_REASONS.find((r) => r.key === dto.reason)?.en, dto.otherReason?.trim()].filter(Boolean).join(' – ');
    await this.db.q(`UPDATE users SET status = 'deleted', deleted_at = now(), purge_at = now() + interval '30 days', deletion_reason = $2 WHERE id = $1`, [user.id, reason.slice(0, 600)]);
    await this.db.q(`UPDATE stories SET status = 'deleted', deleted_at = now(), purge_at = now() + interval '30 days', removed_reason = 'account_deleted' WHERE author_id = $1 AND status = 'published' AND posted_as <> 'company'`, [user.id]);
    await this.auth.revokeAll(user.id);
    await this.db.q(`DELETE FROM push_tokens WHERE user_id = $1`, [user.id]);
    await this.audit.record({ actor: user, action: 'account.delete', entityType: 'user', entityId: user.id, summary: `${user.name} deleted their account`, reason, ip: meta.ip });
    return { message: text('account_deleted', meta.lang) };
  }

  /** After 30 days: stories, media, comments, messages and personal details are erased for good. */
  async purge() {
    const rows = await this.db.q(`SELECT id FROM users WHERE status IN ('deleted','removed') AND purge_at IS NOT NULL AND purge_at < now() LIMIT 50`);
    for (const u of rows) {
      for (const m of await this.db.q(`SELECT m.* FROM media_files m WHERE m.owner_id = $1 OR m.story_id IN (SELECT id FROM stories WHERE author_id = $1)`, [u.id])) await this.media.removeObjects(m);
      await this.db.q(`DELETE FROM media_files WHERE owner_id = $1`, [u.id]);
      await this.db.q(`DELETE FROM stories WHERE author_id = $1 AND posted_as <> 'company'`, [u.id]);
      await this.db.q(`DELETE FROM comments WHERE author_id = $1`, [u.id]);
      await this.db.q(`DELETE FROM dm_messages WHERE sender_id = $1`, [u.id]);
      // Reports and moderation decisions are kept but anonymised.
      await this.db.q(`UPDATE reports SET reporter_id = NULL WHERE reporter_id = $1`, [u.id]);
      await this.db.q(`DELETE FROM users WHERE id = $1`, [u.id]);
    }
    await this.db.q(`DELETE FROM refresh_tokens WHERE expires_at < now() - interval '7 days'`);
    await this.db.q(`DELETE FROM mfa_codes WHERE expires_at < now() - interval '1 day'`);
    await this.db.q(`DELETE FROM jobs WHERE status = 'done' AND finished_at < now() - interval '7 days'`);
    return rows.length;
  }

  // ----- download my data -----
  async requestExport(user: AuthUser, meta: RequestMeta) {
    const e = (await this.db.one(`INSERT INTO data_exports (user_id) VALUES ($1) RETURNING id`, [user.id]))!;
    await this.jobs.add('user.export', { exportId: e.id });
    return { id: e.id, message: text('export_preparing', meta.lang) };
  }
  async exports(user: AuthUser) {
    const rows = await this.db.q(`SELECT id, status, media_id, created_at FROM data_exports WHERE user_id = $1 AND kind = 'my_data' ORDER BY created_at DESC LIMIT 5`, [user.id]);
    return rows.map((e) => ({ id: e.id, status: e.status, createdAt: e.createdAt, url: e.status === 'ready' && e.mediaId ? `${this.media.link(e.mediaId, 'original')}&download=1` : null }));
  }
  private async buildExport(exportId: string) {
    const e = await this.db.one(`SELECT * FROM data_exports WHERE id = $1 AND status = 'preparing'`, [exportId]);
    if (!e) return;
    try {
      const u = await this.db.one(`SELECT id, username, provider, provider_name, email, language, theme, settings, created_at FROM users WHERE id = $1`, [e.userId]);
      const stories = await this.db.q(`SELECT id, code, type, posted_as, told_by, title, body, language, place_name, event_date, category, vessel, tags, rights, status, ai_flag, published_at, created_at, hearts, heartbreaks, laughs, comment_count, share_count, view_count FROM stories WHERE author_id = $1 AND status <> 'deleted'`, [e.userId]);
      const comments = await this.db.q(`SELECT c.id, c.body, c.created_at, s.code AS story FROM comments c JOIN stories s ON s.id = c.story_id WHERE c.author_id = $1 AND c.status <> 'deleted'`, [e.userId]);
      const messages = await this.db.q(`SELECT conversation_id, body, created_at FROM dm_messages WHERE sender_id = $1 AND status = 'sent'`, [e.userId]);
      const reminders = await this.db.q(`SELECT subject, description, due_at, done_at FROM reminders WHERE user_id = $1`, [e.userId]);
      const path = join(tmpdir(), `msh-export-${exportId}.zip`);
      const zip = new ZipWriter(path);
      const json = (v: unknown) => Buffer.from(JSON.stringify(v, null, 2), 'utf8');
      await zip.add('my-data/profile.json', json(u));
      await zip.add('my-data/stories.json', json(stories));
      await zip.add('my-data/comments.json', json(comments));
      await zip.add('my-data/messages.json', json(messages));
      await zip.add('my-data/reminders.json', json(reminders));
      for (const m of await this.db.q(`SELECT m.*, s.code FROM media_files m JOIN stories s ON s.id = m.story_id WHERE s.author_id = $1 AND s.status <> 'deleted'`, [e.userId])) {
        await zip.add(`my-data/media/${m.code}/${m.originalName}`, (await this.media.openKey(m.storageKey, m.encrypted)).stream);
      }
      await zip.close();
      const file = await this.media.storeGenerated(path, { ownerId: e.userId, purpose: 'export', name: 'my-data.zip', mime: 'application/zip' });
      await this.db.q(`UPDATE data_exports SET status = 'ready', media_id = $2 WHERE id = $1`, [exportId, file.id]);
      await this.notify.send(e.userId, { group: 'account', kind: 'export.ready', title: text('export_ready', u?.language), link: '/profile/data' });
    } catch (err) { await this.db.q(`UPDATE data_exports SET status = 'failed' WHERE id = $1`, [exportId]); throw err; }
  }

  // ----- notifications -----
  async notifications(user: AuthUser, onlyPriority = false) {
    const items = await this.db.q(`SELECT * FROM notifications WHERE user_id = $1 AND ($2 = false OR (priority AND done_at IS NULL)) ORDER BY (priority AND done_at IS NULL) DESC, created_at DESC LIMIT 100`, [user.id, onlyPriority]);
    return { items, counts: await this.notify.counts(user.id) };
  }
  async readNotifications(user: AuthUser, id?: string) {
    await this.db.q(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL AND ($2::uuid IS NULL OR id = $2)`, [user.id, id ?? null]);
    // Opening a notice that has no further step completes it.
    if (id) await this.db.q(`UPDATE notifications SET done_at = now() WHERE id = $1 AND user_id = $2 AND action_key IS NULL AND done_at IS NULL`, [id, user.id]);
    return this.notify.counts(user.id);
  }
  async pushToken(user: AuthUser, platform: 'android' | 'ios' | 'web', token: string) {
    await this.db.q(`DELETE FROM push_tokens WHERE md5(token) = md5($1)`, [token]);
    await this.db.q(`INSERT INTO push_tokens (user_id, platform, token) VALUES ($1,$2,$3)`, [user.id, platform, token]);
    return { ok: true };
  }
  async removePushToken(user: AuthUser, token: string) { await this.db.q(`DELETE FROM push_tokens WHERE user_id = $1 AND md5(token) = md5($2)`, [user.id, token]); return { ok: true }; }

  // ----- reminders -----
  reminders(user: AuthUser) { return this.db.q(`SELECT id, subject, description, due_at, fired_at, done_at, created_at FROM reminders WHERE user_id = $1 ORDER BY (done_at IS NOT NULL), due_at`, [user.id]); }
  async saveReminder(user: AuthUser, dto: { subject: string; description?: string; dueAt: string }, id: string | undefined, meta: RequestMeta) {
    const due = new Date(dto.dueAt);
    if (Number.isNaN(due.getTime())) return fail(400, 'invalid_input');
    const r = id
      ? await this.db.one(`UPDATE reminders SET subject = $3, description = $4, due_at = $5, fired_at = CASE WHEN $5 > now() THEN NULL ELSE fired_at END, updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING *`, [id, user.id, dto.subject.trim(), dto.description ?? '', due])
      : await this.db.one(`INSERT INTO reminders (user_id, subject, description, due_at) VALUES ($1,$2,$3,$4) RETURNING *`, [user.id, dto.subject.trim(), dto.description ?? '', due]);
    if (!r) return fail(404, 'not_found');
    return { ...r, message: text('reminder_saved', meta.lang) };
  }
  async reminderDone(user: AuthUser, id: string, done: boolean) {
    await this.db.q(`UPDATE reminders SET done_at = CASE WHEN $3 THEN now() ELSE NULL END WHERE id = $1 AND user_id = $2`, [id, user.id, done]);
    if (done) await this.notify.done(`reminder:${id}`);
    return { ok: true };
  }
  async deleteReminder(user: AuthUser, id: string) { await this.db.q(`DELETE FROM reminders WHERE id = $1 AND user_id = $2`, [id, user.id]); await this.notify.done(`reminder:${id}`); return { ok: true }; }
  async fireReminders() {
    const due = await this.db.q(`UPDATE reminders SET fired_at = now() WHERE fired_at IS NULL AND done_at IS NULL AND due_at <= now() RETURNING id, user_id, subject, description`);
    for (const r of due) await this.notify.send(r.userId, { group: 'reminders', kind: 'reminder.due', title: r.subject, body: r.description, link: '/profile/reminders', priority: true, actionKey: `reminder:${r.id}` });
    return due.length;
  }
}
