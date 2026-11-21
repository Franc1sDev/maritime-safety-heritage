import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthModule } from '../auth/auth.module';
import { AuthUser, CurrentUser, Meta, Public, RequestMeta, Roles } from '../common/decorators';
import { REPORT_REASONS } from '../common/messages';
import { PublicFormLimit, ReportLimit } from '../common/rate-limits';
import { StoriesModule } from '../stories/stories.module';
import { ModerationService } from './moderation.service';

class ReasonDto { @IsString() @MinLength(3) @MaxLength(2000) reason: string }
class OptionalReasonDto { @IsOptional() @IsString() @MaxLength(2000) reason?: string }
class ValidateDto { @IsOptional() @IsString() @MaxLength(160) storyteller?: string; @IsOptional() @IsString() @MaxLength(80) consentType?: string; @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) consentDate?: string; @IsOptional() @IsObject() restrictions?: Record<string, unknown> }
class CorrectionDto { @IsString() @MaxLength(1000) note: string; @IsOptional() @IsString() @MaxLength(400) link?: string }
class ToggleDto { @IsBoolean() on: boolean; @IsOptional() @IsString() @MaxLength(2000) reason?: string }
class HeldDto { @IsBoolean() allow: boolean; @IsOptional() @IsString() @MaxLength(2000) reason?: string }
class AskWhyDto { @IsOptional() @IsString() @MaxLength(160) subject?: string; @IsString() @MinLength(3) @MaxLength(4000) description: string; @IsOptional() @IsArray() @ArrayMaxSize(6) @IsUUID('all', { each: true }) mediaIds?: string[] }
class AskWhySuspendedDto { @IsString() @MaxLength(2000) token: string; @IsString() @MinLength(3) @MaxLength(4000) description: string }
class ReportDto {
  @IsIn(['story', 'user', 'comment']) targetType: 'story' | 'user' | 'comment'; @IsUUID() targetId: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsIn(REPORT_REASONS.map((r) => r.key), { each: true }) reasons?: string[];
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
}
class ActDto { @IsIn(['dismiss', 'warn', 'drop', 'suspend', 'delete']) action: 'dismiss' | 'warn' | 'drop' | 'suspend' | 'delete'; @IsString() @MinLength(3) @MaxLength(2000) reason: string; @IsOptional() @IsInt() @Min(1) @Max(365) days?: number }
class AccountActDto { @IsIn(['warn', 'suspend', 'delete']) action: 'warn' | 'suspend' | 'delete'; @IsString() @MinLength(3) @MaxLength(2000) reason: string; @IsOptional() @IsInt() @Min(1) @Max(365) days?: number }
class NoteDto { @IsString() @MinLength(1) @MaxLength(2000) note: string }

@ApiTags('Moderation and reports') @ApiBearerAuth()
@Controller()
export class ModerationController {
  constructor(private readonly mod: ModerationService) {}

  @Roles('admin') @Get('admin/moderation') @ApiOperation({ summary: 'Stories with their ID and AI flag; filter by flag, pending review, AI-blocked not overridden, AI-blocked overridden; sort by most recent or oldest' })
  queue(@Query() q: Record<string, string>, @CurrentUser() me: AuthUser) { return this.mod.queue(q, me); }
  @Roles('admin') @Get('admin/stories/:id/history') @ApiOperation({ summary: 'Moderation history of a story' })
  history(@Param('id', ParseUUIDPipe) id: string) { return this.mod.history(id); }
  @Roles('admin') @Post('admin/stories/:id/remove') @HttpCode(200) @ApiOperation({ summary: 'Delete a story (the Contributor is told and can Ask Why)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.mod.removeStory(id, me, dto.reason, meta); }
  @Roles('admin') @Post('admin/stories/:id/restore') @HttpCode(200) @ApiOperation({ summary: 'Second review: restore a removed story (a different admin from the one who removed it)' })
  restore(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.mod.restoreStory(id, me, dto.reason, meta); }
  @Roles('admin') @Post('admin/stories/:id/keep-blocked') @HttpCode(200) @ApiOperation({ summary: 'Keep a RED story blocked' })
  keep(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OptionalReasonDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.mod.keepBlocked(id, me, dto.reason ?? '', meta); }
  @Roles('admin') @Post('admin/stories/:id/release') @HttpCode(200) @ApiOperation({ summary: 'Publish a story the AI could not check, after reading it' })
  release(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.mod.release(id, me, meta); }
  @Roles('admin') @Post('admin/stories/:id/override') @HttpCode(200) @ApiOperation({ summary: 'Override an AI ban: needs a justification and the other admins’ approval' })
  override(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.mod.override(id, me, dto.reason, meta); }
  @Roles('admin') @Post('admin/stories/:id/validate') @HttpCode(200) @ApiOperation({ summary: 'Record that a testimony was validated with its storyteller (and publish it if it was waiting)' })
  validate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ValidateDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.mod.validate(id, me, dto, meta); }
  @Roles('admin') @Post('admin/stories/:id/withdraw-consent') @HttpCode(200) @ApiOperation({ summary: 'The storyteller withdrew consent: remove the story' })
  withdraw(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OptionalReasonDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.mod.withdrawConsent(id, me, dto.reason ?? '', meta); }
  @Roles('admin') @Post('admin/stories/:id/correction') @HttpCode(200) @ApiOperation({ summary: 'Add or clear a correction note linking to official safety guidance' })
  correction(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CorrectionDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.mod.correction(id, me, dto.note, dto.link ?? '', meta); }
  @Roles('admin') @Post('admin/stories/:id/comments-lock') @HttpCode(200) @ApiOperation({ summary: 'Lock or unlock comments, with a reason shown to Contributors' })
  lock(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ToggleDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.mod.setComments(id, me, 'lock', dto.on, dto.reason ?? '', meta); }
  @Roles('admin') @Post('admin/stories/:id/comments-hide') @HttpCode(200) @ApiOperation({ summary: 'Hide or show comments, with a reason shown to Contributors' })
  hide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ToggleDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.mod.setComments(id, me, 'hide', dto.on, dto.reason ?? '', meta); }
  @Roles('admin') @Get('admin/held/:kind') @ApiOperation({ summary: 'Comments or messages held by AI review' })
  held(@Param('kind') kind: string) { return this.mod.held(kind === 'messages' ? 'messages' : 'comments'); }
  @Roles('admin') @Post('admin/held/:kind/:id') @HttpCode(200) @ApiOperation({ summary: 'Allow or block a held comment or message' })
  decideHeld(@Param('kind') kind: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: HeldDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.mod.decideHeld(kind === 'messages' ? 'messages' : 'comments', id, me, dto.allow, dto.reason ?? '', meta); }

  @Post('stories/:id/ask-why') @HttpCode(200) @ApiOperation({ summary: 'Ask the admins why my story was removed or not posted' })
  askWhy(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AskWhyDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.mod.askWhy(id, me, dto, meta); }
  @Public() @PublicFormLimit() @Post('auth/suspension/ask-why') @HttpCode(200) @ApiOperation({ summary: 'Ask why my account is suspended (with the token given at sign-in)' })
  askWhySuspended(@Body() dto: AskWhySuspendedDto, @Meta() meta: RequestMeta) { return this.mod.askWhySuspended(dto.token, dto.description, meta); }

  @Roles('contributor', 'admin') @ReportLimit() @Post('reports') @ApiOperation({ summary: 'Report a story, a comment or a Contributor: one or more preset reasons and/or a description' })
  report(@Body() dto: ReportDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.mod.report(me, dto, meta); }
  @Roles('admin') @Get('admin/reports') @ApiOperation({ summary: 'The reports queue, grouped by item' })
  reports(@Query('status') status?: string) { return this.mod.reports(['open', 'resolved', 'dismissed'].includes(status ?? '') ? status : 'open'); }
  @Roles('admin') @Post('admin/reports/:type/:id/action') @HttpCode(200) @ApiOperation({ summary: 'Dismiss, warn, drop the story, suspend, or propose permanent deletion' })
  act(@Param('type') type: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ActDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.mod.act(type as 'story', id, me, dto, meta); }
  @Roles('admin') @Post('admin/reports/:type/:id/notes') @HttpCode(200) @ApiOperation({ summary: 'Add an internal note' })
  note(@Param('type') type: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto, @CurrentUser() me: AuthUser) { return this.mod.addNote(type, id, me, dto.note); }
  @Roles('admin') @Post('admin/accounts/:id/action') @HttpCode(200) @ApiOperation({ summary: 'Warn, suspend or propose permanent deletion of an account' })
  account(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AccountActDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.mod.accountAction(id, me, dto.action, dto.reason, dto.days, meta); }
}

@Module({ imports: [StoriesModule, AuthModule], controllers: [ModerationController], providers: [ModerationService], exports: [ModerationService] })
export class ModerationModule {}
