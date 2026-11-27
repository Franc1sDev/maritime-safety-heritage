import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser, Meta, Public, RequestMeta, Roles } from '../common/decorators';

/** Super Admins view the archive but do not post or engage (Section 4.3). */
const Engage = () => Roles('contributor', 'admin');
import { LANGUAGES } from '../common/messages';
import { CommentLimit, PostLimit } from '../common/rate-limits';
import { CommentsService } from './comments.service';
import { StoriesService } from './stories.service';

class SuggestIncidentDto { @IsString() @MaxLength(200) title: string; @IsOptional() @IsString() @MaxLength(2000) details?: string }
export class StoryDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  /** Text is optional and may be any length (a generous ceiling protects the server). */
  @IsOptional() @IsString() @MaxLength(200_000) text?: string;
  @IsOptional() @IsString() @MaxLength(12) language?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(26) @IsUUID('all', { each: true }) mediaIds?: string[];
  @IsOptional() @IsInt() placeId?: number | null;
  @IsOptional() @IsString() @MaxLength(120) placeName?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number | null;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number | null;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) eventDate?: string | null;
  @IsOptional() @IsBoolean() dateApproximate?: boolean;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsString() @MaxLength(120) vessel?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsUUID() incidentId?: string | null;
  @IsOptional() @ValidateNested() @Type(() => SuggestIncidentDto) suggestIncident?: SuggestIncidentDto;
  @IsOptional() @IsIn(['self', 'told_by', 'anonymous', 'company']) postedAs?: 'self' | 'told_by' | 'anonymous' | 'company';
  @IsOptional() @IsString() @MaxLength(120) toldBy?: string;
  @IsOptional() @IsBoolean() consentConfirmed?: boolean;
  @IsOptional() @IsUUID() consentFormMediaId?: string;
  @IsOptional() @IsString() @MaxLength(60) rights?: string;
  @IsOptional() @IsBoolean() allowDownload?: boolean;
  @IsOptional() @IsBoolean() sensitive?: boolean;
  @IsOptional() @IsBoolean() draft?: boolean;
  @IsOptional() @IsIn(['community', 'testimony', 'record']) type?: 'community' | 'testimony' | 'record';
  @IsOptional() @IsObject() source?: Record<string, string>;
  @IsOptional() @IsObject() consent?: Record<string, any>;
}
class ReactionDto { @IsOptional() @IsIn(['heart', 'heartbreak', 'laugh']) type?: 'heart' | 'heartbreak' | 'laugh' }
class ShareDto { @IsIn(['share', 'copy_link', 'cite']) kind: 'share' | 'copy_link' | 'cite'; @IsOptional() @IsString() @MaxLength(40) target?: string }
class CommentDto { @IsOptional() @IsString() @MaxLength(5000) text?: string; @IsOptional() @IsUUID() parentId?: string; @IsOptional() @IsUUID() mediaId?: string }
class TranscriptDto { @IsString() @MaxLength(200_000) transcript: string }
class SuggestDto { @IsString() @MaxLength(20_000) text: string }

@ApiTags('Stories')
@Controller()
export class StoriesController {
  constructor(private readonly stories: StoriesService, private readonly comments: CommentsService) {}

  @Public() @Get('stories') @ApiOperation({ summary: 'The story feed for every “Stories by” tab: trending, following, favorites, location, contributor, incident, collection, timeline and search' })
  feed(@Query() q: Record<string, string>, @CurrentUser() me?: AuthUser) { return this.stories.feed(q, me); }
  @ApiBearerAuth() @Get('me/stories') @ApiOperation({ summary: 'My stories, with their engagement and views, and my drafts' })
  mine(@CurrentUser() me: AuthUser, @Query('status') status?: string) { return this.stories.mine(me, status); }
  @ApiBearerAuth() @Post('stories/suggest') @HttpCode(200) @ApiOperation({ summary: 'AI suggestions for category, tags and language, for the contributor to confirm' })
  suggest(@Body() dto: SuggestDto) { return this.stories.suggest(dto.text); }
  @Public() @Get('stories/downloads/:exportId') @ApiOperation({ summary: 'Is the ZIP download ready?' })
  zip(@Param('exportId', ParseUUIDPipe) id: string, @Meta() meta: RequestMeta) { return this.stories.zipStatus(id, meta.lang); }
  @Public() @Get('stories/:id') @ApiOperation({ summary: 'One story by id or story ID (e.g. MS-2026-00918)' })
  one(@Param('id') id: string, @CurrentUser() me?: AuthUser) { return this.stories.get(id, me); }

  @Engage() @ApiBearerAuth() @PostLimit() @Post('stories') @ApiOperation({ summary: 'Share a story (or save a draft). Send an Idempotency-Key header so a retry never creates a duplicate.' })
  create(@Body() dto: StoryDto, @CurrentUser() me: AuthUser, @Headers('idempotency-key') key: string | undefined, @Meta() meta: RequestMeta) { return this.stories.create(me, dto, key?.slice(0, 80), meta); }
  @Engage() @ApiBearerAuth() @Patch('stories/:id') @ApiOperation({ summary: 'Edit a draft or a published story (changes to a published story are checked before they show)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StoryDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.stories.update(id, me, dto, meta); }
  @Engage() @ApiBearerAuth() @PostLimit() @Post('stories/:id/submit') @HttpCode(200) @ApiOperation({ summary: 'Send a draft for AI review' })
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.stories.submit(id, me, meta); }
  @ApiBearerAuth() @Get('stories/:id/review') @ApiOperation({ summary: 'Progress and outcome of the AI review' })
  review(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.stories.reviewStatus(id, me, meta.lang); }
  @ApiBearerAuth() @Delete('stories/:id') @ApiOperation({ summary: 'Delete my story (recoverable for 30 days, then erased)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.stories.remove(id, me, meta); }

  @Engage() @ApiBearerAuth() @Put('stories/:id/reaction') @ApiOperation({ summary: 'React with Heart, Heartbreak or Laugh; the same reaction again removes it' })
  react(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReactionDto, @CurrentUser() me: AuthUser) { return this.stories.react(id, me, dto.type ?? null); }
  @Engage() @ApiBearerAuth() @Put('stories/:id/favourite') @ApiOperation({ summary: 'Add to Favorites, or remove if it is already there' })
  favourite(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.stories.favourite(id, me, meta.lang); }
  @Public() @Post('stories/:id/share') @HttpCode(200) @ApiOperation({ summary: 'Record a share, a copied link or a citation' })
  share(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ShareDto, @CurrentUser() me: AuthUser | undefined, @Meta() meta: RequestMeta) { return this.stories.share(id, me, dto.kind, dto.target ?? '', meta.visitor); }
  @Public() @Post('stories/:id/view') @HttpCode(200) @ApiOperation({ summary: 'Record a view' })
  view(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser | undefined, @Meta() meta: RequestMeta) { return this.stories.view(id, me, meta.visitor); }
  @Public() @Get('stories/:id/cite') @ApiOperation({ summary: 'Ready-made citations and the permanent link' })
  cite(@Param('id') id: string, @CurrentUser() me?: AuthUser) { return this.stories.cite(id, me); }
  @Public() @Get('stories/:id/translate') @ApiOperation({ summary: 'Machine translation into the reader’s language, cached' })
  translate(@Param('id') id: string, @Query('to') to: string, @CurrentUser() me?: AuthUser) { return this.stories.translate(id, (LANGUAGES as readonly string[]).includes(to) ? to : 'en', me); }
  @Public() @Get('stories/:id/media/:mediaId/captions') @ApiOperation({ summary: 'Captions for a recording, in the reader’s language where translation is available' })
  captions(@Param('id') id: string, @Param('mediaId', ParseUUIDPipe) mediaId: string, @Query('to') to: string, @CurrentUser() me?: AuthUser) {
    return this.stories.captions(id, mediaId, (LANGUAGES as readonly string[]).includes(to) ? to : 'en', me);
  }
  @Public() @Post('stories/:id/download') @HttpCode(202) @ApiOperation({ summary: 'Prepare a ZIP of the story’s content (where the contributor allows downloads)' })
  download(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser | undefined, @Meta() meta: RequestMeta) { return this.stories.requestZip(id, me, meta); }
  @ApiBearerAuth() @Put('media/:id/transcript') @ApiOperation({ summary: 'Correct the transcript of an audio or video file' })
  transcript(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TranscriptDto, @CurrentUser() me: AuthUser) { return this.stories.saveTranscript(id, me, dto.transcript); }

  @Public() @Get('stories/:id/comments') @ApiOperation({ summary: 'Comments and replies; sort=top (default), recent or oldest' })
  listComments(@Param('id', ParseUUIDPipe) id: string, @Query('sort') sort: string | undefined, @CurrentUser() me?: AuthUser) { return this.comments.list(id, sort, me); }
  @Engage() @ApiBearerAuth() @CommentLimit() @Post('stories/:id/comments') @ApiOperation({ summary: 'Comment or reply, with text, a file, or both; tag people with @username' })
  comment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CommentDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.comments.create(id, me, dto, meta); }
  @Public() @Get('comments/:id/translate') @ApiOperation({ summary: 'Machine translation of a comment, cached' })
  translateComment(@Param('id', ParseUUIDPipe) id: string, @Query('to') to: string) { return this.comments.translate(id, (LANGUAGES as readonly string[]).includes(to) ? to : 'en'); }
  @ApiBearerAuth() @Delete('comments/:id') @ApiOperation({ summary: 'Delete my comment' })
  removeComment(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) { return this.comments.remove(id, me); }
  @Engage() @ApiBearerAuth() @Put('comments/:id/reaction') @ApiOperation({ summary: 'React to a comment' })
  reactComment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReactionDto, @CurrentUser() me: AuthUser) { return this.comments.react(id, me, dto.type ?? null); }
}
