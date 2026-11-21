import { Injectable, OnModuleInit } from '@nestjs/common';
import { Approvals } from '../approvals/approvals.service';
import { AuthService } from '../auth/auth.service';
import { Audit } from '../common/audit.service';
import { Db, Row } from '../common/db';
import { AuthUser, RequestMeta } from '../common/decorators';
import { Jobs } from '../common/jobs.service';
import { fail, longDate, REPORT_REASONS, text } from '../common/messages';
import { Notify } from '../common/notify.service';
import { Realtime } from '../common/realtime.gateway';
import { Track } from '../common/track.service';
import { config } from '../config/config';
import { InboxService } from '../inbox/inbox.service';
import { CommentsService } from '../stories/comments.service';
import { StoriesService } from '../stories/stories.service';
import { personSql } from '../users/profile';

/** AI flags, the moderation queue, admin actions on stories and comments, "Ask Why", user reports and account actions (Sections 2.8, 3.2.10; Appendix C). */
@Injectable()
export class ModerationService implements OnModuleInit {
  constructor(
    private readonly db: Db, private readonly audit: Audit, private readonly notify: Notify, private readonly live: Realtime, private readonly track: Track, private readonly jobs: Jobs,
    private readonly stories: StoriesService, private readonly comments: CommentsService, private readonly approvals: Approvals, private readonly inbox: InboxService, private readonly auth: AuthService,
  ) {}

  onModuleInit() {
    this.jobs.every('reports.escalate', 30 * 60_000, () => this.escalate());
    this.approvals.on('account_deletion', {
      approved: async (req) => { await this.banPermanently(req.targetId, req.justification); },
      rejected: async (req) => {
        const u = await this.db.one(`SELECT language FROM users WHERE id = $1`, [req.targetId]);
        await this.inbox.system(req.targetId, 'Account review', 'account', `account:${req.targetId}`, u?.language === 'sw' ? 'Ukaguzi wa akaunti yako umekamilika. Hakuna hatua iliyochukuliwa.' : 'The review of your account is complete. No action was taken.');
        await this.notify.done(`account-review:${req.targetId}`);
      },
    });
  }

  // ---------- moderation queue ----------

  async queue(q: Record<string, string | undefined>, admin: AuthUser) {
    const where: string[] = [`s.status NOT IN ('draft','deleted')`]; const params: unknown[] = [];
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.flag) where.push(`s.ai_flag = ${p(q.flag.toUpperCase())}`);
    if (q.filter === 'pending') where.push(`s.status = 'pending_review'`);
    if (q.filter === 'blocked') where.push(`s.ai_flag = 'RED' AND NOT s.ai_overridden AND s.status IN ('pending_review','blocked')`);
    if (q.filter === 'overridden') where.push(`s.ai_overridden`);
    if (q.filter === 'removed') where.push(`s.status = 'removed'`);
    if (q.filter === 'awaiting') where.push(`s.status IN ('awaiting_approval','awaiting_validation')`);
    if (q.q?.trim()) where.push(`(upper(s.code) = upper(${p(q.q.trim())}) OR s.search @@ websearch_to_tsquery('simple', ${p(q.q.trim())}))`);
    const rows = await this.db.q(`SELECT s.id FROM stories s WHERE ${where.join(' AND ')} ORDER BY ${q.filter === 'pending' && !q.sort ? `s.created_at ASC` : `s.created_at ${q.sort === 'oldest' ? 'ASC' : 'DESC'}`} LIMIT 50 OFFSET ${Math.max(0, parseInt(q.offset ?? '0', 10) || 0)}`, params);
    const counts = await this.db.one(`SELECT count(*) FILTER (WHERE status = 'pending_review')::int AS pending, count(*) FILTER (WHERE ai_flag = 'RED' AND NOT ai_overridden AND status IN ('pending_review','blocked'))::int AS blocked,
      count(*) FILTER (WHERE ai_overridden)::int AS overridden, count(*) FILTER (WHERE ai_flag = 'GREEN')::int AS green, count(*) FILTER (WHERE ai_flag = 'YELLOW')::int AS yellow, count(*) FILTER (WHERE ai_flag = 'RED')::int AS red FROM stories WHERE status NOT IN ('draft','deleted')`);
    return { items: await Promise.all(rows.map((r) => this.stories.get(r.id, admin))), counts, overrideWarning: text('override_warning', admin.language) };
  }

  async history(storyId: string) {
    return this.db.q(`SELECT d.*, coalesce(a.admin_name, '') AS admin_name FROM moderation_decisions d LEFT JOIN admin_profiles a ON a.user_id = d.admin_id WHERE d.target_type = 'story' AND d.target_id = $1 ORDER BY d.created_at DESC`, [storyId]);
  }

  private async story(id: string) { return (await this.db.one(`SELECT s.*, u.language AS author_language, u.username AS author_username FROM stories s LEFT JOIN users u ON u.id = s.author_id WHERE s.id = $1`, [id])) ?? fail(404, 'not_found'); }
  private async decide(s: Row, admin: AuthUser, action: string, reason: string, approved = true) {
    await this.db.q(`INSERT INTO moderation_decisions (target_type, target_id, ai_flag, ai_score, ai_explanation, admin_action, reason, admin_id, approved) VALUES ('story',$1,$2,$3,$4,$5,$6,$7,$8)`,
      [s.id, s.aiFlag, s.aiScore, s.aiExplanation ? JSON.stringify(s.aiExplanation) : null, action, reason, admin.id, approved]);
    await this.notify.done(`moderate:${s.id}`);
  }

  /** Delete story (Recycle Bin). The Contributor sees a notice with an "Ask Why" button. */
  async removeStory(id: string, admin: AuthUser, reason: string, meta: RequestMeta, opts: { reportDriven?: boolean } = {}) {
    if (!reason?.trim()) return fail(400, 'reason_required');
    const s = await this.story(id);
    if (['removed', 'deleted'].includes(s.status)) return fail(409, 'already_exists');
    await this.db.q(`UPDATE stories SET status = 'removed', removed_reason = $2, removed_by = $3, purge_at = now() + ($4 || ' days')::interval, updated_at = now() WHERE id = $1`, [id, reason.trim(), admin.id, String(config.removedStoryRetentionDays)]);
    await this.decide(s, admin, 'remove', reason.trim());
    await this.audit.record({ actor: admin, action: 'story.remove', entityType: 'story', entityId: id, summary: `${admin.name} removed story ${s.code}`, reason, ip: meta.ip });
    if (s.authorId && s.postedAs !== 'company') {
      await this.notify.send(s.authorId, { group: 'moderation', kind: 'story.removed', title: text('story_removed', s.authorLanguage, { code: s.code }), body: '', link: `/profile/stories?open=${s.code}`, priority: true, actionKey: `story-removed:${id}`, data: { storyId: id, code: s.code, askWhy: true } });
    }
    await this.stories.dropFeedCache();
    this.live.toAll('story.removed', { id });
    return { message: text(opts.reportDriven ? 'story_dropped' : 'admin_story_deleted', meta.lang) };
  }

  /** A second review, by a different admin from the one who removed the story (Appendix C.6). */
  async restoreStory(id: string, admin: AuthUser, reason: string, meta: RequestMeta) {
    if (!reason?.trim()) return fail(400, 'reason_required');
    const s = await this.story(id);
    if (s.status !== 'removed') return fail(409, 'already_exists');
    if (s.removedBy === admin.id) return fail(403, 'forbidden', {}, { hint: 'second_review_needs_a_different_admin' });
    await this.db.q(`UPDATE stories SET status = 'published', removed_reason = '', removed_by = NULL, purge_at = NULL WHERE id = $1`, [id]);
    await this.decide(s, admin, 'restore', reason.trim());
    await this.audit.record({ actor: admin, action: 'story.restore', entityType: 'story', entityId: id, summary: `${admin.name} restored story ${s.code} after a second review`, reason, ip: meta.ip });
    await this.notify.done(`story-removed:${id}`);
    if (s.authorId) await this.notify.send(s.authorId, { group: 'moderation', kind: 'story.restored', title: `Your story ${s.code} has been restored`, body: reason.trim(), link: `/stories/${s.code}` });
    return { ok: true };
  }

  /** Keep a RED story blocked after looking at it. */
  async keepBlocked(id: string, admin: AuthUser, reason: string, meta: RequestMeta) {
    const s = await this.story(id);
    if (s.status !== 'pending_review') return fail(409, 'already_exists');
    await this.db.q(`UPDATE stories SET status = 'blocked', removed_reason = $2, purge_at = now() + ($3 || ' days')::interval WHERE id = $1`, [id, (reason ?? '').trim(), String(config.removedStoryRetentionDays)]);
    await this.decide(s, admin, 'confirm_block', (reason ?? '').trim());
    await this.audit.record({ actor: admin, action: 'story.block_confirmed', entityType: 'story', entityId: id, summary: `${admin.name} kept story ${s.code} blocked`, reason, ip: meta.ip });
    if (s.authorId) await this.notify.send(s.authorId, { group: 'moderation', kind: 'story.blocked', title: text('outcome_red', s.authorLanguage), body: `${s.code}${reason ? `: ${reason.trim()}` : ''}`, link: `/profile/stories?open=${s.code}`, data: { storyId: id, code: s.code, askWhy: true } });
    return { ok: true };
  }

  /** A story the AI could not check: an admin reads it and publishes it. This is not an override of an AI ban. */
  async release(id: string, admin: AuthUser, meta: RequestMeta) {
    const s = await this.story(id);
    if (s.status !== 'pending_review' || s.aiFlag) return fail(409, 'already_exists');
    await this.stories.publish(id);
    await this.decide(s, admin, 'release', 'Checked by an admin while AI review was unavailable');
    await this.audit.record({ actor: admin, action: 'story.release', entityType: 'story', entityId: id, summary: `${admin.name} published story ${s.code} after a manual check`, ip: meta.ip });
    if (s.authorId) await this.notify.send(s.authorId, { group: 'engagement', kind: 'story.green', title: text('outcome_green', s.authorLanguage), body: s.code, link: `/stories/${s.code}` });
    return { ok: true };
  }

  /** The storyteller has confirmed how their testimony is represented: it is marked as validated and, if it was waiting, published. */
  async validate(id: string, admin: AuthUser, dto: { storyteller?: string; consentType?: string; consentDate?: string; restrictions?: Record<string, unknown> }, meta: RequestMeta) {
    const s = await this.story(id);
    await this.db.q(`INSERT INTO consent_records (story_id, storyteller, consent_type, consent_date, restrictions, validated_at) VALUES ($1,$2,$3,$4,$5, now())
      ON CONFLICT (story_id) DO UPDATE SET storyteller = coalesce(nullif($2, ''), consent_records.storyteller), consent_type = coalesce(nullif($3, ''), consent_records.consent_type),
        consent_date = coalesce($4, consent_records.consent_date), restrictions = consent_records.restrictions || $5::jsonb, validated_at = now(), withdrawn_at = NULL`,
      [id, dto.storyteller ?? s.toldBy ?? '', dto.consentType ?? '', dto.consentDate || null, JSON.stringify(dto.restrictions ?? {})]);
    await this.db.q(`UPDATE stories SET validated = true, consent_confirmed = true, allow_download = CASE WHEN $2 THEN false ELSE allow_download END, posted_as = CASE WHEN $3 THEN 'anonymous' ELSE posted_as END WHERE id = $1`,
      [id, dto.restrictions?.noDownloads === true, dto.restrictions?.anonymous === true]);
    if (!(await this.stories.consentComplete(id))) return fail(400, 'consent_incomplete');
    if (s.status === 'awaiting_validation') await this.stories.publish(id);
    await this.audit.record({ actor: admin, action: 'story.validated', entityType: 'story', entityId: id, summary: `${admin.name} recorded that ${s.code} was validated with the storyteller`, ip: meta.ip });
    return this.stories.get(id, admin);
  }

  /** Storytellers can withdraw consent, and their story is then removed. Participants keep control over how their stories are shared. */
  async withdrawConsent(id: string, admin: AuthUser, reason: string, meta: RequestMeta) {
    const s = await this.story(id);
    await this.db.q(`INSERT INTO consent_records (story_id, storyteller, withdrawn_at) VALUES ($1,$2, now()) ON CONFLICT (story_id) DO UPDATE SET withdrawn_at = now()`, [id, s.toldBy ?? '']);
    await this.db.q(`UPDATE stories SET status = 'removed', validated = false, removed_reason = $2, removed_by = $3, purge_at = now() + interval '30 days' WHERE id = $1`, [id, `Consent withdrawn${reason ? `: ${reason}` : ''}`, admin.id]);
    await this.decide(s, admin, 'consent_withdrawn', reason ?? '');
    await this.stories.dropFeedCache();
    this.live.toAll('story.removed', { id });
    await this.audit.record({ actor: admin, action: 'story.consent_withdrawn', entityType: 'story', entityId: id, summary: `${admin.name} removed ${s.code} because the storyteller withdrew consent`, reason, ip: meta.ip });
    return { ok: true };
  }

  /** Where a story contains incorrect safety advice, admins may add a correction note linking to official guidance (Appendix C.8). */
  async correction(id: string, admin: AuthUser, note: string, link: string, meta: RequestMeta) {
    const s = await this.story(id);
    if (link && !/^https:\/\//.test(link)) return fail(400, 'invalid_input');
    await this.db.q(`UPDATE stories SET correction_note = $2, correction_link = $3 WHERE id = $1`, [id, note.trim(), link.trim()]);
    await this.stories.dropFeedCache();
    await this.audit.record({ actor: admin, action: 'story.correction', entityType: 'story', entityId: id, summary: `${admin.name} ${note.trim() ? 'added a correction note to' : 'cleared the correction note on'} ${s.code}`, reason: note, ip: meta.ip });
    if (s.authorId && note.trim()) await this.notify.send(s.authorId, { group: 'moderation', kind: 'story.correction', title: `A safety note was added to your story ${s.code}`, body: note.trim(), link: `/stories/${s.code}` });
    return { ok: true };
  }

  /** Override AI ban: needs a justification and goes to the approval engine. The ban stays until the approval rule is met. */
  async override(id: string, admin: AuthUser, justification: string, meta: RequestMeta) {
    if (!justification?.trim()) return fail(400, 'reason_required');
    const s = await this.story(id);
    if (s.aiFlag !== 'RED' || s.aiOverridden || !['pending_review', 'blocked'].includes(s.status)) return fail(409, 'already_exists');
    await this.decide(s, admin, 'override', justification.trim(), false);
    const req = await this.approvals.propose({ type: 'override', targetId: id, title: `Override AI ban on ${s.code}`, proposer: admin, justification, payload: { code: s.code, aiScore: s.aiScore } }, meta);
    return { approval: req, message: text('override_submitted', meta.lang) };
  }

  async setComments(id: string, admin: AuthUser, what: 'lock' | 'hide', on: boolean, reason: string, meta: RequestMeta) {
    if (on && !reason?.trim()) return fail(400, 'reason_required');
    const s = await this.story(id);
    const col = what === 'lock' ? 'comments_locked' : 'comments_hidden';
    await this.db.q(`UPDATE stories SET ${col} = $2, ${col}_reason = $3 WHERE id = $1`, [id, on, on ? reason.trim() : '']);
    await this.audit.record({ actor: admin, action: `comments.${what}${on ? '' : '.undo'}`, entityType: 'story', entityId: id, summary: `${admin.name} ${on ? '' : 'un'}${what === 'lock' ? 'locked' : 'hid'} comments on ${s.code}`, reason, ip: meta.ip });
    this.live.toAll('story.comments', { id, [what === 'lock' ? 'locked' : 'hidden']: on, reason: on ? reason.trim() : '' });
    return { message: text(what === 'lock' ? 'admin_comments_locked' : 'admin_comments_hidden', meta.lang), on };
  }

  // ---------- comments and messages held by AI review ----------

  async held(kind: 'comments' | 'messages') {
    if (kind === 'comments') return this.db.q(`SELECT c.id, c.body, c.ai_flag, c.ai_explanation, c.created_at, s.code AS story_code, s.id AS story_id, ${personSql('u', 'ap')} AS author FROM comments c JOIN stories s ON s.id = c.story_id LEFT JOIN users u ON u.id = c.author_id LEFT JOIN admin_profiles ap ON ap.user_id = u.id WHERE c.status = 'pending_review' ORDER BY c.created_at`);
    return this.db.q(`SELECT m.id, m.body, m.ai_flag, m.created_at, m.conversation_id, ${personSql('u', 'ap')} AS author FROM dm_messages m LEFT JOIN users u ON u.id = m.sender_id LEFT JOIN admin_profiles ap ON ap.user_id = u.id WHERE m.status = 'held' ORDER BY m.created_at`);
  }
  async decideHeld(kind: 'comments' | 'messages', id: string, admin: AuthUser, allow: boolean, reason: string, meta: RequestMeta) {
    if (kind === 'comments') {
      const c = await this.db.one(`SELECT c.*, s.code, s.author_id AS story_author, s.posted_as FROM comments c JOIN stories s ON s.id = c.story_id WHERE c.id = $1 AND c.status = 'pending_review'`, [id]);
      if (!c) return fail(404, 'not_found');
      await this.db.q(`UPDATE comments SET status = $2 WHERE id = $1`, [id, allow ? 'published' : 'blocked']);
      if (allow) { const u = await this.db.one(`SELECT username FROM users WHERE id = $1`, [c.authorId]); await this.comments.published(id, { id: c.storyId, code: c.code, authorId: c.storyAuthor, postedAs: c.postedAs }, { id: c.authorId, name: u?.username ?? '' }, c.parentId, c.mentions ?? []); }
      else if (c.authorId) await this.notify.send(c.authorId, { group: 'moderation', kind: 'comment.blocked', title: 'Your comment was not posted', body: reason || 'It breaks the rules.', link: `/stories/${c.code}` });
    } else {
      const m = await this.db.one(`SELECT * FROM dm_messages WHERE id = $1 AND status = 'held'`, [id]);
      if (!m) return fail(404, 'not_found');
      await this.db.q(`UPDATE dm_messages SET status = $2 WHERE id = $1`, [id, allow ? 'sent' : 'deleted']);
      if (allow) { await this.db.q(`UPDATE conversations SET last_message_at = now() WHERE id = $1`, [m.conversationId]); const u = await this.db.one(`SELECT username FROM users WHERE id = $1`, [m.senderId]); await this.inbox.delivered(m.conversationId, id, { id: m.senderId, name: u?.username ?? '' }, m.body); }
      else if (m.senderId) await this.notify.send(m.senderId, { group: 'moderation', kind: 'message.blocked', title: 'Your message was not sent', body: reason || 'It breaks the rules.' });
    }
    await this.audit.record({ actor: admin, action: `${kind}.held.${allow ? 'allow' : 'block'}`, entityType: kind, entityId: id, summary: `${admin.name} ${allow ? 'allowed' : 'blocked'} a held ${kind === 'comments' ? 'comment' : 'message'}`, reason, ip: meta.ip });
    return { ok: true };
  }

  // ---------- Ask Why ----------

  /** The contributor of a removed or blocked story asks the admins why. The request reaches the admins' INBOX. */
  async askWhy(storyId: string, user: AuthUser, dto: { subject?: string; description: string; mediaIds?: string[] }, meta: RequestMeta) {
    const s = await this.story(storyId);
    if (s.authorId !== user.id) return fail(403, 'forbidden');
    if (!['removed', 'blocked', 'pending_review'].includes(s.status)) return fail(409, 'already_exists');
    const conversationId = await this.inbox.issue(user.id, `Story ${s.code} issue`, 'ask_why', `story:${storyId}`);
    await this.inbox.send(user, { conversationId, text: `${dto.subject?.trim() ? `${dto.subject.trim()}\n\n` : ''}${dto.description.trim()}`, mediaIds: dto.mediaIds }, undefined, meta);
    await this.notify.done(`story-removed:${storyId}`, user.id);
    await this.notify.admins({ group: 'moderation', kind: 'ask_why', title: `“Ask Why” on ${s.code}`, body: `${user.name} asked why their story was ${s.status === 'removed' ? 'removed' : 'not posted'}.`, link: `/inbox/${conversationId}`, priority: true, actionKey: `ask-why:${storyId}` });
    await this.audit.record({ actor: user, action: 'ask_why', entityType: 'story', entityId: storyId, summary: `${user.name} sent an “Ask Why” request on ${s.code}`, ip: meta.ip });
    return { conversationId, message: text('ask_why_sent', meta.lang) };
  }
  /** A suspended account cannot sign in, so it asks why with the short-lived token it was given at sign-in. */
  async askWhySuspended(token: string, description: string, meta: RequestMeta) {
    const userId = await this.auth.askWhyUser(token);
    const u = await this.db.one(`SELECT id, username, language, role FROM users WHERE id = $1 AND status = 'suspended'`, [userId]);
    if (!u) return fail(404, 'not_found');
    const conversationId = await this.inbox.issue(userId, 'Account suspension', 'account', `account:${userId}`);
    await this.db.q(`INSERT INTO dm_messages (conversation_id, sender_id, body) VALUES ($1,$2,$3)`, [conversationId, userId, description.trim().slice(0, 4000)]);
    await this.db.q(`UPDATE conversations SET last_message_at = now() WHERE id = $1`, [conversationId]);
    await this.notify.admins({ group: 'moderation', kind: 'ask_why', title: '“Ask Why” on a suspension', body: `@${u.username} asked why their account is suspended.`, link: `/inbox/${conversationId}`, priority: true, actionKey: `ask-why-account:${userId}` });
    return { message: text('ask_why_sent', meta.lang) };
  }

  // ---------- reports from users ----------

  async report(user: AuthUser, dto: { targetType: 'story' | 'user' | 'comment'; targetId: string; reasons?: string[]; description?: string }, meta: RequestMeta) {
    const reasons = (dto.reasons ?? []).filter((r) => REPORT_REASONS.some((x) => x.key === r));
    const description = (dto.description ?? '').trim();
    if (!reasons.length && !description) return fail(400, 'report_empty');
    const target = dto.targetType === 'story' ? await this.db.one(`SELECT id, code AS label FROM stories WHERE id = $1`, [dto.targetId])
      : dto.targetType === 'user' ? await this.db.one(`SELECT id, '@' || username AS label FROM users WHERE id = $1 AND role = 'contributor'`, [dto.targetId])
      : await this.db.one(`SELECT id, 'a comment' AS label FROM comments WHERE id = $1`, [dto.targetId]);
    if (!target) return fail(404, 'not_found');
    // Urgent: a safety risk or exposed private data is answered first (Appendix C.4).
    const urgent = reasons.includes('privacy') || /\b(danger|urgent|threat|hatari|dharura)\b/i.test(description);
    const r = (await this.db.one(`INSERT INTO reports (reporter_id, target_type, target_id, reasons, description, urgent) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`, [user.id, dto.targetType, dto.targetId, reasons, description, urgent]))!;
    await this.track.event('report', this.track.actor(user), { metrics: ['reports'] });
    const labels = reasons.map((k) => REPORT_REASONS.find((x) => x.key === k)![user.language === 'sw' ? 'sw' : 'en']);
    await this.inbox.system(user.id, `Report on ${target.label}`, 'report', `report:${dto.targetType}:${dto.targetId}`,
      user.language === 'sw' ? `Tumepokea ripoti yako kuhusu ${target.label}${labels.length ? ` (${labels.join('; ')})` : ''}. Wasimamizi wataikagua na utaarifiwa itakapotatuliwa.`
        : `We received your report on ${target.label}${labels.length ? ` (${labels.join('; ')})` : ''}. The admins will review it, and you will be told when it is resolved.`);
    await this.notify.admins({ group: 'moderation', kind: 'report.new', title: urgent ? 'Urgent report' : 'New report', body: `${user.name} reported ${target.label}.`, link: `/admin/reports?open=${r.id}`, priority: urgent, actionKey: `report:${dto.targetType}:${dto.targetId}` });
    this.live.toAdmins('report', { id: r.id, urgent });
    await this.audit.record({ actor: user, action: 'report.create', entityType: dto.targetType, entityId: dto.targetId, summary: `${user.name} reported ${target.label}`, ip: meta.ip });
    return { id: r.id, message: text('report_sent', meta.lang) };
  }

  /** The reports queue. Several reports on the same item are grouped; reports pending too long are escalated and highlighted. */
  async reports(status = 'open') {
    const rows = await this.db.q(
      `SELECT r.target_type, r.target_id, min(r.created_at) AS first_at, max(r.created_at) AS last_at, count(*)::int AS count, bool_or(r.urgent) AS urgent,
              min(r.created_at) < now() - ($2 || ' hours')::interval AS escalated,
              jsonb_agg(jsonb_build_object('id', r.id, 'reasons', r.reasons, 'description', r.description, 'createdAt', r.created_at, 'status', r.status, 'action', r.action, 'reporter', ${personSql('u', 'ap')}) ORDER BY r.created_at) AS reports,
              (SELECT coalesce(jsonb_agg(n), '[]'::jsonb) FROM (SELECT jsonb_array_elements(x.notes) AS n FROM reports x WHERE x.target_type = r.target_type AND x.target_id = r.target_id) z) AS notes
         FROM reports r LEFT JOIN users u ON u.id = r.reporter_id LEFT JOIN admin_profiles ap ON ap.user_id = u.id
        WHERE r.status = $1 GROUP BY r.target_type, r.target_id ORDER BY bool_or(r.urgent) DESC, min(r.created_at) ASC LIMIT 200`, [status, String(config.reportEscalateHours)]);
    const out = [];
    for (const g of rows) {
      const target = g.targetType === 'story' ? await this.db.one(`SELECT s.id, s.code, s.status, left(s.body, 240) AS excerpt, s.title, s.author_id, ${personSql('u', 'ap')} AS author FROM stories s LEFT JOIN users u ON u.id = s.author_id LEFT JOIN admin_profiles ap ON ap.user_id = u.id WHERE s.id = $1`, [g.targetId])
        : g.targetType === 'comment' ? await this.db.one(`SELECT c.id, c.body AS excerpt, c.status, c.author_id, c.story_id, ${personSql('u', 'ap')} AS author FROM comments c LEFT JOIN users u ON u.id = c.author_id LEFT JOIN admin_profiles ap ON ap.user_id = u.id WHERE c.id = $1`, [g.targetId])
        : await this.db.one(`SELECT u.id, u.status, u.warnings, u.suspended_until, ${personSql('u', 'ap')} AS author FROM users u LEFT JOIN admin_profiles ap ON ap.user_id = u.id WHERE u.id = $1`, [g.targetId]);
      out.push({ ...g, target });
    }
    return out;
  }

  async addNote(targetType: string, targetId: string, admin: AuthUser, note: string) {
    const r = await this.db.one(`SELECT id FROM reports WHERE target_type = $1 AND target_id = $2 ORDER BY created_at LIMIT 1`, [targetType, targetId]);
    if (!r) return fail(404, 'not_found');
    await this.db.q(`UPDATE reports SET notes = notes || $2::jsonb WHERE id = $1`, [r.id, JSON.stringify([{ by: admin.name, at: new Date().toISOString(), note: note.trim().slice(0, 2000) }])]);
    return { ok: true };
  }

  /** Dismiss, warn the Contributor, drop the story, suspend for a set period, or propose permanent deletion (via the approval engine). */
  async act(targetType: 'story' | 'user' | 'comment', targetId: string, admin: AuthUser, dto: { action: 'dismiss' | 'warn' | 'drop' | 'suspend' | 'delete'; reason: string; days?: number }, meta: RequestMeta) {
    if (!dto.reason?.trim()) return fail(400, 'reason_required');
    const open = await this.db.q(`SELECT id, reporter_id FROM reports WHERE target_type = $1 AND target_id = $2 AND status = 'open'`, [targetType, targetId]);
    const accountId = targetType === 'user' ? targetId : (await this.db.one(targetType === 'story' ? `SELECT author_id FROM stories WHERE id = $1` : `SELECT author_id FROM comments WHERE id = $1`, [targetId]))?.authorId;
    let message = '';
    if (dto.action === 'dismiss') message = text('report_dismissed', meta.lang);
    else if (dto.action === 'drop') {
      if (targetType === 'story') message = (await this.removeStory(targetId, admin, dto.reason, meta, { reportDriven: true })).message;
      else if (targetType === 'comment') { await this.comments.remove(targetId, admin); message = text('story_dropped', meta.lang); }
      else return fail(400, 'invalid_input');
    } else {
      if (!accountId) return fail(404, 'not_found');
      message = (await this.accountAction(accountId, admin, dto.action, dto.reason, dto.days, meta)).message;
    }
    const status = dto.action === 'dismiss' ? 'dismissed' : 'resolved';
    await this.db.q(`UPDATE reports SET status = $3, action = $4, handled_by = $5, resolved_at = now() WHERE target_type = $1 AND target_id = $2 AND status = 'open'`, [targetType, targetId, status, dto.action, admin.id]);
    await this.notify.done(`report:${targetType}:${targetId}`);
    for (const r of open) {
      if (!r.reporterId) continue;
      const u = await this.db.one(`SELECT language FROM users WHERE id = $1`, [r.reporterId]);
      await this.inbox.system(r.reporterId, 'Your report', 'report', `report:${targetType}:${targetId}`,
        u?.language === 'sw' ? (dto.action === 'dismiss' ? 'Tumekagua ripoti yako. Hatukupata ukiukaji wa kanuni, kwa hivyo hakuna hatua iliyochukuliwa. Asante kwa kutusaidia kulinda jukwaa.' : 'Tumekagua ripoti yako na tumechukua hatua. Asante kwa kutusaidia kulinda jukwaa.')
          : (dto.action === 'dismiss' ? 'We reviewed your report. We did not find a breach of the rules, so no action was taken. Thank you for helping to keep the archive safe.' : 'We reviewed your report and took action. Thank you for helping to keep the archive safe.'));
      await this.notify.send(r.reporterId, { group: 'moderation', kind: 'report.resolved', title: 'Your report has been resolved', link: '/inbox' });
    }
    if (dto.action === 'dismiss') await this.audit.record({ actor: admin, action: 'report.dismiss', entityType: targetType, entityId: targetId, summary: `${admin.name} dismissed ${open.length} report(s)`, reason: dto.reason, ip: meta.ip });
    return { message };
  }

  /** Warn, suspend or propose permanent deletion. The account holder is kept informed at every stage (INBOX and priority notifications). */
  async accountAction(userId: string, admin: AuthUser, action: 'warn' | 'suspend' | 'delete', reason: string, days: number | undefined, meta: RequestMeta) {
    if (!reason?.trim()) return fail(400, 'reason_required');
    const u = await this.db.one(`SELECT id, username, role, status, language, email FROM users WHERE id = $1`, [userId]);
    if (!u || u.role !== 'contributor') return fail(404, 'not_found');
    const sw = u.language === 'sw';
    const topic = 'Account notice', ref = `account:${userId}`;
    if (action === 'warn') {
      await this.db.q(`UPDATE users SET warnings = warnings + 1, status = CASE WHEN status = 'active' THEN 'warned' ELSE status END, status_reason = $2 WHERE id = $1`, [userId, reason.trim()]);
      await this.inbox.system(userId, topic, 'account', ref, sw ? `Onyo kutoka kwa wasimamizi: ${reason.trim()}\n\nUkiukaji ukirudiwa, akaunti yako inaweza kusimamishwa.` : `A warning from the admins: ${reason.trim()}\n\nRepeated breaches can lead to your account being suspended.`);
      await this.notify.send(userId, { group: 'account', kind: 'account.warning', title: sw ? 'Umepokea onyo' : 'You have received a warning', body: reason.trim(), link: '/inbox', priority: true, actionKey: `account-warning:${userId}:${Date.now()}` });
      await this.audit.record({ actor: admin, action: 'account.warn', entityType: 'user', entityId: userId, summary: `${admin.name} warned @${u.username}`, reason, ip: meta.ip });
      return { message: text('warning_sent', meta.lang, { name: u.username }) };
    }
    if (action === 'suspend') {
      const d = days === 30 ? 30 : days && days > 0 && days <= 365 ? Math.round(days) : 7;
      const until = new Date(Date.now() + d * 86400_000);
      await this.db.q(`UPDATE users SET status = 'suspended', suspended_until = $2, status_reason = $3 WHERE id = $1`, [userId, until, reason.trim()]);
      await this.auth.revokeAll(userId);
      await this.inbox.system(userId, topic, 'account', ref, sw ? `Akaunti yako imesimamishwa hadi ${longDate(until, 'sw')}. Sababu: ${reason.trim()}` : `Your account is suspended until ${longDate(until)}. Reason: ${reason.trim()}`);
      await this.notify.send(userId, { group: 'account', kind: 'account.suspended', title: text('account_suspended', u.language, { date: longDate(until, u.language) }), body: reason.trim(), link: '/inbox', email: true });
      await this.audit.record({ actor: admin, action: 'account.suspend', entityType: 'user', entityId: userId, summary: `${admin.name} suspended @${u.username} for ${d} days`, reason, ip: meta.ip });
      return { message: text('account_suspended_admin', meta.lang, { days: d }) };
    }
    // Permanent deletion is a terminal action: it goes through the approval engine and the account stays active until then.
    const req = await this.approvals.propose({ type: 'account_deletion', targetId: userId, title: `Delete the account @${u.username} permanently`, proposer: admin, justification: reason, payload: { username: u.username } }, meta);
    await this.inbox.system(userId, 'Account review', 'account', ref, sw ? 'Wasimamizi wanakagua akaunti yako baada ya ripoti. Hatua imependekezwa na inasubiri idhini ya wasimamizi wengine. Utaarifiwa kuhusu uamuzi wa mwisho. Unaweza kujibu hapa ili kueleza upande wako.'
      : 'The admins are reviewing your account after a report. An action has been proposed and is waiting for the other admins’ approval. You will be told the final outcome. You can reply here to explain your side.');
    await this.notify.send(userId, { group: 'account', kind: 'account.review', title: sw ? 'Akaunti yako inakaguliwa' : 'Your account is under review', body: sw ? 'Fungua KIKASHA kwa maelezo.' : 'Open INBOX for details.', link: '/inbox', priority: true, actionKey: `account-review:${userId}` });
    return { approval: req, message: text('deletion_proposed', meta.lang) };
  }

  private async banPermanently(userId: string, reason: string) {
    const u = await this.db.one(`UPDATE users SET status = 'removed', status_reason = $2, deleted_at = now(), purge_at = now() + interval '30 days' WHERE id = $1 RETURNING email, language, username`, [userId, reason]);
    if (!u) return;
    await this.auth.revokeAll(userId);
    await this.notify.done(`account-review:${userId}`);
    await this.notify.send(userId, { group: 'account', kind: 'account.removed', title: text('account_removed', u.language), body: reason, email: true });
  }

  async escalate() {
    const rows = await this.db.q(`SELECT DISTINCT target_type, target_id FROM reports WHERE status = 'open' AND created_at < now() - ($1 || ' hours')::interval AND NOT (notes @> '[{"escalated": true}]'::jsonb)`, [String(config.reportEscalateHours)]);
    for (const r of rows) {
      await this.db.q(`UPDATE reports SET notes = notes || '[{"escalated": true}]'::jsonb WHERE target_type = $1 AND target_id = $2 AND status = 'open'`, [r.targetType, r.targetId]);
      await this.notify.admins({ group: 'moderation', kind: 'report.escalated', title: 'A report has been waiting too long', body: `A report has been open for more than ${config.reportEscalateHours} hours.`, link: '/admin/reports', priority: true, actionKey: `report:${r.targetType}:${r.targetId}` });
    }
    return rows.length;
  }
}
