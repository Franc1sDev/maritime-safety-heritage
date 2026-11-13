import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Meta, RequestMeta, Roles } from '../common/decorators';
import { UploadLimit } from '../common/rate-limits';
import { uploadOptions } from '../media/upload';
import { RejectDto, ReviewDto, SubmissionInputDto, SubmissionQuery } from './submission.dto';
import { SubmissionsService } from './submissions.service';

@ApiTags('Submissions') @ApiBearerAuth()
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly subs: SubmissionsService) {}

  @UploadLimit() @Post() @UseInterceptors(FilesInterceptor('files', 5, uploadOptions(5))) @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Share a story, photograph or document (up to 5 files)' })
  create(@Body() dto: SubmissionInputDto, @UploadedFiles() files: Express.Multer.File[] = [], @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) {
    return this.subs.create(dto, files ?? [], me, meta);
  }

  @Get('mine') @ApiOperation({ summary: 'Your submissions and their status' })
  mine(@CurrentUser() me: AuthUser, @Query() q: SubmissionQuery) { return this.subs.mine(me, q); }

  @Roles('admin', 'editor') @Get() @ApiOperation({ summary: 'Review queue (pending first)' })
  list(@Query() q: SubmissionQuery) { return this.subs.list(q); }

  @Get(':id') @ApiOperation({ summary: 'One submission (yours, or any for admins)' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) { return this.subs.get(id, me); }

  @Roles('admin', 'editor') @Post(':id/approve') @HttpCode(200) @ApiOperation({ summary: 'Accept and create a draft archive item' })
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) {
    return this.subs.approve(id, dto.reviewNote, me, meta);
  }

  @Roles('admin', 'editor') @Post(':id/reject') @HttpCode(200) @ApiOperation({ summary: 'Decline with a note to the contributor' })
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) {
    return this.subs.reject(id, dto.reviewNote, me, meta);
  }
}
