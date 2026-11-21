import { Injectable } from '@nestjs/common';
import { Ai, AiUnavailable } from '../ai/ai.service';
import { Db, Row } from '../common/db';
import { AuthUser, isTeam, RequestMeta } from '../common/decorators';
import { fail, text } from '../common/messages';
import { Notify } from '../common/notify.service';
import { Realtime } from '../common/realtime.gateway';
import { Track } from '../common/track.service';
import { MediaService } from '../media/media.service';
import { personSql } from '../users/profile';
import { VISIBLE } from './stories.service';

@Injectable()
export class CommentsService {
  constructor(private readonly db: Db, private readonly ai: Ai, private readonly notify: Notify, private readonly live: Realtime, private readonly track: Track, private readonly media: MediaService) {}

  private async story(id: string, viewer?: AuthUser | null) {
    const s = await this.db.one(`SELECT s.id, s.code, s.author_id, s.posted_as, s.comments_locked, s.comments_locked_reason, s.comments_hidden, s.comments_hidden_reason, s.comment_count
      FROM stories s LEFT JOIN users au ON au.id = s.author_id WHERE s.id = $2 AND (${VISIBLE('$1::uuid')} OR $3)`, [viewer?.id ?? null, id, isTeam(viewer?.role)]);
    return s ?? fail(404, 'not_found');
  }

  /** Threaded comments: most reactions first by default, or most recent, or oldest. Replies are indented and show who they answer. */
  async list(storyId: string, sort: string | undefined, viewer?: AuthUser | null) {
    const s = await this.story(storyId, viewer);
    const state = { locked: s.commentsLocked, lockedReason: s.commentsLockedReason, hidden: s.commentsHidden, hiddenReason: s.commentsHiddenReason, count: s.commentCount };
    // Hidden comments show only their count (the project team still sees them).
    if (s.commentsHidden && !isTeam(viewer?.role)) return { ...state, items: [] };
    const order = sort === 'recent' ? 'c.created_at DESC' : sort === 'oldest' ? 'c.created_at ASC' : 'c.reaction_count DESC, c.created_at ASC';
    const rows = await this.db.q(
      `SELECT c.id, c.parent_id, c.body, c.language, c.reaction_count, c.created_at, c.status, c.author_id, ${personSql('u', 'ap')} AS author,
              ${personSql('pu', 'pap')} AS reply_to, (SELECT r.type FROM comment_reactions r WHERE r.comment_id = c.id AND r.user_id = $2::uuid) AS my_reaction,
              (SELECT to_jsonb(m) FROM media_files m WHERE m.comment_id = c.id LIMIT 1) AS file
         FROM comments c LEFT JOIN users u ON u.id = c.author_id LEFT JOIN admin_profiles ap ON ap.user_id = u.id
         LEFT JOIN comments pc ON pc.id = c.parent_id LEFT JOIN users pu ON pu.id = pc.author_id LEFT JOIN admin_profiles pap ON pap.user_id = pu.id
        WHERE c.story_id = $1 AND (c.status = 'published' OR (c.author_id = $2::uuid AND c.status = 'pending_review') OR ($3 AND c.status <> 'deleted'))
          AND ($2::uuid IS NULL OR c.author_id IS NULL OR NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id = $2 AND b.target_id = c.author_id) OR (b.user_id = c.author_id AND b.target_id = $2 AND b.kind = 'block')))
        ORDER BY ${order} LIMIT 500`, [storyId, viewer?.id ?? null, isTeam(viewer?.role)]);
    const shape = (c: Row) => ({
      id: c.id, parentId: c.parentId, text: c.body, language: c.language, reactions: c.reactionCount, createdAt: c.createdAt, status: c.status, author: c.author, replyTo: c.parentId ? c.replyTo : null,
      myReaction: c.myReaction ?? null, own: !!viewer && c.authorId === viewer.id, file: c.file ? this.media.view(this.camel(c.file)) : null, replies: [] as any[],
    });
    const all = rows.map(shape);
    const byId = new Map(all.map((c) => [c.id, c]));
    const top: typeof all = [];
    for (const c of all) {
      // Replies hang under their top-level comment, oldest first, each naming who it answers.
      let root = c.parentId ? byId.get(c.parentId) : null;
      while (root?.parentId && byId.get(root.parentId)) root = byId.get(root.parentId);
      if (root) root.replies.push(c); else top.push(c);
    }
    for (const c of top) c.replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return { ...state, items: top };
  }
  private camel(o: Record<string, any>) { const out: Row = {}; for (const k of Object.keys(o)) out[k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())] = o[k]; return out; }

  async create(storyId: string, user: AuthUser, dto: { text?: string; parentId?: string; mediaId?: string }, meta: RequestMeta) {
    const s = await this.story(storyId, user);
    if (s.commentsLocked) return fail(403, 'comments_locked', {}, { reason: s.commentsLockedReason });
    const body = (dto.text ?? '').trim();
    if (!body && !dto.mediaId) return fail(400, 'story_empty');
    if (dto.parentId && !(await this.db.one(`SELECT 1 AS x FROM comments WHERE id = $1 AND story_id = $2 AND status = 'published'`, [dto.parentId, storyId]))) return fail(400, 'invalid_input');
    if (dto.mediaId && !(await this.db.one(`SELECT 1 AS x FROM media_files WHERE id = $1 AND owner_id = $2 AND story_id IS NULL AND comment_id IS NULL AND message_id IS NULL`, [dto.mediaId, user.id]))) return fail(400, 'invalid_input');
    // AI review of comments is near-instant for text. If the AI cannot be reached, the comment is held: nothing is published unchecked.
    let flag: string | null = null, explanation: unknown = null, status = 'published';
    try {
      const r = await this.ai.review({ kind: 'comment', text: body, language: user.language });
      flag = r.flag; explanation = { summary: r.summary, guidelines: r.guidelines.filter((g) => g.score > 20) };
      if (r.flag === 'RED') status = 'pending_review';
      await this.db.q(`INSERT INTO moderation_decisions (target_type, target_id, ai_flag, ai_score, ai_explanation, model, guidance_version) VALUES ('comment', gen_random_uuid(), $1,$2,$3,$4,$5)`, [r.flag, r.score, JSON.stringify(explanation), r.model, r.guidanceVersion]).catch(() => undefined);
    } catch (e) { if (!(e instanceof AiUnavailable)) throw e; status = 'pending_review'; }
    const names = [...new Set([...body.matchAll(/@([A-Za-z0-9_]{3,30})/g)].map((m) => m[1].toLowerCase()))].slice(0, 20);
    const mentioned = names.length ? await this.db.q(`SELECT id FROM users WHERE lower(username) = ANY($1::text[]) AND status IN ('active','warned')`, [names]) : [];
    const c = (await this.db.one(`INSERT INTO comments (story_id, author_id, parent_id, body, language, mentions, ai_flag, ai_explanation, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, created_at`,
      [storyId, user.id, dto.parentId ?? null, body, user.language, mentioned.map((m) => m.id), flag, explanation ? JSON.stringify(explanation) : null, status]))!;
    if (dto.mediaId) await this.db.q(`UPDATE media_files SET comment_id = $1 WHERE id = $2`, [c.id, dto.mediaId]);
    if (status !== 'published') {
      await this.notify.admins({ group: 'moderation', kind: 'comment.held', title: 'Comment waiting for review', body: `A comment on ${s.code} was held by AI review.`, link: `/admin/moderation?tab=comments&open=${c.id}` });
      return { id: c.id, status, held: true, message: text('comment_held', meta.lang), explanation };
    }
    await this.published(c.id, s, user, dto.parentId, mentioned.map((m) => m.id));
    return { id: c.id, status, held: false, flag };
  }

  /** Counts, notifications and live updates once a comment is visible. */
  async published(commentId: string, s: Row, author: { id: string; name: string }, parentId: string | undefined | null, mentions: string[]) {
    const n = await this.db.one(`UPDATE stories SET comment_count = (SELECT count(*) FROM comments WHERE story_id = $1 AND status = 'published') WHERE id = $1 RETURNING comment_count`, [s.id]);
    await this.track.event('comment', { actor: '', actorType: 'contributor' }, { storyId: s.id, metrics: ['engagement'] });
    const told = new Set<string>([author.id]);
    const tell = async (id: string | null, kind: string, title: string) => {
      if (!id || told.has(id)) return; told.add(id);
      const blocked = await this.db.one(`SELECT 1 AS x FROM blocks WHERE user_id = $1 AND target_id = $2`, [id, author.id]);
      if (!blocked) await this.notify.send(id, { group: 'engagement', kind, title, body: s.code, link: `/stories/${s.code}?comment=${commentId}` });
    };
    for (const id of mentions) await tell(id, 'comment.mention', `${author.name} mentioned you in a comment`);
    if (parentId) { const p = await this.db.one(`SELECT author_id FROM comments WHERE id = $1`, [parentId]); await tell(p?.authorId, 'comment.reply', `${author.name} replied to your comment`); }
    if (s.postedAs !== 'company') await tell(s.authorId, 'story.comment', `${author.name} commented on your story`);
    this.live.toAll('story.comment', { storyId: s.id, commentId, count: n?.commentCount });
  }

  async remove(id: string, user: AuthUser) {
    const c = await this.db.one(`SELECT id, story_id, author_id FROM comments WHERE id = $1 AND status <> 'deleted'`, [id]);
    if (!c) return fail(404, 'not_found');
    if (c.authorId !== user.id && user.role !== 'admin') return fail(403, 'forbidden');
    await this.db.q(`UPDATE comments SET status = 'deleted' WHERE id = $1 OR parent_id = $1`, [id]);
    await this.db.q(`UPDATE stories SET comment_count = (SELECT count(*) FROM comments WHERE story_id = $1 AND status = 'published') WHERE id = $1`, [c.storyId]);
    return { ok: true };
  }

  async react(id: string, user: AuthUser, type: 'heart' | 'heartbreak' | 'laugh' | null) {
    const c = await this.db.one(`SELECT id FROM comments WHERE id = $1 AND status = 'published'`, [id]);
    if (!c) return fail(404, 'not_found');
    const cur = await this.db.one(`SELECT type FROM comment_reactions WHERE comment_id = $1 AND user_id = $2`, [id, user.id]);
    const next = !type || cur?.type === type ? null : type;
    if (next) await this.db.q(`INSERT INTO comment_reactions (comment_id, user_id, type) VALUES ($1,$2,$3) ON CONFLICT (comment_id, user_id) DO UPDATE SET type = $3`, [id, user.id, next]);
    else await this.db.q(`DELETE FROM comment_reactions WHERE comment_id = $1 AND user_id = $2`, [id, user.id]);
    const r = await this.db.one(`UPDATE comments SET reaction_count = (SELECT count(*) FROM comment_reactions WHERE comment_id = $1) WHERE id = $1 RETURNING reaction_count`, [id]);
    return { reaction: next, reactions: r?.reactionCount ?? 0 };
  }
}
