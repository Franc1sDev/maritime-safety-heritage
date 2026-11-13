import {
  BadRequestException, Controller, Delete, ForbiddenException, Get, Headers, HttpCode, NotFoundException, Param, ParseUUIDPipe,
  Post, Query, Res, UploadedFile, UseInterceptors, Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { IsIn, IsOptional } from 'class-validator';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { AuthUser, CurrentUser, Meta, Public, RequestMeta, Roles } from '../common/decorators';
import { UploadLimit } from '../common/rate-limits';
import { ArchiveRecord } from '../database/entities';
import { MediaService } from './media.service';
import { uploadOptions } from './upload';

class UploadDto { @ApiPropertyOptional({ enum: ['original', 'web', 'thumbnail'] }) @IsOptional() @IsIn(['original', 'web', 'thumbnail']) role?: 'original' | 'web' | 'thumbnail' }

@ApiTags('Media')
@Controller()
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly activity: ActivityService,
    @InjectRepository(ArchiveRecord) private readonly records: Repository<ArchiveRecord>,
  ) {}

  @ApiBearerAuth() @Roles('admin') @UploadLimit() @Post('records/:id/media')
  @UseInterceptors(FileInterceptor('file', uploadOptions(1)))
  @ApiConsumes('multipart/form-data') @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, role: { type: 'string' } } } })
  @ApiOperation({ summary: 'Attach a file to an archive item' })
  async upload(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File, @Body() dto: UploadDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) {
    if (!file) throw new BadRequestException('Choose a file to upload.');
    const record = await this.records.findOneBy({ id });
    if (!record) {
      await this.media.discard([file]);
      throw new NotFoundException('That archive item does not exist.');
    }
    const m = await this.media.ingest(file, { recordId: id, role: dto.role, uploadedById: me.id, prefix: 'records' });
    await this.activity.record({ actor: me, action: 'media.upload', entityType: 'record', entityId: id, summary: `Uploaded "${m.originalName}" to ${record.identifier}`, details: { mediaId: m.id, sha256: m.sha256 }, ip: meta.ip });
    return this.media.describe(m);
  }

  @ApiBearerAuth() @Get('media/:id/link') @ApiOperation({ summary: 'A fresh signed link for a file' })
  async link(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) {
    return this.media.describe(await this.media.getAccessible(id, me));
  }

  @ApiBearerAuth() @Roles('admin') @Delete('media/:id') @HttpCode(204) @ApiOperation({ summary: 'Delete a file' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) {
    const m = await this.media.remove(id);
    await this.activity.record({ actor: me, action: 'media.delete', entityType: 'media', entityId: id, summary: `Deleted "${m.originalName}"`, details: { recordId: m.recordId, submissionId: m.submissionId }, ip: meta.ip });
  }

  /** Streams a file for a signed link, with byte ranges so audio and video can seek. */
  @Public() @SkipThrottle() @Get('media/file/:id')
  @ApiOperation({ summary: 'Download or stream a file (signed link only)' })
  async file(@Param('id', ParseUUIDPipe) id: string, @Query('exp') exp: string, @Query('sig') sig: string, @Headers('range') range: string | undefined, @Res() res: Response) {
    if (!this.media.verifySignature(id, Number(exp), sig)) throw new ForbiddenException('This link has expired. Open the item again to get a new one.');
    const m = await this.media.findById(id);
    if (!m) throw new NotFoundException('That file does not exist.');
    const size = await this.media.storage.size(m.storageKey);
    res.setHeader('Content-Type', m.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(m.originalName)}`);
    res.setHeader('ETag', `"${m.sha256}"`);

    const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
    if (range && match && size > 0) {
      let start = match[1] ? Number(match[1]) : NaN, end = match[2] ? Number(match[2]) : size - 1;
      if (Number.isNaN(start)) { start = Math.max(0, size - end); end = size - 1; }
      end = Math.min(end, size - 1);
      if (start > end || start >= size) {
        res.status(416).setHeader('Content-Range', `bytes */${size}`);
        res.end();
        return;
      }
      const { stream } = await this.media.storage.read(m.storageKey, { start, end });
      res.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', String(end - start + 1));
      stream.pipe(res);
      return;
    }
    const { stream } = await this.media.storage.read(m.storageKey);
    res.setHeader('Content-Length', String(size));
    stream.pipe(res);
  }
}
