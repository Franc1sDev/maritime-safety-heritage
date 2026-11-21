import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac, randomInt } from 'crypto';
import { Audit } from '../common/audit.service';
import { displayName } from '../common/auth.guard';
import { hashPassword, PASSWORD_RULE, randomToken, sha256, verifyPassword, getDummyHash } from '../common/crypto';
import { Db, Row } from '../common/db';
import { RequestMeta } from '../common/decorators';
import { decryptField, encryptField } from '../common/field-crypto';
import { MailService } from '../common/mail.service';
import { fail, longDate, text } from '../common/messages';
import { Notify } from '../common/notify.service';
import { Realtime } from '../common/realtime.gateway';
import { config } from '../config/config';
import { AVATARS, mergeSettings, usernameProblem } from '../users/profile';
import { Claims, OAuthService, Provider, PROVIDERS } from './oauth.service';
import { newTotpSecret, otpauthUrl, verifyTotp } from './totp';

export interface Session { accessToken: string; expiresIn: number; refreshToken: string; refreshExpiresAt: Date; user: Row }
const parseTtl = (ttl: string) => {
  const m = /^(\d+)([smhd]?)$/.exec(ttl);
  return m ? Number(m[1]) * ({ s: 1, m: 60, h: 3600, d: 86400, '': 1 } as Record<string, number>)[m[2]] : 900;
};
const COMMON_PASSWORDS = new Set(['password1', 'password123', 'qwerty123', '12345678a', 'admin1234', 'welcome1', 'letmein1', 'iloveyou1', 'abc12345', 'passw0rd']);

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService, private readonly db: Db, private readonly audit: Audit, private readonly mail: MailService,
    private readonly oauth: OAuthService, private readonly notify: Notify, private readonly live: Realtime,
  ) {}

  private hashRefresh(token: string) { return createHmac('sha256', config.jwt.refreshSecret).update(token).digest('hex'); }

  /** The signed-in person's own account, as the website and apps show it. */
  async me(userId: string): Promise<Row> {
    const u = await this.db.one(
      `SELECT u.*, a.admin_name, a.admin_code, a.staff_number, a.phone, a.mfa_totp_enabled, a.email_verified,
              (SELECT count(*)::int FROM follows f WHERE f.followee_id = u.id) AS followers,
              (SELECT count(*)::int FROM follows f WHERE f.follower_id = u.id) AS following,
              (SELECT count(*)::int FROM stories s WHERE s.author_id = u.id AND s.status = 'published' AND s.posted_as <> 'company') AS story_count
         FROM users u LEFT JOIN admin_profiles a ON a.user_id = u.id WHERE u.id = $1`, [userId]);
    if (!u) return fail(404, 'not_found');
    const team = u.role !== 'contributor';
    return {
      id: u.id, role: u.role, status: u.status, username: u.username, name: displayName(u),
      avatar: team ? 'logo' : u.useProviderIdentity && u.providerPicture ? u.providerPicture : u.photoMediaId ? `media:${u.photoMediaId}` : `avatar:${u.avatar || 'wave'}`,
      badge: team ? 'ADMIN' : null, email: u.email, provider: u.provider, providerName: u.providerName, providerPicture: u.providerPicture,
      useProviderIdentity: u.useProviderIdentity, language: u.language, theme: u.theme, settings: mergeSettings(u.settings),
      profileComplete: u.profileComplete, warnings: u.warnings, followers: u.followers, following: u.following, storyCount: u.storyCount, createdAt: u.createdAt,
      admin: team ? { adminName: u.adminName, adminId: u.adminCode, staffNumber: u.staffNumber, phone: u.phone, mfaAuthenticator: u.mfaTotpEnabled, emailVerified: u.emailVerified } : undefined,
    };
  }

  async issue(userId: string, meta: RequestMeta): Promise<Session> {
    const expiresIn = parseTtl(config.jwt.accessTtl);
    const user = await this.me(userId);
    const accessToken = await this.jwt.signAsync({ sub: userId, role: user.role, typ: 'access' }, { secret: config.jwt.accessSecret, expiresIn, algorithm: 'HS256' });
    const refreshToken = randomToken(48);
    const refreshExpiresAt = new Date(Date.now() + config.jwt.refreshDays * 86400_000);
    await this.db.q(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip) VALUES ($1,$2,$3,$4,$5)`, [userId, this.hashRefresh(refreshToken), refreshExpiresAt, meta.userAgent, meta.ip]);
    await this.db.q(`UPDATE users SET last_login_at = now(), last_seen_at = now() WHERE id = $1`, [userId]);
    return { accessToken, expiresIn, refreshToken, refreshExpiresAt, user };
  }

  private async limited(userId: string, typ: string, minutes: number) {
    return this.jwt.signAsync({ sub: userId, typ }, { secret: config.jwt.accessSecret, expiresIn: minutes * 60, algorithm: 'HS256' });
  }
  private async readLimited(token: string, typ: string): Promise<string> {
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; typ: string }>(token, { secret: config.jwt.accessSecret, algorithms: ['HS256'] });
      if (p.typ !== typ) throw new Error('wrong type');
      return p.sub;
    } catch { return fail(401, 'session_expired'); }
  }

  // ---------- Contributors: Google or Apple only ----------

  async signInWithProvider(p: Provider, idToken: string, given: { name?: string }, meta: RequestMeta) {
    if (!this.oauth.enabled(p)) return fail(503, 'sign_in_failed');
    const c = await this.oauth.verify(p, idToken);
    return this.signInContributor(p, c, given, meta);
  }

  private async signInContributor(p: Provider, c: Pick<Claims, 'sub' | 'email' | 'email_verified' | 'name' | 'given_name' | 'family_name' | 'picture'>, given: { name?: string }, meta: RequestMeta) {
    const col = PROVIDERS[p].column;
    const email = (c.email ?? '').trim().toLowerCase() || null;
    const verified = c.email_verified === true || c.email_verified === 'true';
    const providerName = ((given.name ?? '').trim() || c.name || [c.given_name, c.family_name].filter(Boolean).join(' ') || '').slice(0, 80);
    let user = await this.db.one(`SELECT * FROM users WHERE ${col} = $1`, [c.sub]);
    let created = false;
    if (!user && email && verified) {
      user = await this.db.one(`SELECT * FROM users WHERE email = $1`, [email]);
      if (user && user.role !== 'contributor') return fail(403, 'forbidden', {}, { hint: 'admin_sign_in' });
      if (user) await this.db.q(`UPDATE users SET ${col} = $2, provider = $3 WHERE id = $1`, [user.id, c.sub, p]);
    }
    if (!user) {
      user = await this.db.one(
        `INSERT INTO users (name, email, role, provider, provider_name, provider_picture, ${col}, password_set, language)
         VALUES ($1, $2, 'contributor', $3, $4, $5, $6, false, $7) RETURNING *`,
        [providerName || 'Contributor', email && verified ? email : null, p, providerName, c.picture ?? '', c.sub, ['en', 'sw', 'luo'].includes(meta.lang) ? meta.lang : 'en']);
      created = true;
      await this.audit.record({ actor: { id: user!.id, name: providerName }, action: 'user.register', entityType: 'user', entityId: user!.id, summary: `New contributor signed in with ${PROVIDERS[p].name}`, ip: meta.ip });
    } else if ((providerName && providerName !== user.providerName) || (c.picture && c.picture !== user.providerPicture)) {
      await this.db.q(`UPDATE users SET provider_name = CASE WHEN $2 <> '' THEN $2 ELSE provider_name END, provider_picture = CASE WHEN $3 <> '' THEN $3 ELSE provider_picture END WHERE id = $1`, [user.id, providerName, c.picture ?? '']);
    }
    await this.checkStatus(user!, meta);
    await this.audit.record({ actor: { id: user!.id, name: user!.username ?? providerName }, action: 'login', entityType: 'user', entityId: user!.id, summary: `Signed in with ${PROVIDERS[p].name}`, ip: meta.ip });
    return { ...(await this.issue(user!.id, meta)), created };
  }

  /** Account messages at sign-in: suspended (with end date and reason), deleted within 30 days (offer to restore), removed. */
  private async checkStatus(user: Row, meta: RequestMeta) {
    if (user.status === 'suspended') {
      if (user.suspendedUntil && new Date(user.suspendedUntil) <= new Date()) {
        await this.db.q(`UPDATE users SET status = 'active', suspended_until = NULL WHERE id = $1`, [user.id]);
        return;
      }
      return fail(403, 'account_suspended', { date: user.suspendedUntil ? longDate(user.suspendedUntil, meta.lang) : '' },
        { until: user.suspendedUntil, reason: user.statusReason, askWhyToken: await this.limited(user.id, 'ask_why', 30) });
    }
    if (user.status === 'deleted') {
      if (user.purgeAt && new Date(user.purgeAt) > new Date()) {
        return fail(409, 'account_deleted_restore', { date: longDate(user.purgeAt, meta.lang) }, { purgeAt: user.purgeAt, restoreToken: await this.limited(user.id, 'restore', 30) });
      }
      return fail(403, 'account_removed');
    }
    if (user.status === 'removed' || user.status === 'declined') return fail(403, 'account_removed');
    if (user.status === 'pending') return fail(403, 'admin_awaiting_approval');
  }

  async restore(restoreToken: string, meta: RequestMeta): Promise<Session> {
    const userId = await this.readLimited(restoreToken, 'restore');
    const rows = await this.db.q(`UPDATE users SET status = 'active', deleted_at = NULL, purge_at = NULL, deletion_reason = '' WHERE id = $1 AND status = 'deleted' AND purge_at > now() RETURNING id`, [userId]);
    if (!rows.length) return fail(403, 'account_removed');
    await this.db.q(`UPDATE stories SET status = 'published', deleted_at = NULL, purge_at = NULL WHERE author_id = $1 AND status = 'deleted' AND removed_reason = 'account_deleted'`, [userId]);
    await this.audit.record({ actor: { id: userId, name: '' }, action: 'account.restore', entityType: 'user', entityId: userId, summary: 'Account restored within the 30-day recovery period', ip: meta.ip });
    return this.issue(userId, meta);
  }
  askWhyUser(token: string) { return this.readLimited(token, 'ask_why'); }

  /** Local demo and automated tests only. */
  async demoSignIn(name: string, meta: RequestMeta) {
    if (!config.demoSignIn) return fail(404, 'not_found');
    const clean = name.replace(/[^A-Za-z0-9_]/g, '').slice(0, 24) || 'demo';
    return this.signInContributor('google', { sub: `demo-${clean.toLowerCase()}`, email: `${clean.toLowerCase()}@demo.invalid`, email_verified: true, name: clean }, {}, meta);
  }

  async usernameState(username: string, exceptUserId?: string): Promise<string> {
    const problem = usernameProblem(username);
    if (problem) return problem;
    const taken = await this.db.one(`SELECT 1 AS x FROM users WHERE lower(username) = lower($1) AND id IS DISTINCT FROM $2`, [username, exceptUserId ?? null]);
    return taken ? 'username_taken' : 'username_available';
  }

  /** First-time profile setup, and later changes from MY PROFILE. */
  async saveProfile(userId: string, dto: { useProviderIdentity?: boolean; username?: string; avatar?: string; photoMediaId?: string | null; language?: string; theme?: string; acceptTerms?: boolean; ageConfirmed?: boolean }, meta: RequestMeta) {
    const u = await this.db.one(`SELECT * FROM users WHERE id = $1`, [userId]);
    if (!u) return fail(404, 'not_found');
    if (u.role !== 'contributor') return fail(403, 'forbidden');
    const set: string[] = []; const params: unknown[] = [userId];
    const add = (col: string, v: unknown) => { params.push(v); set.push(`${col} = $${params.length}`); };
    if (!u.profileComplete) {
      if (!dto.acceptTerms || !dto.ageConfirmed) return fail(400, 'terms_required');
      add('accepted_terms_at', new Date()); add('age_confirmed', true); add('profile_complete', true);
    }
    const username = dto.username?.trim() || (!u.username ? `user_${randomInt(1000, 99999)}` : undefined);
    if (dto.username !== undefined || !u.username) {
      // A person who keeps their Google or Apple name still gets a handle, for mentions and links.
      let candidate = username!;
      if (dto.username) { const st = await this.usernameState(candidate, userId); if (st !== 'username_available') return fail(st === 'username_taken' ? 409 : 400, st); }
      else { while ((await this.usernameState(candidate, userId)) !== 'username_available') candidate = `user_${randomInt(1000, 999999)}`; }
      add('username', candidate);
    }
    if (dto.useProviderIdentity !== undefined) add('use_provider_identity', !!dto.useProviderIdentity);
    if (dto.avatar !== undefined) { if (!AVATARS.includes(dto.avatar)) return fail(400, 'invalid_input'); add('avatar', dto.avatar); add('photo_media_id', null); }
    if (dto.photoMediaId) {
      const m = await this.db.one(`SELECT id FROM media_files WHERE id = $1 AND owner_id = $2 AND kind = 'image' AND purpose = 'avatar'`, [dto.photoMediaId, userId]);
      if (!m) return fail(400, 'invalid_input');
      add('photo_media_id', dto.photoMediaId);
    }
    if (dto.language) add('language', dto.language);
    if (dto.theme) add('theme', dto.theme);
    if (set.length) await this.db.q(`UPDATE users SET ${set.join(', ')}, updated_at = now() WHERE id = $1`, params);
    return { user: await this.me(userId), message: text('profile_saved', dto.language ?? meta.lang) };
  }

  // ---------- Admins and Super Admins: registration, password and multi-factor authentication ----------

  async checkPassword(password: string) {
    if (!PASSWORD_RULE.test(password)) return fail(400, 'password_weak');
    if (COMMON_PASSWORDS.has(password.toLowerCase())) return fail(400, 'password_breached');
    if (config.env === 'test') return;
    // Checked against known breached passwords without sending the password: only the first 5 characters of its hash leave the server.
    try {
      const h = createHash('sha1').update(password).digest('hex').toUpperCase();
      const r = await fetch(`https://api.pwnedpasswords.com/range/${h.slice(0, 5)}`, { headers: { 'Add-Padding': 'true' }, signal: AbortSignal.timeout(4000) });
      if (r.ok && (await r.text()).split('\n').some((l) => { const [suffix, n] = l.trim().split(':'); return suffix === h.slice(5) && Number(n) > 0; })) return fail(400, 'password_breached');
    } catch (e) { if ((e as { code?: string }).code === 'password_breached') throw e; /* the check is best-effort when the service cannot be reached */ }
  }

  async registerAdmin(dto: { fullName: string; email: string; phone: string; staffNumber: string; idNumber?: string; password: string; inviteToken?: string }, meta: RequestMeta) {
    await this.checkPassword(dto.password);
    const email = dto.email.trim().toLowerCase();
    let invite: Row | null = null;
    if (dto.inviteToken) {
      invite = await this.db.one(`SELECT a.user_id FROM admin_profiles a JOIN users u ON u.id = a.user_id WHERE a.invite_token_hash = $1 AND a.invite_expires_at > now() AND u.email = $2 AND u.status = 'pending'`, [sha256(dto.inviteToken), email]);
      if (!invite) return fail(403, 'forbidden');
    } else if (await this.db.one(`SELECT 1 AS x FROM users WHERE email = $1`, [email])) return fail(409, 'already_exists');
    const adminName = `Admin – ${dto.fullName.trim().split(/\s+/)[0]}`;
    const hash = await hashPassword(dto.password);
    const idEnc = dto.idNumber ? encryptField(dto.idNumber.trim()) : null;
    let userId: string;
    if (invite) {
      userId = invite.userId;
      // An invited admin was approved by the Super Admin who invited them; they still set up MFA at first sign-in.
      await this.db.q(`UPDATE users SET name = $2, password_hash = $3, password_set = true, status = 'active', profile_complete = true WHERE id = $1`, [userId, dto.fullName.trim(), hash]);
      await this.db.q(`UPDATE admin_profiles SET admin_name = $2, staff_number = $3, id_number_enc = $4, phone = $5, invite_token_hash = NULL, approved_by = invited_by, approved_at = now(), email_verified = true WHERE user_id = $1`,
        [userId, adminName, dto.staffNumber, idEnc, dto.phone]);
    } else {
      const u = await this.db.one(`INSERT INTO users (name, email, password_hash, role, status, provider, profile_complete, password_set) VALUES ($1,$2,$3,'admin','pending','password',true,true) RETURNING id`, [dto.fullName.trim(), email, hash]);
      userId = u!.id;
      await this.db.q(`INSERT INTO admin_profiles (user_id, admin_name, staff_number, id_number_enc, phone) VALUES ($1,$2,$3,$4,$5)`, [userId, adminName, dto.staffNumber, idEnc, dto.phone]);
      await this.notify.superAdmins({ group: 'account', kind: 'admin.registration', title: 'New admin registration', body: `${dto.fullName.trim()} has registered as an admin and is waiting for your approval.`, link: '/super/admins', priority: true, actionKey: `admin-registration:${userId}`, email: true });
    }
    await this.audit.record({ actor: { id: userId, name: adminName }, action: invite ? 'admin.invite_accepted' : 'admin.register', entityType: 'user', entityId: userId, summary: `${adminName} ${invite ? 'completed an invited registration' : 'registered and awaits Super Admin approval'}`, ip: meta.ip });
    return { message: text(invite ? 'profile_saved' : 'admin_registration_sent', meta.lang), status: invite ? 'active' : 'pending' };
  }

  private async lockIfNeeded(user: Row, failed: number, meta: RequestMeta) {
    const lock = failed >= config.security.maxFailedLogins;
    await this.db.q(lock ? `UPDATE users SET failed_logins = 0, locked_until = now() + ($2 || ' minutes')::interval WHERE id = $1` : `UPDATE users SET failed_logins = $2::int WHERE id = $1`,
      [user.id, lock ? String(config.security.lockMinutes) : failed]);
    await this.audit.record({ actor: { id: user.id, name: user.name }, action: lock ? 'login.locked' : 'login.failed', entityType: 'user', entityId: user.id, summary: lock ? `Sign-in locked after ${failed} failed attempts` : 'Failed sign-in', ip: meta.ip });
    if (lock && user.email) {
      void this.mail.send(user.email, 'Sign-in locked on your Remembering the Waters admin account',
        `Hello ${user.name},\n\nSign-in to your admin account was locked for ${config.security.lockMinutes} minutes after ${failed} failed attempts (from ${meta.ip || 'an unknown address'}).\nIf this was not you, change your password as soon as you can sign in.\n`);
      await this.notify.superAdmins({ group: 'account', kind: 'security.lockout', title: 'Admin sign-in locked', body: `${user.name}: sign-in was locked after repeated failed attempts.`, link: '/super/audit' });
      return fail(429, 'too_many_attempts', { minutes: config.security.lockMinutes });
    }
  }

  /** Step 1 of admin sign-in: email and password. Answers with a short-lived token for the second factor. */
  async adminLogin(emailRaw: string, password: string, meta: RequestMeta) {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.db.one(`SELECT u.*, a.mfa_totp_enabled, a.phone FROM users u JOIN admin_profiles a ON a.user_id = u.id WHERE u.email = $1 AND u.role IN ('admin','super_admin')`, [email]);
    if (!user || !user.passwordHash) {
      await verifyPassword(password, await getDummyHash());
      await this.audit.record({ action: 'login.failed', summary: 'Failed admin sign-in for an unknown email', details: { email }, ip: meta.ip });
      return fail(401, 'admin_wrong_login');
    }
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) return fail(429, 'too_many_attempts', { minutes: Math.max(1, Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000)) });
    if (!(await verifyPassword(password, user.passwordHash))) {
      await this.lockIfNeeded(user, user.failedLogins + 1, meta);
      return fail(401, 'admin_wrong_login');
    }
    await this.checkStatus(user, meta);
    const methods = [...(user.mfaTotpEnabled ? ['authenticator'] : []), 'email', ...(user.phone && config.sms.apiKey ? ['sms'] : [])];
    return { mfaRequired: true, mfaToken: await this.limited(user.id, 'mfa', 10), methods, authenticatorSetUp: !!user.mfaTotpEnabled, emailHint: email.replace(/^(.).*(@.*)$/, '$1•••$2') };
  }

  async sendMfaCode(mfaToken: string, channel: 'email' | 'sms', meta: RequestMeta) {
    const userId = await this.readLimited(mfaToken, 'mfa');
    const user = await this.db.one(`SELECT u.id, u.name, u.email, a.phone FROM users u JOIN admin_profiles a ON a.user_id = u.id WHERE u.id = $1`, [userId]);
    if (!user) return fail(401, 'session_expired');
    const recent = await this.db.one(`SELECT count(*)::int AS n FROM mfa_codes WHERE user_id = $1 AND created_at > now() - interval '10 minutes'`, [userId]);
    if ((recent?.n ?? 0) >= 5) return fail(429, 'rate_limited');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.db.q(`INSERT INTO mfa_codes (user_id, channel, code_hash, expires_at) VALUES ($1,$2,$3, now() + interval '10 minutes')`, [userId, channel, sha256(`${userId}:${code}`)]);
    if (channel === 'sms' && user.phone && config.sms.apiKey) {
      void fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST', headers: { apiKey: config.sms.apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: config.sms.username, to: user.phone, message: `Remembering the Waters code: ${code}. It expires in 10 minutes.`, ...(config.sms.from ? { from: config.sms.from } : {}) }),
        signal: AbortSignal.timeout(15_000),
      }).catch(() => undefined);
    } else {
      await this.mail.send(user.email, 'Your Remembering the Waters sign-in code', `Hello ${user.name},\n\nYour sign-in code is ${code}. It expires in 10 minutes.\n\nIf you did not try to sign in, change your password.\n`);
    }
    await this.audit.record({ actor: { id: userId, name: user.name }, action: 'mfa.code_sent', entityType: 'user', entityId: userId, summary: `Sign-in code sent by ${channel}`, ip: meta.ip });
    return { sent: true, channel };
  }

  /** Step 2 of admin sign-in: an authenticator code, or a code sent by email or SMS. */
  async verifyMfa(mfaToken: string, code: string, meta: RequestMeta): Promise<Session> {
    const userId = await this.readLimited(mfaToken, 'mfa');
    const user = await this.db.one(`SELECT u.*, a.mfa_totp_enabled, a.mfa_secret_enc FROM users u JOIN admin_profiles a ON a.user_id = u.id WHERE u.id = $1`, [userId]);
    if (!user) return fail(401, 'session_expired');
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) return fail(429, 'too_many_attempts', { minutes: config.security.lockMinutes });
    const clean = String(code).replace(/\D/g, '');
    let ok = !!(user.mfaTotpEnabled && user.mfaSecretEnc && clean.length === 6 && verifyTotp(decryptField(user.mfaSecretEnc), clean));
    if (!ok) {
      const row = await this.db.one(`UPDATE mfa_codes SET used_at = now() WHERE id = (SELECT id FROM mfa_codes WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1) RETURNING id, channel`, [userId, sha256(`${userId}:${clean}`)]);
      ok = !!row;
      if (row?.channel === 'sms') await this.db.q(`UPDATE admin_profiles SET phone_verified = true WHERE user_id = $1`, [userId]);
    }
    if (!ok) { await this.lockIfNeeded(user, user.failedLogins + 1, meta); return fail(401, 'mfa_wrong'); }
    await this.db.q(`UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1`, [userId]);
    await this.db.q(`UPDATE admin_profiles SET email_verified = true WHERE user_id = $1`, [userId]);
    await this.audit.record({ actor: { id: userId, name: user.name }, action: 'login', entityType: 'user', entityId: userId, summary: `${user.name} signed in with multi-factor authentication`, ip: meta.ip });
    return this.issue(userId, meta);
  }

  async startTotp(userId: string) {
    const u = await this.db.one(`SELECT email FROM users WHERE id = $1`, [userId]);
    const secret = newTotpSecret();
    await this.db.q(`UPDATE admin_profiles SET mfa_secret_enc = $2, mfa_totp_enabled = false WHERE user_id = $1`, [userId, encryptField(secret)]);
    return { secret, otpauthUrl: otpauthUrl(secret, u?.email ?? 'admin') };
  }
  async confirmTotp(userId: string, code: string, meta: RequestMeta) {
    const a = await this.db.one(`SELECT mfa_secret_enc FROM admin_profiles WHERE user_id = $1`, [userId]);
    if (!a?.mfaSecretEnc || !verifyTotp(decryptField(a.mfaSecretEnc), code)) return fail(400, 'mfa_wrong');
    await this.db.q(`UPDATE admin_profiles SET mfa_totp_enabled = true WHERE user_id = $1`, [userId]);
    await this.audit.record({ actor: { id: userId, name: '' }, action: 'mfa.authenticator_added', entityType: 'user', entityId: userId, summary: 'Authenticator app added', ip: meta.ip });
    return { message: text('authenticator_added', meta.lang) };
  }
  async removeTotp(userId: string, password: string, meta: RequestMeta) {
    const u = await this.db.one(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
    if (!u || !(await verifyPassword(password, u.passwordHash))) return fail(403, 'admin_wrong_login');
    await this.db.q(`UPDATE admin_profiles SET mfa_totp_enabled = false, mfa_secret_enc = NULL WHERE user_id = $1`, [userId]);
    await this.audit.record({ actor: { id: userId, name: '' }, action: 'mfa.authenticator_removed', entityType: 'user', entityId: userId, summary: 'Authenticator app removed', ip: meta.ip });
    return { ok: true };
  }

  // ---------- Sessions ----------

  /** Swaps a refresh token for a new pair. A token used twice signals theft, so every session of that account is ended. */
  async refresh(token: string | undefined, meta: RequestMeta): Promise<Session> {
    const row = token ? await this.db.one(`SELECT * FROM refresh_tokens WHERE token_hash = $1`, [this.hashRefresh(token)]) : null;
    if (!row) return fail(401, 'session_expired');
    if (row.revokedAt) {
      await this.revokeAll(row.userId);
      await this.audit.record({ actor: { id: row.userId, name: '' }, action: 'session.reuse', entityType: 'user', entityId: row.userId, summary: 'A used sign-in token was presented again; all sessions were ended', ip: meta.ip });
      return fail(401, 'session_expired');
    }
    if (new Date(row.expiresAt) <= new Date()) return fail(401, 'session_expired');
    const user = await this.db.one(`SELECT id, status FROM users WHERE id = $1`, [row.userId]);
    if (!user || !['active', 'warned'].includes(user.status)) return fail(401, 'session_expired');
    const res = await this.db.q(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL RETURNING id`, [row.id]);
    if (!res.length) return fail(401, 'session_expired');
    return this.issue(user.id, meta);
  }
  async logout(token: string | undefined) {
    if (token) await this.db.q(`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`, [this.hashRefresh(token)]);
  }
  async revokeAll(userId: string) {
    await this.db.q(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
    this.live.disconnectUser(userId);
  }
  /** Active devices, so people can see and sign out their sessions. */
  async sessions(userId: string, currentToken?: string) {
    const rows = await this.db.q(`SELECT id, user_agent, ip, created_at, expires_at, token_hash FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY created_at DESC`, [userId]);
    const cur = currentToken ? this.hashRefresh(currentToken) : '';
    return rows.map(({ tokenHash, ...r }) => ({ ...r, current: tokenHash === cur }));
  }
  async endSession(userId: string, id: string) { await this.db.q(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`, [id, userId]); return { ok: true }; }

  // ---------- Admin password and verification email ----------

  async changePassword(userId: string, current: string, next: string, meta: RequestMeta) {
    const u = await this.db.one(`SELECT name, password_hash, role FROM users WHERE id = $1`, [userId]);
    if (!u || u.role === 'contributor') return fail(403, 'forbidden');
    if (!(await verifyPassword(current, u.passwordHash))) return fail(403, 'admin_wrong_login');
    await this.checkPassword(next);
    await this.db.q(`UPDATE users SET password_hash = $2 WHERE id = $1`, [userId, await hashPassword(next)]);
    await this.revokeAll(userId);
    await this.audit.record({ actor: { id: userId, name: u.name }, action: 'password.change', entityType: 'user', entityId: userId, summary: 'Password changed', ip: meta.ip });
    return { message: text('password_changed', meta.lang) };
  }
  /** Always answers the same way, so it cannot be used to discover which emails have accounts. */
  async forgotPassword(emailRaw: string, meta: RequestMeta) {
    const user = await this.db.one(`SELECT id, name, email FROM users WHERE email = $1 AND role <> 'contributor' AND status = 'active'`, [emailRaw.trim().toLowerCase()]);
    if (!user) return;
    const recent = await this.db.one(`SELECT count(*)::int AS n FROM password_reset_tokens WHERE user_id = $1 AND created_at > now() - interval '1 hour'`, [user.id]);
    if ((recent?.n ?? 0) >= 3) return;
    const token = randomToken(32);
    await this.db.q(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '30 minutes')`, [user.id, sha256(token)]);
    await this.mail.send(user.email, 'Reset your Remembering the Waters admin password',
      `Hello ${user.name},\n\nUse this link within 30 minutes to choose a new password:\n${config.siteUrl}/admin/reset-password?token=${token}\n\nIf you did not ask for this, ignore this email; your password stays the same.\n`);
    await this.audit.record({ actor: { id: user.id, name: user.name }, action: 'password.reset_requested', entityType: 'user', entityId: user.id, summary: 'Password reset link sent', ip: meta.ip });
  }
  async resetPassword(token: string, password: string, meta: RequestMeta) {
    await this.checkPassword(password);
    const row = await this.db.one(`UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id`, [sha256(token)]);
    if (!row) return fail(401, 'session_expired');
    await this.db.q(`UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL WHERE id = $1`, [row.userId, await hashPassword(password)]);
    await this.revokeAll(row.userId);
    await this.audit.record({ actor: { id: row.userId, name: '' }, action: 'password.reset', entityType: 'user', entityId: row.userId, summary: 'Password reset with an emailed link', ip: meta.ip });
    return { message: text('password_changed', meta.lang) };
  }
  /** Admins may change their verification email (confirmed with a code sent to the new address), but not their admin name, Admin ID or image. */
  async requestEmailChange(userId: string, newEmailRaw: string, password: string) {
    const newEmail = newEmailRaw.trim().toLowerCase();
    const u = await this.db.one(`SELECT name, password_hash FROM users WHERE id = $1 AND role <> 'contributor'`, [userId]);
    if (!u || !(await verifyPassword(password, u.passwordHash))) return fail(403, 'admin_wrong_login');
    if (await this.db.one(`SELECT 1 AS x FROM users WHERE email = $1`, [newEmail])) return fail(409, 'already_exists');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.db.q(`INSERT INTO mfa_codes (user_id, channel, code_hash, expires_at) VALUES ($1,$2,$3, now() + interval '15 minutes')`, [userId, `email-change:${newEmail}`, sha256(`${userId}:${code}`)]);
    await this.mail.send(newEmail, 'Confirm your new verification email', `Hello ${u.name},\n\nYour confirmation code is ${code}. It expires in 15 minutes.\n`);
    return { sent: true };
  }
  async confirmEmailChange(userId: string, code: string, meta: RequestMeta) {
    const row = await this.db.one(`UPDATE mfa_codes SET used_at = now() WHERE id = (SELECT id FROM mfa_codes WHERE user_id = $1 AND code_hash = $2 AND channel LIKE 'email-change:%' AND used_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1) RETURNING channel`, [userId, sha256(`${userId}:${String(code).replace(/\D/g, '')}`)]);
    if (!row) return fail(400, 'mfa_wrong');
    const email = row.channel.slice('email-change:'.length);
    await this.db.q(`UPDATE users SET email = $2 WHERE id = $1`, [userId, email]);
    await this.audit.record({ actor: { id: userId, name: '' }, action: 'admin.email_changed', entityType: 'user', entityId: userId, summary: 'Verification email changed', ip: meta.ip });
    return { user: await this.me(userId), message: text('settings_saved', meta.lang) };
  }
}
