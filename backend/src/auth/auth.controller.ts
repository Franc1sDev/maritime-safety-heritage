import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import type { CookieOptions, Request, Response } from 'express';
import { AllowIncomplete, AuthUser, CurrentUser, Meta, Public, RequestMeta, Roles } from '../common/decorators';
import { LoginLimit, RegisterLimit, ResetLimit } from '../common/rate-limits';
import { LANGUAGES, text } from '../common/messages';
import { config } from '../config/config';
import { AVATARS } from '../users/profile';
import { AuthService, Session } from './auth.service';
import { OAuthService } from './oauth.service';

class OAuthDto {
  @IsString() @MaxLength(8000) idToken: string;
  /** Apple only shares the person's name once, with the app rather than in the token. */
  @IsOptional() @IsString() @MaxLength(120) name?: string;
}
class DemoDto { @IsString() @MaxLength(40) name: string }
class TokenDto { @IsString() @MaxLength(2000) token: string }
class RefreshDto { @IsOptional() @IsString() @MaxLength(400) refreshToken?: string }
export class ProfileDto {
  @IsOptional() @IsBoolean() useProviderIdentity?: boolean;
  @IsOptional() @IsString() @MaxLength(30) username?: string;
  @IsOptional() @IsIn(AVATARS) avatar?: string;
  @IsOptional() @IsUUID() photoMediaId?: string;
  @IsOptional() @IsIn(LANGUAGES as unknown as string[]) language?: string;
  @IsOptional() @IsIn(['light', 'dark', 'auto']) theme?: string;
  @IsOptional() @IsBoolean() acceptTerms?: boolean;
  @IsOptional() @IsBoolean() ageConfirmed?: boolean;
}
class AdminRegisterDto {
  @IsString() @MinLength(2) @MaxLength(120) fullName: string;
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @Matches(/^\+?[0-9 ]{7,20}$/) phone: string;
  @IsString() @MinLength(1) @MaxLength(40) staffNumber: string;
  @IsOptional() @IsString() @MaxLength(40) idNumber?: string;
  @IsString() @MaxLength(128) password: string;
  @IsOptional() @IsString() @MaxLength(200) inviteToken?: string;
}
class AdminLoginDto { @IsEmail() @MaxLength(254) email: string; @IsString() @MaxLength(128) password: string }
class MfaSendDto { @IsString() @MaxLength(2000) mfaToken: string; @IsIn(['email', 'sms']) channel: 'email' | 'sms' }
class MfaVerifyDto { @IsString() @MaxLength(2000) mfaToken: string; @IsString() @MaxLength(12) code: string }
class CodeDto { @IsString() @MaxLength(12) code: string }
class PasswordOnlyDto { @IsString() @MaxLength(128) password: string }
class ChangePasswordDto { @IsString() @MaxLength(128) currentPassword: string; @IsString() @MaxLength(128) newPassword: string }
class EmailDto { @IsEmail() @MaxLength(254) email: string }
class EmailChangeDto { @IsEmail() @MaxLength(254) email: string; @IsString() @MaxLength(128) password: string }
class ResetDto { @IsString() @MaxLength(200) token: string; @IsString() @MaxLength(128) password: string }

export const REFRESH_COOKIE = 'msh_refresh';
const cookieOptions = (expires?: Date): CookieOptions => ({ httpOnly: true, secure: config.cookie.secure, sameSite: config.cookie.sameSite, path: '/api/v1/auth', expires });
/** The mobile apps send "X-Client: app" and keep the refresh token in secure device storage. The website gets an httpOnly cookie instead. */
const isApp = (req: Request) => req.headers['x-client'] === 'app';
function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

@ApiTags('Sign-in and account')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly oauth: OAuthService) {}

  private send(req: Request, res: Response, s: Session, extra: Record<string, unknown> = {}) {
    const body = { accessToken: s.accessToken, expiresIn: s.expiresIn, user: s.user, ...extra } as Record<string, unknown>;
    if (isApp(req)) body.refreshToken = s.refreshToken;
    else res.cookie(REFRESH_COOKIE, s.refreshToken, cookieOptions(s.refreshExpiresAt));
    return body;
  }
  private refreshTokenFrom(req: Request, dto?: RefreshDto): string | undefined {
    if (isApp(req)) return dto?.refreshToken;
    // Cookie requests must carry a custom header, which a plain cross-site form cannot add (CSRF protection).
    if (req.headers['x-requested-with'] !== 'XMLHttpRequest') return undefined;
    return readCookie(req, REFRESH_COOKIE);
  }

  @Public() @Get('providers') @ApiOperation({ summary: 'Sign-in options for Contributors (Google, Apple) with their public client ids' })
  providers() { return { ...this.oauth.publicConfig(), demo: config.demoSignIn, minAge: config.minAge, avatars: AVATARS, minAppVersion: config.minAppVersion }; }

  @Public() @LoginLimit() @Post('oauth/google') @HttpCode(200) @ApiOperation({ summary: 'Continue with Google: sign in, or create a Contributor account' })
  async google(@Body() dto: OAuthDto, @Meta() meta: RequestMeta, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const s = await this.auth.signInWithProvider('google', dto.idToken, dto, meta);
    return this.send(req, res, s, { created: s.created });
  }
  @Public() @LoginLimit() @Post('oauth/apple') @HttpCode(200) @ApiOperation({ summary: 'Continue with Apple: sign in, or create a Contributor account' })
  async apple(@Body() dto: OAuthDto, @Meta() meta: RequestMeta, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const s = await this.auth.signInWithProvider('apple', dto.idToken, dto, meta);
    return this.send(req, res, s, { created: s.created });
  }
  /** Sign in with Apple on Android returns here; the result is handed back to the app. */
  @Public() @Post('oauth/apple/callback') @ApiOperation({ summary: 'Return address for Sign in with Apple on Android' })
  appleCallback(@Body() body: Record<string, string>, @Res() res: Response) {
    const q = new URLSearchParams();
    for (const k of ['code', 'id_token', 'state', 'user', 'error']) if (typeof body?.[k] === 'string') q.set(k, body[k]);
    res.redirect(303, `intent://callback?${q.toString()}#Intent;package=${config.oauth.androidPackage};scheme=signinwithapple;end`);
  }
  @Public() @LoginLimit() @Post('demo') @HttpCode(200) @ApiOperation({ summary: 'Local demo only: sign in as a sample Contributor' })
  async demo(@Body() dto: DemoDto, @Meta() meta: RequestMeta, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const s = await this.auth.demoSignIn(dto.name, meta);
    return this.send(req, res, s, { created: s.created });
  }
  @Public() @LoginLimit() @Post('restore') @HttpCode(200) @ApiOperation({ summary: 'Restore an account within 30 days of deleting it' })
  async restore(@Body() dto: TokenDto, @Meta() meta: RequestMeta, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.send(req, res, await this.auth.restore(dto.token, meta), { message: text('account_restored', meta.lang) });
  }

  @Public() @Get('username-available') @ApiOperation({ summary: 'Check a username as it is typed' })
  async username(@Query('username') username = '', @CurrentUser() user: AuthUser | undefined, @Meta() meta: RequestMeta) {
    const state = await this.auth.usernameState(String(username).trim(), user?.id);
    return { available: state === 'username_available', code: state, message: text(state, meta.lang) };
  }
  @AllowIncomplete() @ApiBearerAuth() @Post('profile') @HttpCode(200) @ApiOperation({ summary: 'First-time profile setup, and later profile changes' })
  profile(@CurrentUser() user: AuthUser, @Body() dto: ProfileDto, @Meta() meta: RequestMeta) { return this.auth.saveProfile(user.id, dto, meta); }

  @AllowIncomplete() @ApiBearerAuth() @Get('me') @ApiOperation({ summary: 'The signed-in account' })
  me(@CurrentUser() user: AuthUser) { return this.auth.me(user.id); }

  // ----- Admins and Super Admins -----
  @Public() @RegisterLimit() @Post('admin/register') @ApiOperation({ summary: 'Admin registration (approved by a Super Admin), or completing an invitation' })
  registerAdmin(@Body() dto: AdminRegisterDto, @Meta() meta: RequestMeta) { return this.auth.registerAdmin(dto, meta); }
  @Public() @LoginLimit() @Post('admin/login') @HttpCode(200) @ApiOperation({ summary: 'Admin sign-in, step 1: email and password' })
  adminLogin(@Body() dto: AdminLoginDto, @Meta() meta: RequestMeta) { return this.auth.adminLogin(dto.email, dto.password, meta); }
  @Public() @LoginLimit() @Post('admin/mfa/send') @HttpCode(200) @ApiOperation({ summary: 'Send a sign-in code by email or SMS' })
  mfaSend(@Body() dto: MfaSendDto, @Meta() meta: RequestMeta) { return this.auth.sendMfaCode(dto.mfaToken, dto.channel, meta); }
  @Public() @LoginLimit() @Post('admin/mfa/verify') @HttpCode(200) @ApiOperation({ summary: 'Admin sign-in, step 2: the second factor' })
  async mfaVerify(@Body() dto: MfaVerifyDto, @Meta() meta: RequestMeta, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.send(req, res, await this.auth.verifyMfa(dto.mfaToken, dto.code, meta));
  }
  @Roles('admin', 'super_admin') @ApiBearerAuth() @Post('admin/mfa/authenticator') @ApiOperation({ summary: 'Start adding an authenticator app' })
  totpStart(@CurrentUser() user: AuthUser) { return this.auth.startTotp(user.id); }
  @Roles('admin', 'super_admin') @ApiBearerAuth() @Post('admin/mfa/authenticator/confirm') @HttpCode(200) @ApiOperation({ summary: 'Confirm the authenticator app with a code' })
  totpConfirm(@CurrentUser() user: AuthUser, @Body() dto: CodeDto, @Meta() meta: RequestMeta) { return this.auth.confirmTotp(user.id, dto.code, meta); }
  @Roles('admin', 'super_admin') @ApiBearerAuth() @Post('admin/mfa/authenticator/remove') @HttpCode(200) @ApiOperation({ summary: 'Remove the authenticator app' })
  totpRemove(@CurrentUser() user: AuthUser, @Body() dto: PasswordOnlyDto, @Meta() meta: RequestMeta) { return this.auth.removeTotp(user.id, dto.password, meta); }
  @Roles('admin', 'super_admin') @ApiBearerAuth() @Patch('admin/password') @ApiOperation({ summary: 'Change the admin password' })
  password(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto, @Meta() meta: RequestMeta) { return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword, meta); }
  @Roles('admin', 'super_admin') @ApiBearerAuth() @Post('admin/email') @HttpCode(200) @ApiOperation({ summary: 'Change the verification email: sends a code to the new address' })
  emailChange(@CurrentUser() user: AuthUser, @Body() dto: EmailChangeDto) { return this.auth.requestEmailChange(user.id, dto.email, dto.password); }
  @Roles('admin', 'super_admin') @ApiBearerAuth() @Post('admin/email/confirm') @HttpCode(200) @ApiOperation({ summary: 'Confirm the new verification email' })
  emailConfirm(@CurrentUser() user: AuthUser, @Body() dto: CodeDto, @Meta() meta: RequestMeta) { return this.auth.confirmEmailChange(user.id, dto.code, meta); }
  @Public() @ResetLimit() @Post('admin/forgot-password') @HttpCode(200) @ApiOperation({ summary: 'Email a password reset link to an admin' })
  async forgot(@Body() dto: EmailDto, @Meta() meta: RequestMeta) { await this.auth.forgotPassword(dto.email, meta); return { ok: true }; }
  @Public() @ResetLimit() @Post('admin/reset-password') @HttpCode(200) @ApiOperation({ summary: 'Choose a new admin password with the emailed link' })
  reset(@Body() dto: ResetDto, @Meta() meta: RequestMeta) { return this.auth.resetPassword(dto.token, dto.password, meta); }

  // ----- Sessions -----
  @Public() @Post('refresh') @HttpCode(200) @ApiOperation({ summary: 'Swap the refresh token for a new session' })
  async refresh(@Body() dto: RefreshDto, @Meta() meta: RequestMeta, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // A browser with no saved sign-in is a visitor, not an error: it is told so plainly (the website asks once at start-up).
    if (!isApp(req) && !readCookie(req, REFRESH_COOKIE)) return { accessToken: null };
    return this.send(req, res, await this.auth.refresh(this.refreshTokenFrom(req, dto), meta));
  }
  @Public() @Post('logout') @HttpCode(200) @ApiOperation({ summary: 'Sign out of this device' })
  async logout(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(isApp(req) ? dto.refreshToken : readCookie(req, REFRESH_COOKIE));
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    return { ok: true };
  }
  @AllowIncomplete() @ApiBearerAuth() @Get('sessions') @ApiOperation({ summary: 'Devices signed in to this account' })
  sessions(@CurrentUser() user: AuthUser, @Req() req: Request) { return this.auth.sessions(user.id, isApp(req) ? String(req.headers['x-refresh-token'] ?? '') : readCookie(req, REFRESH_COOKIE)); }
  @AllowIncomplete() @ApiBearerAuth() @Delete('sessions/:id') @ApiOperation({ summary: 'Sign out one device' })
  endSession(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.auth.endSession(user.id, id); }
  @AllowIncomplete() @ApiBearerAuth() @Post('sessions/end-all') @HttpCode(200) @ApiOperation({ summary: 'Sign out everywhere' })
  async endAll(@CurrentUser() user: AuthUser) { await this.auth.revokeAll(user.id); return { ok: true }; }
}
