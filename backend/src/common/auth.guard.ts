import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { config } from '../config/config';
import { User, Role } from '../database/entities';
import { AuthedRequest, IS_PUBLIC, ROLES } from './decorators';

/**
 * Applied to every route. Requires a valid access token unless the route is @Public(),
 * re-checks the account on each request so suspensions and role changes take effect at once,
 * and enforces @Roles().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';

    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string; typ: string }>(token, { secret: config.jwt.accessSecret, algorithms: ['HS256'] });
        if (payload.typ !== 'access') throw new Error('wrong token type');
        const user = await this.users.findOneBy({ id: payload.sub });
        if (!user || user.status !== 'active') throw new Error('inactive');
        req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
      } catch {
        if (!isPublic) throw new UnauthorizedException('Your session has expired. Sign in again.');
      }
    }
    if (isPublic) return true;
    if (!req.user) throw new UnauthorizedException('Sign in to continue.');

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, targets);
    if (roles?.length && !roles.includes(req.user.role)) throw new ForbiddenException('You do not have permission to do this.');
    return true;
  }
}
