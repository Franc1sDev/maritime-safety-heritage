import { Injectable, Logger } from '@nestjs/common';
import { createSign } from 'crypto';
import { config } from '../config/config';
import { Db } from './db';
import { MailService } from './mail.service';
import { Realtime } from './realtime.gateway';

export type NoticeGroup = 'moderation' | 'account' | 'engagement' | 'messages' | 'announcements' | 'reminders';
/** Moderation and account notices cannot be switched off (Section 2.9). */
const FORCED: NoticeGroup[] = ['moderation', 'account'];
export interface Notice {
  group: NoticeGroup;
  kind: string;
  title: string;
  body?: string;
  link?: string;
  data?: Record<string, unknown>;
  /** Needs the person's action: shown as a floating notification on sign-in until acted on. */
  priority?: boolean;
  /** Completing the action with this key clears the notice for everyone holding it. */
  actionKey?: string;
  email?: boolean;
}
const DEFAULT_CHANNELS = { inApp: true, push: true, email: false };

function inQuietHours(q: { from?: string; to?: string } | undefined, now = new Date()): boolean {
  if (!q?.from || !q?.to) return false;
  const local = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
  const mins = local.getHours() * 60 + local.getMinutes();
  const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const a = toMin(q.from), b = toMin(q.to);
  return a <= b ? mins >= a && mins < b : mins >= a || mins < b;
}

/** In-app, push and email notifications, honouring each person's choices and quiet hours. */
@Injectable()
export class Notify {
  private readonly log = new Logger('Notify');
  private fcmToken?: { value: string; exp: number };
  constructor(private readonly db: Db, private readonly live: Realtime, private readonly mail: MailService) {}

  async send(userId: string, n: Notice): Promise<void> {
    const u = await this.db.one(`SELECT id, email, settings, status FROM users WHERE id = $1`, [userId]);
    if (!u || ['deleted', 'removed'].includes(u.status)) return;
    const forced = FORCED.includes(n.group);
    const ch = forced ? { inApp: true, push: true, email: !!n.email } : { ...DEFAULT_CHANNELS, ...(u.settings?.notifications?.[n.group] ?? {}) };
    if (!ch.inApp && !ch.push && !ch.email) return;
    let row: any = null;
    if (ch.inApp || n.priority) {
      row = await this.db.one(
        `INSERT INTO notifications (user_id, kind, title, body, link, data, priority, action_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [userId, n.kind, n.title, n.body ?? '', n.link ?? '', JSON.stringify({ group: n.group, ...(n.data ?? {}) }), !!n.priority, n.actionKey ?? null]);
      this.live.toUser(userId, 'notification', row);
      await this.pushCounts(userId);
    }
    const quiet = !n.priority && !forced && inQuietHours(u.settings?.quietHours);
    if (ch.push && !quiet) void this.push(userId, n.title, n.body ?? '', n.link ?? '', !!n.priority).catch((e) => this.log.warn(`Push failed: ${e.message}`));
    if ((ch.email || n.email) && u.email && this.mail.enabled) {
      void this.mail.send(u.email, n.title, `${n.body ?? ''}\n\n${n.link ? config.siteUrl + n.link : config.siteUrl}\n`);
    }
  }

  async sendMany(userIds: string[], n: Notice) { for (const id of new Set(userIds)) await this.send(id, n); }

  async admins(n: Notice, except?: string) {
    const rows = await this.db.q(`SELECT id FROM users WHERE role = 'admin' AND status = 'active'`);
    await this.sendMany(rows.map((r) => r.id).filter((id) => id !== except), n);
  }
  async superAdmins(n: Notice) {
    const rows = await this.db.q(`SELECT id FROM users WHERE role = 'super_admin' AND status = 'active'`);
    await this.sendMany(rows.map((r) => r.id), n);
  }

  /** The action is complete: its pinned notices go away for everyone who had one. */
  async done(actionKey: string, onlyUserId?: string) {
    const rows = await this.db.q(
      `UPDATE notifications SET done_at = now(), read_at = coalesce(read_at, now()) WHERE action_key = $1 AND done_at IS NULL AND ($2::uuid IS NULL OR user_id = $2) RETURNING user_id`,
      [actionKey, onlyUserId ?? null]);
    for (const id of new Set(rows.map((r) => r.userId))) { this.live.toUser(id, 'notification.done', { actionKey }); await this.pushCounts(id); }
  }

  async counts(userId: string) {
    const r = await this.db.one(
      `SELECT (SELECT count(*)::int FROM notifications WHERE user_id = $1 AND read_at IS NULL) AS notifications,
              (SELECT count(*)::int FROM notifications WHERE user_id = $1 AND priority AND done_at IS NULL) AS priority,
              (SELECT count(*)::int FROM announcements a WHERE a.deleted_at IS NULL AND a.sort_at >= (SELECT created_at FROM users WHERE id = $1) - interval '30 days'
                 AND NOT EXISTS (SELECT 1 FROM announcement_reads r WHERE r.announcement_id = a.id AND r.user_id = $1 AND r.read_at >= a.sort_at)) AS announcements,
              (SELECT count(*)::int FROM dm_messages m JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = $1
                 WHERE m.status = 'sent' AND m.sender_id IS DISTINCT FROM $1 AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)) AS inbox`, [userId]);
    return r ?? { notifications: 0, priority: 0, announcements: 0, inbox: 0 };
  }
  /** Sends the person's fresh unread counts to their open screens. */
  async pushCounts(userId: string) { this.live.toUser(userId, 'counts', await this.counts(userId)); }

  // ----- push delivery -----
  get pushConfig() { return { vapidPublicKey: config.push.vapidPublic || null, fcm: !!config.push.fcmServiceAccount }; }

  private async push(userId: string, title: string, body: string, link: string, priority: boolean) {
    const tokens = await this.db.q(`SELECT id, platform, token FROM push_tokens WHERE user_id = $1`, [userId]);
    for (const t of tokens) {
      try {
        const ok = t.platform === 'web' ? await this.webPush(t.token, title, body, link) : await this.fcm(t.token, title, body, link, priority);
        if (ok === 'gone') await this.db.q(`DELETE FROM push_tokens WHERE id = $1`, [t.id]);
        else if (ok) await this.db.q(`UPDATE push_tokens SET last_used_at = now() WHERE id = $1`, [t.id]);
      } catch (e) { this.log.warn(`Push to ${t.platform} failed: ${(e as Error).message}`); }
    }
  }

  private async webPush(subscription: string, title: string, body: string, link: string): Promise<boolean | 'gone'> {
    if (!config.push.vapidPublic || !config.push.vapidPrivate) return false;
    const webpush = await import('web-push');
    try {
      await webpush.sendNotification(JSON.parse(subscription), JSON.stringify({ title, body, link }), {
        vapidDetails: { subject: config.push.vapidSubject, publicKey: config.push.vapidPublic, privateKey: config.push.vapidPrivate }, TTL: 86400,
      });
      return true;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) return 'gone';
      throw e;
    }
  }

  /** Firebase Cloud Messaging (HTTP v1) for Android and iOS, authorised with the service account. */
  private async fcm(token: string, title: string, body: string, link: string, priority: boolean): Promise<boolean | 'gone'> {
    if (!config.push.fcmServiceAccount) return false;
    const sa = JSON.parse(config.push.fcmServiceAccount) as { client_email: string; private_key: string; project_id: string };
    if (!this.fcmToken || this.fcmToken.exp < Date.now() + 60_000) {
      const now = Math.floor(Date.now() / 1000);
      const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
      const jwt = `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url')}`;
      const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }), signal: AbortSignal.timeout(15_000) });
      const j = await r.json() as { access_token?: string; expires_in?: number };
      if (!j.access_token) throw new Error('FCM authorisation failed');
      this.fcmToken = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
    }
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST', headers: { Authorization: `Bearer ${this.fcmToken.value}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ message: { token, notification: { title, body }, data: { link, priority: String(priority) }, android: { priority: priority ? 'HIGH' : 'NORMAL' } } }),
    });
    if (r.status === 404 || r.status === 400) return 'gone';
    if (!r.ok) throw new Error(`FCM answered ${r.status}`);
    return true;
  }
}
