import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { config } from '../config/config';
import { Db } from './db';
import { AppError } from './messages';
import { ALLOW_INCOMPLETE, AuthedRequest, AuthUser, IS_PUBLIC, Role, ROLES } from './decorators';

export const displayName = (u: Record<string, any>): string =>
  u.role !== 'contributor' ? (u.adminName || `Admin – ${(u.name ?? '').split(' ')[0]}`)
    : u.useProviderIdentity && u.providerName ? u.providerName : (u.username ?? '');

/**
 * Applied to every route. Requires a valid access token unless the route is @Public(), re-checks the account on each
 * request so suspensions, removals and role changes take effect at once, and enforces @Roles().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService, private readonly db: Db) {}

  async userFromToken(token: string): Promise<(AuthUser & { profileComplete: boolean }) | null> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; typ: string }>(token, { secret: config.jwt.accessSecret, algorithms: ['HS256'] });
      if (payload.typ !== 'access') return null;
      const u = await this.db.one(
        `SELECT u.id, u.role, u.status, u.username, u.name, u.email, u.language, u.profile_complete, u.use_provider_identity, u.provider_name, a.admin_name
           FROM users u LEFT JOIN admin_profiles a ON a.user_id = u.id WHERE u.id = $1`, [payload.sub]);
      if (!u || !['active', 'warned'].includes(u.status)) return null;
      return { id: u.id, role: u.role, name: displayName(u), username: u.username, email: u.email, language: u.language, profileComplete: u.profileComplete };
    } catch { return null; }
  }

  /** An outdated app version is asked to update (Section 9.5). The website never sends this header. */
  private checkAppVersion(req: AuthedRequest) {
    const v = String(req.headers['x-app-version'] ?? '');
    if (!v) return;
    const n = (s: string) => s.split('.').map((x) => parseInt(x, 10) || 0);
    const a = n(v), b = n(config.minAppVersion);
    for (let i = 0; i < 3; i++) { if ((a[i] ?? 0) > (b[i] ?? 0)) return; if ((a[i] ?? 0) < (b[i] ?? 0)) throw new AppError(426, 'app_update_required', {}, { minVersion: config.minAppVersion }); }
  }
  private readonly lastSeen = new Map<string, number>();
  /** Notes that the person was active, at most once every ten minutes each. */
  private seen(id: string) {
    const now = Date.now();
    if ((this.lastSeen.get(id) ?? 0) > now - 600_000) return;
    if (this.lastSeen.size > 20_000) this.lastSeen.clear();
    this.lastSeen.set(id, now);
    void this.db.q(`UPDATE users SET last_seen_at = now() WHERE id = $1`, [id]).catch(() => undefined);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    this.checkAppVersion(ctx.switchToHttp().getRequest<AuthedRequest>());
    const targets = [ctx.getHandler(), ctx.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    let incomplete = false;
    if (token) {
      const u = await this.userFromToken(token);
      if (u) { this.seen(u.id); incomplete = !u.profileComplete; const { profileComplete: _p, ...user } = u; req.user = user; }
      else if (!isPublic) throw new UnauthorizedException({ message: 'Your session has expired. Please sign in again.', code: 'session_expired' });
    }
    if (isPublic) return true;
    if (!req.user) throw new UnauthorizedException({ message: 'Sign in to react, comment, save favourites or share your own story.', code: 'sign_in_required' });
    if (incomplete && !this.reflector.getAllAndOverride<boolean>(ALLOW_INCOMPLETE, targets)) {
      throw new ForbiddenException({ message: 'Finish setting up your profile first.', code: 'profile_incomplete' });
    }
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, targets);
    if (roles?.length && !roles.includes(req.user.role)) {
      // Permission errors are security events: they are logged.
      void this.db.q(`INSERT INTO activity_log (actor_id, actor_name, action, summary, ip) VALUES ($1,$2,'permission.denied',$3,$4)`, [req.user.id, req.user.name, `${req.method} ${req.path}`.slice(0, 300), (req.ip ?? '').slice(0, 64)]).catch(() => undefined);
      throw new ForbiddenException({ message: 'You do not have permission to do this.', code: 'forbidden' });
    }
    return true;
  }
}
