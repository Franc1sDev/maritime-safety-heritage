import { ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { getDummyHash, hashPassword, randomToken, sha256, verifyPassword } from '../common/crypto';
import { RequestMeta } from '../common/decorators';
import { MailService } from '../common/mail.service';
import { config } from '../config/config';
import { PasswordResetToken, RefreshToken, User } from '../database/entities';
import { publicUser, RegisterDto } from '../users/user.dto';

export interface Session { accessToken: string; expiresIn: number; refreshToken: string; refreshExpiresAt: Date; user: ReturnType<typeof publicUser> }

const INVALID = 'Email or password is incorrect.';
const parseTtl = (ttl: string) => {
  const m = /^(\d+)([smhd]?)$/.exec(ttl);
  if (!m) return 900;
  return Number(m[1]) * ({ s: 1, m: 60, h: 3600, d: 86400, '': 1 } as Record<string, number>)[m[2]];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly activity: ActivityService,
    private readonly mail: MailService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken) private readonly tokens: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken) private readonly resets: Repository<PasswordResetToken>,
  ) {}

  private hashRefresh(token: string) {
    return createHmac('sha256', config.jwt.refreshSecret).update(token).digest('hex');
  }

  private async issue(user: User, meta: RequestMeta): Promise<Session> {
    const expiresIn = parseTtl(config.jwt.accessTtl);
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role, typ: 'access' }, { secret: config.jwt.accessSecret, expiresIn, algorithm: 'HS256' });
    const refreshToken = randomToken(48);
    const refreshExpiresAt = new Date(Date.now() + config.jwt.refreshDays * 86400_000);
    await this.tokens.insert({ userId: user.id, tokenHash: this.hashRefresh(refreshToken), expiresAt: refreshExpiresAt, userAgent: meta.userAgent, ip: meta.ip });
    return { accessToken, expiresIn, refreshToken, refreshExpiresAt, user: publicUser(user) };
  }

  async register(dto: RegisterDto, meta: RequestMeta): Promise<Session> {
    if (!config.allowRegistration) throw new ForbiddenException('New accounts are created by the archive team. Contact us to request one.');
    if (await this.users.existsBy({ email: dto.email })) throw new ConflictException('An account with this email already exists. Sign in instead.');
    const user = await this.users.save(this.users.create({
      name: dto.name, email: dto.email, organisation: dto.organisation ?? '', passwordHash: await hashPassword(dto.password), role: 'user', lastLoginAt: new Date(),
    }));
    await this.activity.record({ actor: user, action: 'user.register', entityType: 'user', entityId: user.id, summary: `${user.name} created an account`, ip: meta.ip });
    return this.issue(user, meta);
  }

  async login(email: string, password: string, meta: RequestMeta): Promise<Session> {
    const user = await this.users.createQueryBuilder('u').addSelect(['u.passwordHash', 'u.failedLogins', 'u.lockedUntil'])
      .where('u.email = :email', { email }).getOne();
    if (!user) {
      await verifyPassword(password, await getDummyHash());
      await this.activity.record({ action: 'login.failed', summary: `Failed sign-in for unknown email`, details: { email }, ip: meta.ip });
      throw new UnauthorizedException(INVALID);
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new HttpException(`Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}, or reset your password.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      const failed = user.failedLogins + 1;
      const lock = failed >= config.security.maxFailedLogins;
      await this.users.update(user.id, lock
        ? { failedLogins: 0, lockedUntil: new Date(Date.now() + config.security.lockMinutes * 60000) }
        : { failedLogins: failed });
      await this.activity.record({ actor: user, action: lock ? 'login.locked' : 'login.failed', entityType: 'user', entityId: user.id,
        summary: lock ? `Account locked after ${failed} failed sign-ins` : 'Failed sign-in', ip: meta.ip });
      throw new UnauthorizedException(INVALID);
    }
    if (user.status !== 'active') throw new ForbiddenException('This account is suspended. Contact the archive team.');
    user.lastLoginAt = new Date();
    await this.users.update(user.id, { failedLogins: 0, lockedUntil: null, lastLoginAt: user.lastLoginAt });
    await this.activity.record({ actor: user, action: 'login', entityType: 'user', entityId: user.id, summary: `${user.name} signed in`, ip: meta.ip });
    return this.issue(user, meta);
  }

  /** Swaps a refresh token for a new pair. A token used twice signals theft, so every session of that account is ended. */
  async refresh(token: string, meta: RequestMeta): Promise<Session> {
    const row = token ? await this.tokens.findOneBy({ tokenHash: this.hashRefresh(token) }) : null;
    if (!row) throw new UnauthorizedException('Your session has ended. Sign in again.');
    if (row.revokedAt) {
      await this.revokeAll(row.userId);
      await this.activity.record({ actor: { id: row.userId, name: '' }, action: 'session.reuse', entityType: 'user', entityId: row.userId,
        summary: 'A used sign-in token was presented again; all sessions were ended', ip: meta.ip });
      throw new UnauthorizedException('Your session has ended. Sign in again.');
    }
    if (row.expiresAt <= new Date()) throw new UnauthorizedException('Your session has ended. Sign in again.');
    const user = await this.users.findOneBy({ id: row.userId });
    if (!user || user.status !== 'active') throw new UnauthorizedException('Your session has ended. Sign in again.');
    const res = await this.tokens.update({ id: row.id, revokedAt: IsNull() }, { revokedAt: new Date() });
    if (!res.affected) throw new UnauthorizedException('Your session has ended. Sign in again.');
    return this.issue(user, meta);
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.tokens.update({ tokenHash: this.hashRefresh(token), revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.tokens.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async changePassword(userId: string, current: string, next: string, meta: RequestMeta): Promise<void> {
    const user = await this.users.createQueryBuilder('u').addSelect('u.passwordHash').where('u.id = :userId', { userId }).getOneOrFail();
    if (!(await verifyPassword(current, user.passwordHash))) throw new ForbiddenException('Your current password is incorrect.');
    if (current === next) throw new ConflictException('Choose a password you have not used here before.');
    await this.users.update(userId, { passwordHash: await hashPassword(next) });
    await this.revokeAll(userId);
    await this.activity.record({ actor: user, action: 'password.change', entityType: 'user', entityId: userId, summary: `${user.name} changed their password`, ip: meta.ip });
  }

  /** Always answers the same way, so it cannot be used to discover which emails have accounts. */
  async forgotPassword(email: string, meta: RequestMeta): Promise<void> {
    const user = await this.users.findOneBy({ email });
    if (!user || user.status !== 'active') return;
    const recent = await this.resets.countBy({ userId: user.id, createdAt: MoreThan(new Date(Date.now() - 3600_000)) });
    if (recent >= 3) return;
    const token = randomToken(32);
    await this.resets.insert({ userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60000) });
    const link = `${config.mail.webBaseUrl.replace(/\/$/, '')}/#/reset-password?token=${token}`;
    await this.mail.send(user.email, 'Reset your Maritime Safety Heritage Archive password',
      `Hello ${user.name},\n\nUse this link within 30 minutes to choose a new password:\n${link}\n\nIf you did not ask for this, ignore this email; your password stays the same.\n`);
    await this.activity.record({ actor: user, action: 'password.reset_requested', entityType: 'user', entityId: user.id, summary: 'Password reset link sent', ip: meta.ip });
  }

  async resetPassword(token: string, password: string, meta: RequestMeta): Promise<void> {
    const row = await this.resets.findOneBy({ tokenHash: sha256(token), usedAt: IsNull(), expiresAt: MoreThan(new Date()) });
    if (!row) throw new UnauthorizedException('This reset link has expired or was already used. Ask for a new one.');
    await this.resets.update(row.id, { usedAt: new Date() });
    await this.users.update(row.userId, { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null });
    await this.revokeAll(row.userId);
    const user = await this.users.findOneBy({ id: row.userId });
    await this.activity.record({ actor: user, action: 'password.reset', entityType: 'user', entityId: row.userId, summary: 'Password reset with an emailed link', ip: meta.ip });
  }
}
