import { Body, Controller, Get, HttpCode, Injectable, Module, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { Audit } from '../common/audit.service';
import { randomToken, sha256 } from '../common/crypto';
import { dateParam, Db } from '../common/db';
import { AuthUser, CurrentUser, Meta, RequestMeta, Roles } from '../common/decorators';
import { decryptField, maskId } from '../common/field-crypto';
import { MailService } from '../common/mail.service';
import { Jobs } from '../common/jobs.service';
import { fail, text } from '../common/messages';
import { Notify } from '../common/notify.service';
import { config } from '../config/config';

/** Admin Management: admin and Super Admin accounts, the last-Super-Admin rule, and the audit log (Sections 2.3 and 3.2.12). */
@Injectable()
export class TeamService {
  constructor(private readonly db: Db, private readonly audit: Audit, private readonly mail: MailService, private readonly notify: Notify, private readonly auth: AuthService) {}

  async list() {
    const rows = await this.db.q(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.created_at, u.last_login_at, a.admin_name, a.admin_code, a.staff_number, a.phone, a.id_number_enc, a.mfa_totp_enabled, a.approved_at, a.invite_expires_at,
              (SELECT count(*)::int FROM activity_log l WHERE l.actor_id = u.id AND l.created_at > now() - interval '30 days') AS actions_30_days
         FROM users u JOIN admin_profiles a ON a.user_id = u.id WHERE u.role IN ('admin','super_admin') AND u.status IN ('active','pending') ORDER BY (u.status = 'pending') DESC, u.role DESC, a.admin_name`);
    // ID or passport numbers are visible only to Super Admins, and masked by default.
    return rows.map(({ idNumberEnc, ...r }) => ({ ...r, adminId: r.adminCode, idNumberMasked: idNumberEnc ? maskId(decryptField(idNumberEnc)) : null, invited: r.status === 'pending' && !!r.inviteExpiresAt }));
  }
  async revealId(me: AuthUser, id: string, meta: RequestMeta) {
    const a = await this.db.one(`SELECT id_number_enc, admin_name FROM admin_profiles WHERE user_id = $1`, [id]);
    if (!a?.idNumberEnc) return fail(404, 'not_found');
    await this.audit.record({ actor: me, action: 'admin.id_number_viewed', entityType: 'user', entityId: id, summary: `${me.name} viewed the ID number of ${a.adminName}`, ip: meta.ip });
    return { idNumber: decryptField(a.idNumberEnc) };
  }

  async decide(me: AuthUser, id: string, approve: boolean, meta: RequestMeta) {
    const u = await this.db.one(`SELECT u.id, u.name, u.email, a.admin_name FROM users u JOIN admin_profiles a ON a.user_id = u.id WHERE u.id = $1 AND u.role = 'admin' AND u.status = 'pending' AND a.invite_token_hash IS NULL`, [id]);
    if (!u) return fail(404, 'not_found');
    await this.db.q(`UPDATE users SET status = $2 WHERE id = $1`, [id, approve ? 'active' : 'declined']);
    if (approve) await this.db.q(`UPDATE admin_profiles SET approved_by = $2, approved_at = now() WHERE user_id = $1`, [id, me.id]);
    await this.notify.done(`admin-registration:${id}`);
    await this.mail.send(u.email, approve ? 'Your admin registration was approved' : 'Your admin registration was declined',
      approve ? `Hello ${u.name},\n\nYour registration as an admin of Remembering the Waters has been approved. Sign in at ${config.siteUrl}/admin/sign-in and set up your second sign-in step.\n` : `Hello ${u.name},\n\nYour registration as an admin of Remembering the Waters was not approved. Contact the project team if you think this is a mistake.\n`);
    await this.audit.record({ actor: me, action: approve ? 'admin.approve' : 'admin.decline', entityType: 'user', entityId: id, summary: `${me.name} ${approve ? 'approved' : 'declined'} the registration of ${u.adminName}`, ip: meta.ip });
    return { message: approve ? text('registration_approved', meta.lang) : text('approval_recorded', meta.lang) };
  }

  /** Add an admin by invitation: the invited person completes registration and sets up MFA. */
  async invite(me: AuthUser, emailRaw: string, fullName: string, meta: RequestMeta) {
    const email = emailRaw.trim().toLowerCase();
    if (await this.db.one(`SELECT 1 AS x FROM users WHERE email = $1 AND status NOT IN ('declined')`, [email])) return fail(409, 'already_exists');
    await this.db.q(`DELETE FROM users WHERE email = $1 AND status = 'declined'`, [email]);
    const token = randomToken(32);
    const u = (await this.db.one(`INSERT INTO users (name, email, role, status, provider, profile_complete) VALUES ($1,$2,'admin','pending','password',true) RETURNING id`, [fullName.trim() || email, email]))!;
    await this.db.q(`INSERT INTO admin_profiles (user_id, admin_name, invited_by, invite_token_hash, invite_expires_at) VALUES ($1,$2,$3,$4, now() + interval '7 days')`, [u.id, `Admin – ${(fullName.trim() || email).split(/\s+/)[0]}`, me.id, sha256(token)]);
    await this.mail.send(email, 'You are invited to be an admin of Remembering the Waters',
      `Hello ${fullName.trim() || ''},\n\n${me.name} has invited you to be an admin of the Remembering the Waters archive.\n\nComplete your registration within 7 days:\n${config.siteUrl}/admin/register?invite=${token}&email=${encodeURIComponent(email)}\n`);
    await this.audit.record({ actor: me, action: 'admin.invite', entityType: 'user', entityId: u.id, summary: `${me.name} invited ${email} to be an admin`, ip: meta.ip });
    return { id: u.id, message: text('invitation_sent', meta.lang, { email }) };
  }

  /** Remove an admin: they lose access immediately. */
  async remove(me: AuthUser, id: string, reason: string, meta: RequestMeta) {
    const u = await this.db.one(`SELECT u.id, u.role, u.status, a.admin_name FROM users u JOIN admin_profiles a ON a.user_id = u.id WHERE u.id = $1 AND u.role IN ('admin','super_admin')`, [id]);
    if (!u) return fail(404, 'not_found');
    if (u.role === 'super_admin') {
      const others = await this.db.one(`SELECT count(*)::int AS n FROM users WHERE role = 'super_admin' AND status = 'active' AND id <> $1`, [id]);
      if (!others?.n) return fail(409, 'last_super_admin');
    }
    await this.db.q(`UPDATE users SET status = 'removed', status_reason = $2 WHERE id = $1`, [id, reason]);
    await this.auth.revokeAll(id);
    await this.audit.record({ actor: me, action: 'admin.remove', entityType: 'user', entityId: id, summary: `${me.name} removed ${u.adminName}`, reason, ip: meta.ip });
    return { message: text('admin_removed', meta.lang, { name: u.adminName }) };
  }

  /** Add a Super Admin from the existing admins. Super Admins do not moderate stories. */
  async promote(me: AuthUser, id: string, meta: RequestMeta) {
    const u = await this.db.one(`UPDATE users SET role = 'super_admin' WHERE id = $1 AND role = 'admin' AND status = 'active' RETURNING id, name`, [id]);
    if (!u) return fail(404, 'not_found');
    await this.auth.revokeAll(id);
    await this.audit.record({ actor: me, action: 'admin.promote', entityType: 'user', entityId: id, summary: `${me.name} made ${u.name} a Super Admin`, ip: meta.ip });
    return { message: text('super_admin_added', meta.lang) };
  }

  /** The full audit log for Super Admins; an admin sees their own actions. Entries cannot be edited or deleted. */
  async auditLog(me: AuthUser, q: Record<string, string | undefined>) {
    const params: unknown[] = []; const where: string[] = [];
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (me.role !== 'super_admin') where.push(`actor_id = ${p(me.id)}`);
    else if (q.actorId) { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q.actorId)) return fail(400, 'invalid_input'); where.push(`actor_id = ${p(q.actorId)}`); }
    if (q.action) where.push(`action LIKE ${p(`${q.action.replace(/[%_]/g, '')}%`)}`);
    if ((q.from && !dateParam(q.from)) || (q.to && !dateParam(q.to)) || (q.before && !/^\d{1,15}$/.test(q.before))) return fail(400, 'invalid_input');
    if (q.from) where.push(`created_at >= ${p(dateParam(q.from))}::date`);
    if (q.to) where.push(`created_at < ${p(dateParam(q.to))}::date + 1`);
    if (q.q) where.push(`(summary ILIKE ${p(`%${q.q.replace(/[%_]/g, '')}%`)} OR actor_name ILIKE ${p(`%${q.q.replace(/[%_]/g, '')}%`)})`);
    if (q.before) where.push(`id < ${p(Number(q.before))}`);
    const rows = await this.db.q(`SELECT id, actor_id, actor_name, action, entity_type, entity_id, summary, reason, ip, created_at FROM activity_log ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT 101`, params);
    return { items: rows.slice(0, 100), nextBefore: rows.length > 100 ? rows[99].id : null };
  }

  async setTrained(me: AuthUser, id: string, on: boolean, meta: RequestMeta) {
    const u = await this.db.one(`UPDATE users SET trained = $2 WHERE id = $1 AND role = 'contributor' RETURNING username`, [id, on]);
    if (!u) return fail(404, 'not_found');
    await this.audit.record({ actor: me, action: 'contributor.trained', entityType: 'user', entityId: id, summary: `${me.name} marked @${u.username} as ${on ? '' : 'not '}a trained contributor`, ip: meta.ip });
    return { trained: on };
  }
}

class DecideDto { @IsBoolean() approve: boolean }
class InviteDto { @IsEmail() @MaxLength(254) email: string; @IsOptional() @IsString() @MaxLength(120) fullName?: string }
class ReasonDto { @IsString() @MinLength(3) @MaxLength(2000) reason: string }
class OnDto { @IsBoolean() on: boolean }

@ApiTags('Manage admins and audit log') @ApiBearerAuth()
@Controller()
export class TeamController {
  constructor(private readonly team: TeamService, private readonly jobsService: Jobs) {}
  @Roles('super_admin') @Get('super/admins') @ApiOperation({ summary: 'Admins, Super Admins and registrations waiting for approval' })
  list() { return this.team.list(); }
  @Roles('super_admin') @Post('super/admins/invite') @ApiOperation({ summary: 'Add an admin by invitation' })
  invite(@Body() dto: InviteDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.team.invite(me, dto.email, dto.fullName ?? '', meta); }
  @Roles('super_admin') @Post('super/admins/:id/decision') @HttpCode(200) @ApiOperation({ summary: 'Approve or decline an admin registration' })
  decide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.team.decide(me, id, dto.approve, meta); }
  @Roles('super_admin') @Post('super/admins/:id/remove') @HttpCode(200) @ApiOperation({ summary: 'Remove an admin (they lose access immediately)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.team.remove(me, id, dto.reason, meta); }
  @Roles('super_admin') @Post('super/admins/:id/promote') @HttpCode(200) @ApiOperation({ summary: 'Add a Super Admin from the existing admins' })
  promote(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.team.promote(me, id, meta); }
  @Roles('super_admin') @Get('super/admins/:id/id-number') @ApiOperation({ summary: 'Show an admin’s ID or passport number (recorded in the audit log)' })
  reveal(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.team.revealId(me, id, meta); }
  @Roles('super_admin') @Get('super/jobs') @ApiOperation({ summary: 'Background job queue: waiting, working and failed' })
  jobs() { return this.jobsService.status(); }
  @Roles('admin', 'super_admin') @Get('admin/audit-log') @ApiOperation({ summary: 'The audit log: Super Admins see everything, admins their own actions' })
  audit(@CurrentUser() me: AuthUser, @Query() q: Record<string, string>) { return this.team.auditLog(me, q); }
  @Roles('admin') @Put('admin/contributors/:id/trained') @ApiOperation({ summary: 'Mark a Contributor as trained (for the “active trained contributors” measure)' })
  trained(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OnDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.team.setTrained(me, id, dto.on, meta); }
}

@Module({ imports: [AuthModule], controllers: [TeamController], providers: [TeamService] })
export class TeamModule {}
