import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser, Meta, Public, RequestMeta, Roles } from '../common/decorators';
import { fail } from '../common/messages';
import { PublicFormLimit } from '../common/rate-limits';
import { uploadOptions } from '../media/upload';
import { ArchiveService } from './archive.service';
import { ImportService } from './import.service';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
class PlaceDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) altNames?: string[];
  @IsOptional() @IsIn(['port', 'town', 'beach', 'island', 'landing site', 'lake', 'river', 'crossing', 'village', 'city']) type?: string;
  @IsOptional() @IsString() @MaxLength(80) county?: string;
  @IsOptional() @IsString() @MaxLength(80) waterBody?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
}
class IncidentDto {
  @IsString() @MinLength(3) @MaxLength(200) title: string;
  @IsOptional() @Matches(DATE) eventDate?: string;
  @IsOptional() @IsBoolean() dateApproximate?: boolean;
  @IsOptional() @IsInt() placeId?: number;
  @IsOptional() @IsString() @MaxLength(160) placeName?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsString() @MaxLength(80) waterBody?: string;
  @IsOptional() @IsString() @MaxLength(160) vessel?: string;
  @IsOptional() @IsString() @MaxLength(60) incidentType?: string;
  @IsOptional() @IsString() @MaxLength(8000) summary?: string;
  @IsOptional() @IsString() @MaxLength(4000) outcome?: string;
  @IsOptional() @IsString() @MaxLength(4000) sources?: string;
  @IsOptional() @IsIn(['draft', 'published']) status?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsUUID('all', { each: true }) storyIds?: string[];
}
class MatchDto { @IsString() @MaxLength(20_000) text: string; @IsOptional() @Matches(DATE) eventDate?: string; @IsOptional() @IsString() @MaxLength(160) vessel?: string }
class CollectionItemDto { @IsUUID() storyId: string; @IsOptional() @IsString() @MaxLength(1000) note?: string }
class CollectionDto {
  @IsString() @MinLength(3) @MaxLength(160) title: string;
  @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @IsOptional() @IsIn(['collection', 'exhibition']) kind?: string;
  @IsOptional() @IsUUID() coverMediaId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(300) @ValidateNested({ each: true }) @Type(() => CollectionItemDto) items?: CollectionItemDto[];
  @IsOptional() @IsBoolean() submit?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) justification?: string;
}
class ResourceDto {
  @IsString() @MinLength(3) @MaxLength(200) title: string;
  @IsIn(['policy_brief', 'learning_summary', 'educational_material', 'handbook', 'exhibition']) type: string;
  @IsOptional() @IsString() @MaxLength(2000) summary?: string;
  @IsOptional() @IsString() @MaxLength(200_000) body?: string;
  @IsOptional() @IsUUID() mediaId?: string;
  @IsOptional() @IsUUID() collectionId?: string;
  @IsOptional() @IsString() @MaxLength(60) audience?: string;
  @IsOptional() @IsString() @MaxLength(12) language?: string;
  @IsOptional() @IsIn(['draft', 'published']) status?: string;
}
class ConcernDto {
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsString() @MaxLength(160) placeName?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsUUID() photoMediaId?: string;
  @IsOptional() @IsString() @MaxLength(160) contact?: string;
  @IsOptional() @IsBoolean() shareIdentity?: boolean;
  /** Left empty by people; filled by simple bots (a trap field). */
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @IsString() @MaxLength(4000) humanToken?: string;
}
class ConcernUpdateDto { @IsOptional() @IsIn(['new', 'acknowledged', 'referred', 'closed']) status?: string; @IsOptional() @IsString() @MaxLength(2000) note?: string; @IsOptional() @IsString() @MaxLength(2000) referral?: string }
class FeedbackDto { @IsString() @MinLength(3) @MaxLength(4000) text: string; @IsOptional() @IsString() @MaxLength(200) website?: string; @IsOptional() @IsString() @MaxLength(4000) humanToken?: string }
class AnnouncementDateDto { @Matches(DATE) date: string; @IsOptional() @Matches(DATE) endDate?: string; @IsOptional() @IsString() @MaxLength(120) label?: string }
class AnnouncementDto {
  @IsString() @MinLength(3) @MaxLength(160) title: string;
  @IsOptional() @IsString() @MaxLength(400) summary?: string;
  @IsOptional() @IsString() @MaxLength(20_000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => AnnouncementDateDto) dates?: AnnouncementDateDto[];
  @IsOptional() @IsBoolean() sendPush?: boolean;
}
class SubmitDto { @IsOptional() @IsString() @MaxLength(2000) justification?: string }

@ApiTags('Archive')
@Controller()
export class ArchiveController {
  constructor(private readonly archive: ArchiveService, private readonly imports: ImportService) {}

  @Public() @Get('config') @ApiOperation({ summary: 'Lists and standard texts: languages, categories, report and deletion reasons, rules, limits' })
  config(@Meta() meta: RequestMeta) { return this.archive.publicConfig(meta.lang); }
  @Public() @Get('search') @ApiOperation({ summary: 'Search stories, transcripts, incidents, places, contributors and learning resources' })
  search(@Query('q') q = '', @CurrentUser() me?: AuthUser) { return this.archive.search(q, me); }

  @Public() @Get('places') @ApiOperation({ summary: 'Location auto-complete from the places list' })
  places(@Query('q') q?: string, @Query('withStories') withStories?: string) { return this.archive.places(q, withStories === 'true'); }
  @Roles('admin') @ApiBearerAuth() @Post('admin/places') @ApiOperation({ summary: 'Add a place' })
  addPlace(@Body() dto: PlaceDto) { return this.archive.savePlace(dto); }
  @Roles('admin') @ApiBearerAuth() @Patch('admin/places/:id') @ApiOperation({ summary: 'Edit a place' })
  editPlace(@Param('id', ParseIntPipe) id: number, @Body() dto: PlaceDto) { return this.archive.savePlace(dto, id); }

  @Public() @Get('map') @ApiOperation({ summary: 'Map Explore: stories (clustered when zoomed out) and the incident layer; bbox=west,south,east,north' })
  map(@Query() q: Record<string, string>, @CurrentUser() me?: AuthUser) { return this.archive.map(q, me); }
  @Public() @Get('timeline') @ApiOperation({ summary: 'Stories and incidents by decade and year of the event' })
  timeline(@CurrentUser() me?: AuthUser) { return this.archive.timeline(me); }

  @Public() @Get('incidents') @ApiOperation({ summary: 'Incident records, searchable by name, year, water body and type' })
  incidents(@Query() q: Record<string, string>, @CurrentUser() me?: AuthUser) { return this.archive.incidents(q, me); }
  @ApiBearerAuth() @Post('incidents/match') @HttpCode(200) @ApiOperation({ summary: 'Suggest the incident a story may belong to, for a person to confirm' })
  match(@Body() dto: MatchDto) { return this.archive.matchIncident(dto.text, dto.eventDate, dto.vessel); }
  @Public() @Get('incidents/:id') @ApiOperation({ summary: 'An incident page with every story, testimony and record linked to it' })
  incident(@Param('id') id: string, @CurrentUser() me?: AuthUser) { return this.archive.incident(id, me); }
  @Roles('admin') @ApiBearerAuth() @Post('admin/incidents') @ApiOperation({ summary: 'Create an incident record' })
  addIncident(@Body() dto: IncidentDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.archive.saveIncident(me, dto, undefined, meta); }
  @Roles('admin') @ApiBearerAuth() @Patch('admin/incidents/:id') @ApiOperation({ summary: 'Edit an incident record and link stories and records to it' })
  editIncident(@Param('id', ParseUUIDPipe) id: string, @Body() dto: IncidentDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.archive.saveIncident(me, dto, id, meta); }
  @Roles('admin') @ApiBearerAuth() @Post('admin/incidents/:id/decline') @HttpCode(200) @ApiOperation({ summary: 'Decline an incident suggested by a contributor' })
  declineIncident(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.archive.declineIncident(me, id, meta); }

  @Public() @Get('collections') @ApiOperation({ summary: 'Curated collections and online exhibitions' })
  collections(@Query('kind') kind: string | undefined, @CurrentUser() me?: AuthUser) { return this.archive.collections(me, kind); }
  @Public() @Get('collections/:id') @ApiOperation({ summary: 'One collection with its stories' })
  collection(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me?: AuthUser) { return this.archive.collection(id, me); }
  @Roles('admin') @ApiBearerAuth() @Post('admin/collections') @ApiOperation({ summary: 'Create a collection; submit=true sends it for approval' })
  addCollection(@Body() dto: CollectionDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.archive.saveCollection(me, dto, undefined, meta); }
  @Roles('admin') @ApiBearerAuth() @Patch('admin/collections/:id') @ApiOperation({ summary: 'Edit a collection' })
  editCollection(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CollectionDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.archive.saveCollection(me, dto, id, meta); }

  @Public() @Get('resources') @ApiOperation({ summary: 'Learning resources: filter by type, audience and language' })
  resources(@Query() q: Record<string, string>, @CurrentUser() me?: AuthUser) { return this.archive.resources(q, me); }
  @Public() @Get('resources/:id') @ApiOperation({ summary: 'Read one resource on screen' })
  resource(@Param('id') id: string, @CurrentUser() me: AuthUser | undefined, @Meta() meta: RequestMeta) { return this.archive.resource(id, me, meta.visitor); }
  @Public() @Post('resources/:id/download') @HttpCode(200) @ApiOperation({ summary: 'A download link for the resource file (counted)' })
  resourceDownload(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser | undefined, @Meta() meta: RequestMeta) { return this.archive.resourceDownloaded(id, me, meta.visitor); }
  @Roles('admin') @ApiBearerAuth() @Post('admin/resources') @ApiOperation({ summary: 'Add a learning resource or online exhibition' })
  addResource(@Body() dto: ResourceDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.archive.saveResource(me, dto, undefined, meta); }
  @Roles('admin') @ApiBearerAuth() @Patch('admin/resources/:id') @ApiOperation({ summary: 'Edit a resource' })
  editResource(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResourceDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.archive.saveResource(me, dto, id, meta); }
  @Roles('admin') @ApiBearerAuth() @Delete('admin/resources/:id') @ApiOperation({ summary: 'Remove a resource' })
  removeResource(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.archive.removeResource(me, id, meta); }

  @Public() @PublicFormLimit() @Post('safety-concerns') @ApiOperation({ summary: 'Report a current safety concern on the water. Not an emergency service.' })
  concern(@Body() dto: ConcernDto, @CurrentUser() me: AuthUser | undefined, @Meta() meta: RequestMeta) { return this.archive.raiseConcern(me, dto, meta); }
  @Roles('admin') @ApiBearerAuth() @Get('admin/safety-concerns') @ApiOperation({ summary: 'The safety concerns queue' })
  concerns(@Query('status') status?: string) { return this.archive.concerns(status); }
  @Roles('admin') @ApiBearerAuth() @Patch('admin/safety-concerns/:id') @ApiOperation({ summary: 'Acknowledge, add notes, record a referral, or close' })
  updateConcern(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConcernUpdateDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.archive.updateConcern(me, id, dto, meta); }

  @Public() @PublicFormLimit() @Post('feedback') @ApiOperation({ summary: 'Suggest an improvement to the archive' })
  feedback(@Body() dto: FeedbackDto, @CurrentUser() me: AuthUser | undefined, @Meta() meta: RequestMeta) { return this.archive.feedback(me, dto.text, dto, meta); }
  @Roles('admin', 'super_admin') @ApiBearerAuth() @Get('admin/feedback') @ApiOperation({ summary: 'Feedback received' })
  listFeedback() { return this.archive.listFeedback(); }

  @Public() @Get('announcements') @ApiOperation({ summary: 'Announcements, most recently created or edited first' })
  announcements(@CurrentUser() me?: AuthUser) { return this.archive.announcements(me); }
  @ApiBearerAuth() @Post('announcements/:id/read') @HttpCode(200) @ApiOperation({ summary: 'Mark an announcement as opened' })
  readAnnouncement(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) { return this.archive.readAnnouncement(me, id); }
  @Roles('admin') @ApiBearerAuth() @Post('admin/announcements') @ApiOperation({ summary: 'Publish an announcement, with dates for the calendar and an optional push notification' })
  addAnnouncement(@Body() dto: AnnouncementDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.archive.saveAnnouncement(me, dto, undefined, meta); }
  @Roles('admin') @ApiBearerAuth() @Patch('admin/announcements/:id') @ApiOperation({ summary: 'Edit an announcement (it moves back to the top, labelled Edited)' })
  editAnnouncement(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AnnouncementDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.archive.saveAnnouncement(me, dto, id, meta); }
  @Roles('admin') @ApiBearerAuth() @Delete('admin/announcements/:id') @ApiOperation({ summary: 'Delete an announcement' })
  removeAnnouncement(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.archive.removeAnnouncement(me, id, meta); }

  @Roles('admin') @ApiBearerAuth() @Get('admin/import/template') @Header('Content-Type', 'text/csv; charset=utf-8') @Header('Content-Disposition', 'attachment; filename="metadata-template.csv"')
  @ApiOperation({ summary: 'The metadata spreadsheet template for bulk import' })
  template() { return this.imports.template(); }
  @Roles('admin') @ApiBearerAuth() @Get('admin/import') @ApiOperation({ summary: 'Import batches' })
  batches() { return this.imports.list(); }
  @Roles('admin') @ApiBearerAuth() @Post('admin/import') @UseInterceptors(FileInterceptor('spreadsheet', uploadOptions(1))) @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Check a metadata spreadsheet (CSV or .xlsx) against the uploaded files; shows what is ready and what needs attention' })
  check(@UploadedFile() file: Express.Multer.File, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { if (!file) return fail(400, 'file_unsupported'); return this.imports.check(me, file, meta); }
  @Roles('admin') @ApiBearerAuth() @Get('admin/import/:id') @ApiOperation({ summary: 'One batch with the result for every row' })
  batch(@Param('id', ParseUUIDPipe) id: string) { return this.imports.batch(id); }
  @Roles('admin') @ApiBearerAuth() @Post('admin/import/:id/submit') @HttpCode(200) @ApiOperation({ summary: 'Submit the ready rows for approval as one request' })
  submit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.imports.submit(me, id, dto.justification ?? '', meta); }
}
