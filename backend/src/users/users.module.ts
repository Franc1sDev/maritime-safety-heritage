import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsISO8601, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthModule } from '../auth/auth.module';
import { AllowIncomplete, AuthUser, CurrentUser, Meta, Public, RequestMeta, Roles } from '../common/decorators';
import { DELETION_REASONS, LANGUAGES } from '../common/messages';
import { UsersService } from './users.service';

class SettingsDto {
  @IsOptional() @IsBoolean() highContrast?: boolean;
  @IsOptional() @IsIn(['small', 'medium', 'large', 'xlarge']) textSize?: string;
  @IsOptional() @IsBoolean() reducedMotion?: boolean;
  @IsOptional() @IsBoolean() lowData?: boolean;
  @IsOptional() @IsBoolean() wifiOnly?: boolean;
  @IsOptional() @IsBoolean() readReceipts?: boolean;
  @IsOptional() @IsObject() notifications?: Record<string, { inApp?: boolean; push?: boolean; email?: boolean }>;
  @IsOptional() @IsObject() quietHours?: { from?: string; to?: string };
  @IsOptional() @IsIn(LANGUAGES as unknown as string[]) language?: string;
  @IsOptional() @IsIn(['light', 'dark', 'auto']) theme?: string;
}
class OnDto { @IsBoolean() on: boolean }
class DeleteDto { @IsOptional() @IsIn(DELETION_REASONS.map((r) => r.key)) reason?: string; @IsOptional() @IsString() @MaxLength(500) otherReason?: string }
class PushDto { @IsIn(['android', 'ios', 'web']) platform: 'android' | 'ios' | 'web'; @IsString() @MaxLength(4000) token: string }
class ReminderDto { @IsString() @MinLength(1) @MaxLength(160) subject: string; @IsOptional() @IsString() @MaxLength(2000) description?: string; @IsISO8601() dueAt: string }

@ApiTags('Profile and people')
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Public() @Get('contributors') @ApiOperation({ summary: 'Contributors who have posted at least one story, with search' })
  contributors(@Query('q') q: string | undefined, @CurrentUser() me?: AuthUser) { return this.users.contributors(q, me); }
  @Public() @Get('contributors/:username') @ApiOperation({ summary: 'A Contributor’s public profile' })
  profile(@Param('username') username: string, @CurrentUser() me?: AuthUser) { return this.users.profile(username, me); }
  @ApiBearerAuth() @Get('people/search') @ApiOperation({ summary: 'People to tag with @' })
  mention(@Query('q') q = '', @CurrentUser() me: AuthUser) { return this.users.mentionSearch(q, me); }

  @AllowIncomplete() @ApiBearerAuth() @Patch('me/settings') @ApiOperation({ summary: 'Theme, high contrast, text size, reduced motion, language, low-data mode, read receipts, notification settings and quiet hours' })
  settings(@CurrentUser() me: AuthUser, @Body() dto: SettingsDto, @Meta() meta: RequestMeta) { return this.users.saveSettings(me, dto, meta); }
  @Roles('contributor', 'admin') @ApiBearerAuth() @Put('people/:id/follow') @ApiOperation({ summary: 'Follow or unfollow a Contributor' })
  follow(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OnDto, @CurrentUser() me: AuthUser) { return this.users.follow(me, id, dto.on); }
  @ApiBearerAuth() @Get('me/following') @ApiOperation({ summary: 'Who I follow' })
  following(@CurrentUser() me: AuthUser) { return this.users.following(me); }
  @ApiBearerAuth() @Put('people/:id/block') @ApiOperation({ summary: 'Block or unblock' })
  block(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OnDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.users.block(me, id, 'block', dto.on, meta); }
  @ApiBearerAuth() @Put('people/:id/mute') @ApiOperation({ summary: 'Mute or unmute' })
  mute(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OnDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.users.block(me, id, 'mute', dto.on, meta); }
  @ApiBearerAuth() @Get('me/blocked') @ApiOperation({ summary: 'People I have blocked or muted' })
  blocked(@CurrentUser() me: AuthUser) { return this.users.blocked(me); }

  @AllowIncomplete() @ApiBearerAuth() @Post('me/delete') @HttpCode(200) @ApiOperation({ summary: 'Delete my account: one preset reason and/or my own words. Removed at once, erased after 30 days.' })
  deleteAccount(@CurrentUser() me: AuthUser, @Body() dto: DeleteDto, @Meta() meta: RequestMeta) { return this.users.deleteAccount(me, dto, meta); }
  @ApiBearerAuth() @Post('me/export') @HttpCode(202) @ApiOperation({ summary: 'Download my data: prepared in the background as a ZIP' })
  export(@CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.users.requestExport(me, meta); }
  @ApiBearerAuth() @Get('me/exports') @ApiOperation({ summary: 'My data downloads' })
  exports(@CurrentUser() me: AuthUser) { return this.users.exports(me); }

  @AllowIncomplete() @ApiBearerAuth() @Get('me/notifications') @ApiOperation({ summary: 'My notifications and unread counts; priority=true for the floating ones that need my action' })
  notifications(@CurrentUser() me: AuthUser, @Query('priority') priority?: string) { return this.users.notifications(me, priority === 'true'); }
  @AllowIncomplete() @ApiBearerAuth() @Post('me/notifications/read') @HttpCode(200) @ApiOperation({ summary: 'Mark all notifications read' })
  readAll(@CurrentUser() me: AuthUser) { return this.users.readNotifications(me); }
  @AllowIncomplete() @ApiBearerAuth() @Post('me/notifications/:id/read') @HttpCode(200) @ApiOperation({ summary: 'Mark one notification read' })
  readOne(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.users.readNotifications(me, id); }
  @AllowIncomplete() @ApiBearerAuth() @Post('me/push-tokens') @HttpCode(200) @ApiOperation({ summary: 'Register this device or browser for push notifications' })
  push(@CurrentUser() me: AuthUser, @Body() dto: PushDto) { return this.users.pushToken(me, dto.platform, dto.token); }
  @AllowIncomplete() @ApiBearerAuth() @Post('me/push-tokens/remove') @HttpCode(200) @ApiOperation({ summary: 'Stop push notifications on this device' })
  pushRemove(@CurrentUser() me: AuthUser, @Body() dto: PushDto) { return this.users.removePushToken(me, dto.token); }

  @ApiBearerAuth() @Get('me/reminders') @ApiOperation({ summary: 'My reminders' })
  reminders(@CurrentUser() me: AuthUser) { return this.users.reminders(me); }
  @ApiBearerAuth() @Post('me/reminders') @ApiOperation({ summary: 'Add a reminder with a due time' })
  addReminder(@CurrentUser() me: AuthUser, @Body() dto: ReminderDto, @Meta() meta: RequestMeta) { return this.users.saveReminder(me, dto, undefined, meta); }
  @ApiBearerAuth() @Patch('me/reminders/:id') @ApiOperation({ summary: 'Change a reminder' })
  editReminder(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReminderDto, @Meta() meta: RequestMeta) { return this.users.saveReminder(me, dto, id, meta); }
  @ApiBearerAuth() @Put('me/reminders/:id/done') @ApiOperation({ summary: 'Mark a reminder done or not done' })
  doneReminder(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OnDto) { return this.users.reminderDone(me, id, dto.on); }
  @ApiBearerAuth() @Delete('me/reminders/:id') @ApiOperation({ summary: 'Delete a reminder' })
  removeReminder(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.users.deleteReminder(me, id); }
}

@Module({ imports: [AuthModule], controllers: [UsersController], providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
