import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { CookieOptions, Request, Response } from 'express';
import { Repository } from 'typeorm';
import { AuthUser, CurrentUser, Meta, Public, RequestMeta } from '../common/decorators';
import { LoginLimit, RegisterLimit, ResetLimit } from '../common/rate-limits';
import { config } from '../config/config';
import { User } from '../database/entities';
import { ChangePasswordDto, EmailField, LoginDto, publicUser, RefreshDto, RegisterDto, ResetPasswordDto, UpdateProfileDto } from '../users/user.dto';
import { AuthService, Session } from './auth.service';

export const REFRESH_COOKIE = 'msh_refresh';
const cookieOptions = (expires?: Date): CookieOptions => ({
  httpOnly: true, secure: config.cookie.secure, sameSite: config.cookie.sameSite, path: '/api/v1/auth', expires,
});
/** The mobile app sends "X-Client: app" and keeps the refresh token in secure device storage. The website gets an httpOnly cookie instead. */
const isApp = (req: Request) => req.headers['x-client'] === 'app';

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

@ApiTags('Account')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, @InjectRepository(User) private readonly users: Repository<User>) {}

  private send(req: Request, res: Response, s: Session) {
    const body = { accessToken: s.accessToken, expiresIn: s.expiresIn, user: s.user } as Record<string, unknown>;
    if (isApp(req)) body.refreshToken = s.refreshToken;
    else res.cookie(REFRESH_COOKIE, s.refreshToken, cookieOptions(s.refreshExpiresAt));
    return body;
  }

  private refreshTokenFrom(req: Request, dto: RefreshDto): string | undefined {
    if (isApp(req)) return dto.refreshToken;
    // Cookie requests must carry a custom header, which a plain cross-site form cannot add.
    if (req.headers['x-requested-with'] !== 'XMLHttpRequest') return undefined;
    return readCookie(req, REFRESH_COOKIE);
  }

  @Public() @RegisterLimit() @Post('register')
  @ApiOperation({ summary: 'Create a researcher account and sign in' })
  async register(@Body() dto: RegisterDto, @Meta() meta: RequestMeta, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.send(req, res, await this.auth.register(dto, meta));
  }

  @Public() @LoginLimit() @Post('login') @HttpCode(200)
  @ApiOperation({ summary: 'Sign in' })
  async login(@Body() dto: LoginDto, @Meta() meta: RequestMeta, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.send(req, res, await this.auth.login(dto.email, dto.password, meta));
  }

  @Public() @LoginLimit() @Post('refresh') @HttpCode(200)
  @ApiOperation({ summary: 'Get a new access token (website: cookie plus X-Requested-With header; app: refreshToken in the body)' })
  async refresh(@Body() dto: RefreshDto, @Meta() meta: RequestMeta, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.send(req, res, await this.auth.refresh(this.refreshTokenFrom(req, dto) ?? '', meta));
  }

  @Public() @Post('logout') @HttpCode(204)
  @ApiOperation({ summary: 'Sign out of this device' })
  async logout(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(this.refreshTokenFrom(req, dto));
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
  }

  @ApiBearerAuth() @Post('logout-all') @HttpCode(204)
  @ApiOperation({ summary: 'Sign out of every device' })
  async logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.revokeAll(user.id);
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
  }

  @ApiBearerAuth() @Get('me')
  @ApiOperation({ summary: 'The signed-in account' })
  async me(@CurrentUser() user: AuthUser) {
    return publicUser(await this.users.findOneByOrFail({ id: user.id }));
  }

  @ApiBearerAuth() @Patch('me')
  @ApiOperation({ summary: 'Update your name or organisation' })
  async updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    await this.users.update(user.id, { ...(dto.name !== undefined && { name: dto.name }), ...(dto.organisation !== undefined && { organisation: dto.organisation }) });
    return publicUser(await this.users.findOneByOrFail({ id: user.id }));
  }

  @ApiBearerAuth() @LoginLimit() @Post('change-password') @HttpCode(204)
  @ApiOperation({ summary: 'Change your password (signs you out everywhere else)' })
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto, @Meta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword, meta);
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
  }

  @Public() @ResetLimit() @Post('forgot-password') @HttpCode(202)
  @ApiOperation({ summary: 'Email a password reset link' })
  async forgot(@Body() dto: EmailField, @Meta() meta: RequestMeta) {
    await this.auth.forgotPassword(dto.email, meta);
    return { message: 'If an account uses that email, a reset link is on its way. It works for 30 minutes.' };
  }

  @Public() @ResetLimit() @Post('reset-password') @HttpCode(204)
  @ApiOperation({ summary: 'Choose a new password with an emailed link' })
  async reset(@Body() dto: ResetPasswordDto, @Meta() meta: RequestMeta) {
    await this.auth.resetPassword(dto.token, dto.password, meta);
  }
}
