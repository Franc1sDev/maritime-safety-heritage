import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { readerLanguage } from './messages';

export type Role = 'contributor' | 'admin' | 'super_admin';
export const isAdmin = (role?: string) => role === 'admin';
export const isTeam = (role?: string) => role === 'admin' || role === 'super_admin';

export const IS_PUBLIC = 'isPublic';
/** Route can be called without signing in (open access for visitors). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
/** Route needs one of these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const ALLOW_INCOMPLETE = 'allowIncomplete';
/** Route may be used before first-time profile setup is finished. */
export const AllowIncomplete = () => SetMetadata(ALLOW_INCOMPLETE, true);

export interface AuthUser {
  id: string;
  role: Role;
  /** What others see: the username, or "Admin – Grace" for the project team. */
  name: string;
  username: string | null;
  email: string | null;
  language: string;
}
export type AuthedRequest = Request & { user?: AuthUser };

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | undefined =>
  ctx.switchToHttp().getRequest<AuthedRequest>().user);

/** Who made the request, for the audit log and for messages in the reader's language. */
export interface RequestMeta { ip: string; userAgent: string; lang: string; visitor: string }
export const Meta = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestMeta => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  const ip = (req.ip ?? '').slice(0, 64);
  const userAgent = String(req.headers['user-agent'] ?? '').slice(0, 300);
  const lang = req.user?.language || readerLanguage(req.headers['x-language'] ?? req.headers['accept-language']);
  return { ip, userAgent, lang, visitor: `${ip}|${userAgent.slice(0, 80)}` };
});
