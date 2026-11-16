import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { CookieOptions, Request, Response } from 'express';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Repository } from 'typeorm';
import { AuthUser, CurrentUser, Meta, Public, RequestMeta } from '../common/decorators';
import { LoginLimit, RegisterLimit, ResetLimit } from '../common/rate-limits';
import { config } from '../config/config';
import { User } from '../database/entities';
import { ChangePasswordDto, EmailField, LoginDto, publicUser, RefreshDto, RegisterDto, ResetPasswordDto, UpdateProfileDto } from '../users/user.dto';
import { AuthService, Session } from './auth.service';
import { OAuthService } from './oauth.service';

class OAuthDto {
  @ApiProperty({ description: 'The ID token (JWT) from Google or Apple' }) @IsString() @MaxLength(8000) idToken: string;
  /** Apple only shares the person's name once, with the app rather than in the token. */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) name?: string;
}

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
  constructor(private readonly auth: AuthService, private readonly oauth: OAuthService, @InjectRepository(User) private readonly users: Repository<User>) {}

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

  @Public() @Get('providers')
  @ApiOperation({ summary: 'Which quick sign-in options (Google, Apple) this archive offers, with their public client ids' })
  providers() { return this.oauth.publicConfig(); }

  @Public() @LoginLimit() @Post('oauth/google') @HttpCode(200)
  @ApiOperation({ summary: 'Sign in (or create an account) with a Google ID token' })
  async google(@Body() dto: OAuthDto, @Meta() meta: RequestMeta, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const s = await this.oauth.signIn('google', dto.idToken, dto, meta);
    return { ...this.send(req, res, s), created: s.created };
  }

  @Public() @LoginLimit() @Post('oauth/apple') @HttpCode(200)
  @ApiOperation({ summary: 'Sign in (or create an account) with an Apple ID token' })
  async apple(@Body() dto: OAuthDto, @Meta() meta: RequestMeta, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const s = await this.oauth.signIn('apple', dto.idToken, dto, meta);
    return { ...this.send(req, res, s), created: s.created };
  }

  /**
   * Apple sends its answer here (a form post) when someone signs in with Apple from the Android app.
   * This hands the answer straight back to the app; the app then posts the ID token to oauth/apple.
   */
  @Public() @LoginLimit() @Post('oauth/apple/callback')
  @ApiOperation({ summary: 'Return address for Sign in with Apple on Android (hands the result back to the app)' })
  appleCallback(@Body() body: Record<string, unknown>, @Res() res: Response) {
    const q = new URLSearchParams();
    for (const k of ['code', 'id_token', 'state', 'user', 'error']) {
      const v = body?.[k];
      if (typeof v === 'string' && v.length < 8000) q.set(k, v);
    }
    res.redirect(303, `intent://callback?${q.toString()}#Intent;package=${config.oauth.androidPackage};scheme=signinwithapple;end`);
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
