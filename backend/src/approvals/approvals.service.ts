import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Audit } from '../common/audit.service';
import { Db, Row } from '../common/db';
import { AuthUser, RequestMeta } from '../common/decorators';
import { fail, text } from '../common/messages';
import { Jobs } from '../common/jobs.service';
import { Notify } from '../common/notify.service';
import { Realtime } from '../common/realtime.gateway';
import { config } from '../config/config';

export type ApprovalType = 'override' | 'company_story' | 'collection' | 'account_deletion' | 'import_batch';
interface Effects { approved: (req: Row) => Promise<void>; rejected?: (req: Row) => Promise<void> }
const LABEL: Record<ApprovalType, string> = { override: 'AI ban override', company_story: 'Company story', collection: 'Collection', account_deletion: 'Permanent account deletion', import_batch: 'Bulk import' };

/**
 * The one shared approval engine (Section 2.7). An admin proposes an action with a written justification; the other
 * admins approve, reject or request changes, each with a justification; the action takes effect only when the approval
 * rule is met. Until then the current state remains. Every step is in the audit log.
 */
@Injectable()
export class Approvals implements OnModuleInit {
  private readonly log = new Logger('Approvals');
  private readonly effects = new Map<ApprovalType, Effects>();
  constructor(private readonly db: Db, private readonly audit: Audit, private readonly notify: Notify, private readonly live: Realtime, private readonly jobs: Jobs) {}

  onModuleInit() { this.jobs.every('approvals.overdue', 15 * 60_000, () => this.markOverdue()); }
  /** Each module says what happens when its kind of request is approved or rejected. */
  on(type: ApprovalType, effects: Effects) { this.effects.set(type, effects); }

  private async eligible(proposerId: string | null) {
    return (await this.db.q(`SELECT id FROM users WHERE role = 'admin' AND status = 'active' AND id IS DISTINCT FROM $1`, [proposerId])).map((r) => r.id as string);
  }
  private needed(eligible: number) { return config.approvals.rule === 'all' ? eligible : Math.max(1, Math.ceil(eligible * config.approvals.majority - 1e-9)); }

  async propose(p: { type: ApprovalType; targetId: string; title: string; proposer: AuthUser; justification: string; payload?: Record<string, unknown> }, meta: RequestMeta): Promise<Row> {
    if (!p.justification?.trim()) return fail(400, 'reason_required');
    const open = await this.db.one(`SELECT id FROM approval_requests WHERE type = $1 AND target_id = $2 AND status IN ('pending','changes_requested','overdue')`, [p.type, p.targetId]);
    if (open) return fail(409, 'already_exists');
    const req = (await this.db.one(
      `INSERT INTO approval_requests (type, target_id, title, proposer_id, justification, payload, deadline) VALUES ($1,$2,$3,$4,$5,$6, now() + ($7 || ' days')::interval) RETURNING *`,
      [p.type, p.targetId, p.title, p.proposer.id, p.justification.trim(), JSON.stringify(p.payload ?? {}), String(config.approvals.deadlineDays)]))!;
    await this.audit.record({ actor: p.proposer, action: `approval.propose.${p.type}`, entityType: 'approval', entityId: req.id, summary: `${p.proposer.name} proposed: ${LABEL[p.type]} – ${p.title}`, reason: p.justification, ip: meta.ip });
    const others = await this.eligible(p.proposer.id);
    await this.notify.sendMany(others, { group: 'moderation', kind: 'approval.requested', title: `Approval needed: ${LABEL[p.type]}`, body: `${p.proposer.name} proposed “${p.title}”. ${p.justification.trim()}`, link: `/admin/approvals?open=${req.id}`, priority: true, actionKey: `approval:${req.id}` });
    // With no other admin to vote, the decision goes straight to the Super Admins.
    if (!others.length) await this.escalate(req);
    this.live.toTeam('approval', { id: req.id, status: req.status });
    return this.view(req.id, p.proposer.id);
  }

  async view(id: string, viewerId: string): Promise<Row> {
    const r = await this.db.one(
      `SELECT r.*, coalesce(ap.admin_name, pu.name) AS proposer_name,
              (SELECT coalesce(jsonb_agg(jsonb_build_object('adminId', v.admin_id, 'adminName', coalesce(a.admin_name, u.name), 'vote', v.vote, 'justification', v.justification, 'at', v.created_at) ORDER BY v.created_at), '[]'::jsonb)
                 FROM approval_votes v JOIN users u ON u.id = v.admin_id LEFT JOIN admin_profiles a ON a.user_id = v.admin_id WHERE v.request_id = r.id) AS votes
         FROM approval_requests r LEFT JOIN users pu ON pu.id = r.proposer_id LEFT JOIN admin_profiles ap ON ap.user_id = r.proposer_id WHERE r.id = $1`, [id]);
    if (!r) return fail(404, 'not_found');
    const eligible = await this.eligible(r.proposerId);
    const approvals = r.votes.filter((v: any) => v.vote === 'approve' && eligible.includes(v.adminId)).length;
    return {
      ...r, typeLabel: LABEL[r.type as ApprovalType], eligible: eligible.length, needed: this.needed(eligible.length), approvals,
      rejections: r.votes.filter((v: any) => v.vote === 'reject').length,
      progress: `${approvals} of ${eligible.length} approved`, rule: config.approvals.rule,
      myVote: r.votes.find((v: any) => v.adminId === viewerId)?.vote ?? null, mine: r.proposerId === viewerId,
    };
  }

  async list(viewer: AuthUser, status?: string) {
    const rows = await this.db.q(
      `SELECT id FROM approval_requests WHERE ($1::text IS NULL OR status = $1 OR ($1 = 'open' AND status IN ('pending','changes_requested','overdue')))
        ORDER BY CASE WHEN status IN ('pending','overdue','changes_requested') THEN 0 ELSE 1 END, created_at DESC LIMIT 100`, [status ?? null]);
    return Promise.all(rows.map((r) => this.view(r.id, viewer.id)));
  }
  /** Requests waiting for this admin's decision (also listed in MY RESPONSIBILITIES). */
  async waitingFor(viewer: AuthUser) {
    const rows = await this.db.q(
      `SELECT r.id FROM approval_requests r WHERE r.status = 'pending' AND r.proposer_id IS DISTINCT FROM $1
          AND NOT EXISTS (SELECT 1 FROM approval_votes v WHERE v.request_id = r.id AND v.admin_id = $1) ORDER BY r.created_at`, [viewer.id]);
    return Promise.all(rows.map((r) => this.view(r.id, viewer.id)));
  }

  async vote(id: string, admin: AuthUser, vote: 'approve' | 'reject' | 'changes', justification: string, meta: RequestMeta) {
    if (!justification?.trim()) return fail(400, 'reason_required');
    const req = await this.db.one(`SELECT * FROM approval_requests WHERE id = $1`, [id]);
    if (!req) return fail(404, 'not_found');
    if (req.proposerId === admin.id) return fail(403, 'approval_own');
    if (req.status !== 'pending') return fail(409, 'already_exists');
    await this.db.q(`INSERT INTO approval_votes (request_id, admin_id, vote, justification) VALUES ($1,$2,$3,$4) ON CONFLICT (request_id, admin_id) DO UPDATE SET vote = $3, justification = $4, created_at = now()`, [id, admin.id, vote, justification.trim()]);
    await this.audit.record({ actor: admin, action: `approval.vote.${vote}`, entityType: 'approval', entityId: id, summary: `${admin.name} voted “${vote}” on ${LABEL[req.type as ApprovalType]} – ${req.title}`, reason: justification, ip: meta.ip });
    await this.notify.done(`approval:${id}`, admin.id);
    await this.evaluate(id, meta);
    const view = await this.view(id, admin.id);
    this.live.toTeam('approval', { id, status: view.status, progress: view.progress });
    return { ...view, message: text('approval_recorded', meta.lang) };
  }

  private async evaluate(id: string, meta: RequestMeta) {
    const v = await this.view(id, '00000000-0000-0000-0000-000000000000');
    if (v.status !== 'pending') return;
    const votes = v.votes as Array<{ vote: string }>;
    if (votes.some((x) => x.vote === 'changes')) {
      await this.db.q(`UPDATE approval_requests SET status = 'changes_requested' WHERE id = $1`, [id]);
      if (v.proposerId) await this.notify.send(v.proposerId, { group: 'moderation', kind: 'approval.changes', title: 'Changes requested', body: `An admin asked for changes to “${v.title}”.`, link: `/admin/approvals?open=${id}`, priority: true, actionKey: `approval-changes:${id}` });
      return;
    }
    const rejectLimit = config.approvals.rule === 'all' ? 0 : v.eligible - v.needed;
    if (v.approvals >= v.needed && v.eligible > 0) await this.finish(v, 'approved', null, meta);
    else if (v.rejections > rejectLimit) await this.finish(v, 'rejected', null, meta);
  }

  private async finish(req: Row, outcome: 'approved' | 'rejected', decidedBy: AuthUser | null, meta: RequestMeta) {
    const rows = await this.db.q(`UPDATE approval_requests SET status = $2, decided_at = now(), decided_by = $3 WHERE id = $1 AND status IN ('pending','overdue') RETURNING id`, [req.id, outcome, decidedBy?.id ?? null]);
    if (!rows.length) return;
    const fx = this.effects.get(req.type);
    try {
      if (outcome === 'approved') await fx?.approved(req); else await fx?.rejected?.(req);
    } catch (e) { this.log.error(`Effect of ${req.type} ${outcome} failed: ${(e as Error).stack}`); }
    await this.audit.record({ actor: decidedBy, action: `approval.${outcome}`, entityType: 'approval', entityId: req.id, summary: `${LABEL[req.type as ApprovalType]} – ${req.title}: ${outcome}${decidedBy ? ` by ${decidedBy.name} after the deadline` : ' (approval rule met)'}`, ip: meta.ip });
    await this.notify.done(`approval:${req.id}`);
    await this.notify.done(`approval-overdue:${req.id}`);
    if (req.proposerId) await this.notify.send(req.proposerId, { group: 'moderation', kind: `approval.${outcome}`, title: `${LABEL[req.type as ApprovalType]} ${outcome}`, body: `“${req.title}” was ${outcome}.`, link: `/admin/approvals?open=${req.id}` });
    this.live.toTeam('approval', { id: req.id, status: outcome });
  }

  /** The proposer answers a request for changes; voting starts again. */
  async resubmit(id: string, admin: AuthUser, justification: string, meta: RequestMeta) {
    const req = await this.db.one(`SELECT * FROM approval_requests WHERE id = $1`, [id]);
    if (!req) return fail(404, 'not_found');
    if (req.proposerId !== admin.id || req.status !== 'changes_requested') return fail(403, 'forbidden');
    if (!justification?.trim()) return fail(400, 'reason_required');
    await this.db.q(`DELETE FROM approval_votes WHERE request_id = $1`, [id]);
    await this.db.q(`UPDATE approval_requests SET status = 'pending', justification = $2, deadline = now() + ($3 || ' days')::interval WHERE id = $1`, [id, justification.trim(), String(config.approvals.deadlineDays)]);
    await this.notify.done(`approval-changes:${id}`);
    await this.audit.record({ actor: admin, action: 'approval.resubmit', entityType: 'approval', entityId: id, summary: `${admin.name} resubmitted “${req.title}”`, reason: justification, ip: meta.ip });
    await this.notify.sendMany(await this.eligible(admin.id), { group: 'moderation', kind: 'approval.requested', title: `Approval needed: ${LABEL[req.type as ApprovalType]}`, body: `${admin.name} resubmitted “${req.title}”.`, link: `/admin/approvals?open=${id}`, priority: true, actionKey: `approval:${id}` });
    return this.view(id, admin.id);
  }

  private async escalate(req: Row) {
    await this.db.q(`UPDATE approval_requests SET status = 'overdue' WHERE id = $1 AND status = 'pending'`, [req.id]);
    await this.notify.superAdmins({ group: 'moderation', kind: 'approval.overdue', title: 'A decision is waiting for you', body: `“${req.title}” (${LABEL[req.type as ApprovalType]}) needs a Super Admin decision.`, link: `/super/approvals?open=${req.id}`, priority: true, actionKey: `approval-overdue:${req.id}` });
  }
  /** Requests that pass their deadline go to the Super Admins (majority rule, Appendix B). */
  async markOverdue() {
    if (config.approvals.rule !== 'majority') return;
    for (const r of await this.db.q(`SELECT * FROM approval_requests WHERE status = 'pending' AND deadline < now()`)) await this.escalate(r);
  }
  async decideOverdue(id: string, superAdmin: AuthUser, approve: boolean, justification: string, meta: RequestMeta) {
    if (!justification?.trim()) return fail(400, 'reason_required');
    const req = await this.db.one(`SELECT * FROM approval_requests WHERE id = $1`, [id]);
    if (!req) return fail(404, 'not_found');
    if (req.status !== 'overdue') return fail(409, 'already_exists');
    await this.finish(req, approve ? 'approved' : 'rejected', superAdmin, meta);
    await this.audit.record({ actor: superAdmin, action: 'approval.super_decision', entityType: 'approval', entityId: id, summary: `Super Admin decision on “${req.title}”: ${approve ? 'approved' : 'rejected'}`, reason: justification, ip: meta.ip });
    return { ...(await this.view(id, superAdmin.id)), message: text('approval_recorded', meta.lang) };
  }
}
