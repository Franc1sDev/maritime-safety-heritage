import { Injectable } from '@nestjs/common';
import { Ai, AiUnavailable } from '../ai/ai.service';
import { Db, decodeCursor, encodeCursor, pageSize, Row } from '../common/db';
import { AuthUser, isTeam, RequestMeta } from '../common/decorators';
import { fail, text } from '../common/messages';
import { Notify } from '../common/notify.service';
import { Realtime } from '../common/realtime.gateway';
import { MediaService } from '../media/media.service';
import { personSql } from '../users/profile';

/**
 * INBOX: direct messages with admins and other Contributors. Conversations are grouped by sender or by issue
 * (e.g. "Story MS-2026-00918 issue", "Account help"). Messages from people the user does not follow arrive as requests.
 */
@Injectable()
export class InboxService {
  constructor(private readonly db: Db, private readonly ai: Ai, private readonly notify: Notify, private readonly live: Realtime, private readonly media: MediaService) {}

  private async member(conversationId: string, user: AuthUser) {
    const c = await this.db.one(`SELECT c.*, m.user_id AS member, m.is_request, m.last_read_at FROM conversations c LEFT JOIN conversation_members m ON m.conversation_id = c.id AND m.user_id = $2 WHERE c.id = $1`, [conversationId, user.id]);
    if (!c) return fail(404, 'not_found');
    if (!c.member) {
      // Any admin can open a conversation addressed to the admins.
      if (!(c.withAdmins && user.role === 'admin')) return fail(404, 'not_found');
      await this.db.q(`INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [conversationId, user.id]);
    }
    return c;
  }

  async list(user: AuthUser) {
    const rows = await this.db.q(
      `SELECT c.id, c.kind, c.topic, c.issue_type, c.issue_ref, c.with_admins, c.last_message_at, m.is_request, m.last_read_at,
              (SELECT count(*)::int FROM dm_messages x WHERE x.conversation_id = c.id AND x.status = 'sent' AND x.sender_id IS DISTINCT FROM $1 AND (m.last_read_at IS NULL OR x.created_at > m.last_read_at)) AS unread,
              (SELECT jsonb_build_object('text', left(x.body, 140), 'at', x.created_at, 'mine', x.sender_id = $1, 'system', x.system) FROM dm_messages x WHERE x.conversation_id = c.id AND x.status = 'sent' ORDER BY x.created_at DESC LIMIT 1) AS last,
              (SELECT ${personSql('u', 'ap')} FROM conversation_members om JOIN users u ON u.id = om.user_id LEFT JOIN admin_profiles ap ON ap.user_id = u.id
                WHERE om.conversation_id = c.id AND om.user_id <> $1 ORDER BY (u.role = 'contributor') DESC LIMIT 1) AS other
         FROM conversations c JOIN conversation_members m ON m.conversation_id = c.id AND m.user_id = $1
        WHERE m.declined_at IS NULL AND EXISTS (SELECT 1 FROM dm_messages x WHERE x.conversation_id = c.id AND x.status = 'sent')
        ORDER BY c.last_message_at DESC LIMIT 200`, [user.id]);
    const shape = (c: Row) => ({
      id: c.id, kind: c.kind, topic: c.topic, issueType: c.issueType, issueRef: c.issueRef, unread: c.unread, lastMessage: c.last, lastMessageAt: c.lastMessageAt,
      // A contributor writing to the admins sees one "Admin" bubble; admins see the contributor.
      with: c.withAdmins && user.role === 'contributor' ? { id: null, role: 'admin', username: null, name: 'Admins', avatar: 'logo', badge: 'ADMIN' } : c.other,
    });
    return { conversations: rows.filter((c) => !c.isRequest).map(shape), requests: rows.filter((c) => c.isRequest).map(shape), unread: rows.reduce((n, c) => n + c.unread, 0) };
  }

  async messages(conversationId: string, user: AuthUser, q: { cursor?: string; limit?: string }) {
    const c = await this.member(conversationId, user);
    const cur = decodeCursor(q.cursor);
    const limit = pageSize(q.limit, 30, 100);
    const rows = await this.db.q(
      `SELECT x.id, x.body, x.system, x.created_at, x.sender_id, ${personSql('u', 'ap')} AS sender,
              (SELECT coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) FROM media_files f WHERE f.message_id = x.id) AS files
         FROM dm_messages x LEFT JOIN users u ON u.id = x.sender_id LEFT JOIN admin_profiles ap ON ap.user_id = u.id
        WHERE x.conversation_id = $1 AND x.status = 'sent' AND ($2::timestamptz IS NULL OR (x.created_at, x.id) < ($2, $3::uuid)) ORDER BY x.created_at DESC, x.id DESC LIMIT ${limit + 1}`,
      [conversationId, cur?.[0] ?? null, cur?.[1] ?? '00000000-0000-0000-0000-000000000000']);
    const page = rows.slice(0, limit);
    // Read receipts are shown only when both people have them switched on.
    const others = await this.db.q(`SELECT m.last_read_at, u.settings, u.role FROM conversation_members m JOIN users u ON u.id = m.user_id WHERE m.conversation_id = $1 AND m.user_id <> $2`, [conversationId, user.id]);
    const mine = await this.db.one(`SELECT settings FROM users WHERE id = $1`, [user.id]);
    const receipts = mine?.settings?.readReceipts !== false;
    const seenAt = receipts ? others.filter((o) => o.settings?.readReceipts !== false && o.lastReadAt).map((o) => new Date(o.lastReadAt).getTime()).sort((a, b) => b - a)[0] : undefined;
    const camel = (o: Record<string, any>) => { const out: Row = {}; for (const k of Object.keys(o)) out[k.replace(/_([a-z0-9])/g, (_, ch) => ch.toUpperCase())] = o[k]; return out; };
    return {
      conversation: { id: c.id, kind: c.kind, topic: c.topic, issueType: c.issueType, issueRef: c.issueRef, isRequest: !!c.isRequest },
      items: page.map((x) => ({ id: x.id, text: x.body, system: x.system, createdAt: x.createdAt, mine: x.senderId === user.id, sender: x.system ? null : x.sender,
        files: (x.files as any[]).map((f) => this.media.view(camel(f), { original: true })), seen: x.senderId === user.id && !!seenAt && seenAt >= new Date(x.createdAt).getTime() })),
      nextCursor: rows.length > limit ? encodeCursor([page[page.length - 1].createdAt, page[page.length - 1].id]) : null,
    };
  }

  /** Opening a conversation marks it read; the unread count goes down. */
  async read(conversationId: string, user: AuthUser) {
    await this.member(conversationId, user);
    await this.db.q(`UPDATE conversation_members SET last_read_at = now() WHERE conversation_id = $1 AND user_id = $2`, [conversationId, user.id]);
    await this.notify.pushCounts(user.id);
    for (const m of await this.db.q(`SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id <> $2`, [conversationId, user.id])) this.live.toUser(m.userId, 'message.read', { conversationId });
    return this.notify.counts(user.id);
  }

  async accept(conversationId: string, user: AuthUser) {
    await this.member(conversationId, user);
    await this.db.q(`UPDATE conversation_members SET is_request = false WHERE conversation_id = $1 AND user_id = $2`, [conversationId, user.id]);
    return { ok: true };
  }

  /** Declines a message request: it leaves the list and the sender is not told. */
  async decline(conversationId: string, user: AuthUser) {
    await this.member(conversationId, user);
    await this.db.q(`UPDATE conversation_members SET declined_at = now(), last_read_at = now() WHERE conversation_id = $1 AND user_id = $2 AND is_request`, [conversationId, user.id]);
    return { ok: true };
  }

  private async directWith(user: AuthUser, toUserId: string): Promise<string> {
    if (toUserId === user.id) return fail(400, 'invalid_input');
    const to = await this.db.one(`SELECT id, role, status FROM users WHERE id = $1`, [toUserId]);
    if (!to || !['active', 'warned', 'suspended'].includes(to.status)) return fail(404, 'not_found');
    const blocked = await this.db.one(`SELECT 1 AS x FROM blocks WHERE kind = 'block' AND ((user_id = $1 AND target_id = $2) OR (user_id = $2 AND target_id = $1))`, [user.id, toUserId]);
    if (blocked) return fail(403, 'blocked_interaction');
    const key = [user.id, toUserId].sort().join(':');
    const existing = await this.db.one(`SELECT id FROM conversations WHERE direct_key = $1`, [key]);
    if (existing) return existing.id;
    const c = (await this.db.one(`INSERT INTO conversations (kind, direct_key, created_by) VALUES ('direct', $1, $2) ON CONFLICT (direct_key) DO UPDATE SET direct_key = EXCLUDED.direct_key RETURNING id`, [key, user.id]))!;
    // A message from someone the recipient does not follow arrives as a request. Messages to or from the project team never do.
    const follows = await this.db.one(`SELECT 1 AS x FROM follows WHERE follower_id = $1 AND followee_id = $2`, [toUserId, user.id]);
    const request = !follows && to.role === 'contributor' && user.role === 'contributor';
    await this.db.q(`INSERT INTO conversation_members (conversation_id, user_id, is_request) VALUES ($1,$2,false), ($1,$3,$4) ON CONFLICT DO NOTHING`, [c.id, user.id, toUserId, request]);
    return c.id;
  }

  /** A conversation about one issue between a person and the admins (Ask Why, a report, account help). */
  async issue(userId: string, topic: string, issueType: string, issueRef: string): Promise<string> {
    const existing = await this.db.one(`SELECT c.id FROM conversations c JOIN conversation_members m ON m.conversation_id = c.id AND m.user_id = $1 WHERE c.kind = 'issue' AND c.issue_type = $2 AND c.issue_ref = $3`, [userId, issueType, issueRef]);
    if (existing) return existing.id;
    const c = (await this.db.one(`INSERT INTO conversations (kind, topic, issue_type, issue_ref, with_admins, created_by) VALUES ('issue',$1,$2,$3,true,$4) RETURNING id`, [topic.slice(0, 160), issueType, issueRef, userId]))!;
    await this.db.q(`INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [c.id, userId]);
    await this.db.q(`INSERT INTO conversation_members (conversation_id, user_id) SELECT $1, id FROM users WHERE role = 'admin' AND status = 'active' ON CONFLICT DO NOTHING`, [c.id]);
    return c.id;
  }

  /** A message written by the platform itself (confirmations, moderation and account notices). */
  async system(userId: string, topic: string, issueType: string, issueRef: string, body: string) {
    const id = await this.issue(userId, topic, issueType, issueRef);
    const m = (await this.db.one(`INSERT INTO dm_messages (conversation_id, sender_id, system, body) VALUES ($1, NULL, true, $2) RETURNING id, created_at`, [id, body]))!;
    await this.db.q(`UPDATE conversations SET last_message_at = now() WHERE id = $1`, [id]);
    this.live.toUser(userId, 'message', { conversationId: id, id: m.id });
    await this.notify.pushCounts(userId);
    return id;
  }

  async send(user: AuthUser, dto: { conversationId?: string; toUserId?: string; toAdmins?: boolean; topic?: string; text?: string; mediaIds?: string[] }, idempotencyKey: string | undefined, meta: RequestMeta) {
    const body = (dto.text ?? '').trim();
    if (!body && !dto.mediaIds?.length) return fail(400, 'story_empty');
    if (idempotencyKey) {
      const dup = await this.db.one(`SELECT id, conversation_id FROM dm_messages WHERE sender_id = $1 AND idempotency_key = $2`, [user.id, idempotencyKey]);
      if (dup) return { id: dup.id, conversationId: dup.conversationId, held: false };
    }
    let conversationId = dto.conversationId;
    if (!conversationId && dto.toAdmins) conversationId = await this.issue(user.id, dto.topic?.trim() || 'Account help', 'help', `help:${user.id}:${(dto.topic ?? '').trim().toLowerCase().slice(0, 60)}`);
    if (!conversationId && dto.toUserId) conversationId = await this.directWith(user, dto.toUserId);
    if (!conversationId) return fail(400, 'invalid_input');
    const c = await this.member(conversationId, user);
    if (c.kind === 'direct') {
      const blocked = await this.db.one(`SELECT 1 AS x FROM blocks b JOIN conversation_members m ON m.conversation_id = $1 AND m.user_id <> $2 WHERE b.kind = 'block' AND ((b.user_id = $2 AND b.target_id = m.user_id) OR (b.user_id = m.user_id AND b.target_id = $2))`, [conversationId, user.id]);
      if (blocked) return fail(403, 'blocked_interaction');
    }
    const media = dto.mediaIds?.length ? await this.db.q(`SELECT id FROM media_files WHERE id = ANY($1::uuid[]) AND owner_id = $2 AND story_id IS NULL AND comment_id IS NULL AND message_id IS NULL`, [dto.mediaIds, user.id]) : [];
    if (media.length !== (dto.mediaIds?.length ?? 0)) return fail(400, 'invalid_input');
    let flag: string | null = null, status = 'sent';
    if (body && !isTeam(user.role)) {
      try { const r = await this.ai.review({ kind: 'message', text: body, language: user.language }); flag = r.flag; if (r.flag === 'RED') status = 'held'; }
      catch (e) { if (!(e instanceof AiUnavailable)) throw e; status = 'held'; }
    }
    const m = (await this.db.one(`INSERT INTO dm_messages (conversation_id, sender_id, body, ai_flag, status, idempotency_key) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`, [conversationId, user.id, body, flag, status, idempotencyKey ?? null]))!;
    if (media.length) await this.db.q(`UPDATE media_files SET message_id = $1 WHERE id = ANY($2::uuid[])`, [m.id, media.map((x) => x.id)]);
    if (status === 'held') {
      await this.notify.admins({ group: 'moderation', kind: 'message.held', title: 'Message held by AI review', body: `A message from ${user.name} was held.`, link: `/admin/moderation?tab=messages&open=${m.id}` });
      return { id: m.id, conversationId, held: true, message: text('message_held', meta.lang) };
    }
    await this.db.q(`UPDATE conversations SET last_message_at = now() WHERE id = $1`, [conversationId]);
    await this.db.q(`UPDATE conversation_members SET last_read_at = now(), is_request = false WHERE conversation_id = $1 AND user_id = $2`, [conversationId, user.id]);
    await this.delivered(conversationId, m.id, user, body);
    return { id: m.id, conversationId, held: false, createdAt: m.createdAt };
  }

  async delivered(conversationId: string, messageId: string, sender: { id: string; name: string }, body: string) {
    const members = await this.db.q(`SELECT m.user_id, (SELECT 1 FROM blocks b WHERE b.user_id = m.user_id AND b.target_id = $2 AND b.kind = 'mute') AS muted FROM conversation_members m WHERE m.conversation_id = $1 AND m.user_id <> $2`, [conversationId, sender.id]);
    for (const mb of members) {
      this.live.toUser(mb.userId, 'message', { conversationId, id: messageId });
      await this.notify.pushCounts(mb.userId);
      if (!mb.muted) await this.notify.send(mb.userId, { group: 'messages', kind: 'message.new', title: `New message from ${sender.name}`, body: body.slice(0, 120), link: `/inbox/${conversationId}` });
    }
  }
}
