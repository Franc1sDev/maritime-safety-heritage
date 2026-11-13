import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from '../database/entities';

export const IS_PUBLIC = 'isPublic';
/** Route can be called without signing in. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
/** Route needs one of these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}
export type AuthedRequest = Request & { user?: AuthUser };

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | undefined =>
  ctx.switchToHttp().getRequest<AuthedRequest>().user);

/** Who made the request, for the audit log. */
export interface RequestMeta { ip: string; userAgent: string }
export const Meta = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestMeta => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return { ip: (req.ip ?? '').slice(0, 64), userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300) };
});
