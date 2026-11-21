import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { AllowIncomplete, AuthUser, CurrentUser, isTeam, Public } from '../common/decorators';
import { Db } from '../common/db';
import { fail } from '../common/messages';
import { UploadLimit } from '../common/rate-limits';
import { MediaService, Purpose } from './media.service';
import { uploadOptions } from './upload';

class UploadDto {
  @IsOptional() @IsIn(['story', 'comment', 'message', 'avatar', 'consent', 'resource', 'concern', 'import', 'cover']) purpose?: Purpose;
  @IsOptional() @IsString() @MaxLength(500) altText?: string;
}
const TEAM_ONLY: Purpose[] = ['consent', 'resource', 'import', 'cover'];

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService, private readonly db: Db) {}

  /** Visitors may attach one photo to a safety concern; everything else needs an account. */
  @Public() @UploadLimit() @Post() @UseInterceptors(FileInterceptor('file', uploadOptions(1))) @ApiConsumes('multipart/form-data') @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload one file. It is type-checked, virus-scanned and stored encrypted; attach it to a story, comment or message by its id.' })
  async upload(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadDto, @CurrentUser() me: AuthUser | undefined) {
    if (!file) return fail(400, 'file_unsupported');
    const purpose = dto.purpose ?? 'story';
    if ((!me && purpose !== 'concern') || (TEAM_ONLY.includes(purpose) && !isTeam(me?.role))) {
      await import('fs').then((f) => f.promises.rm(file.path, { force: true }));
      return fail(me ? 403 : 401, me ? 'forbidden' : 'sign_in_required');
    }
    const m = await this.media.ingest(file, { ownerId: me?.id ?? null, purpose, altText: dto.altText });
    return this.media.view(m, { original: true });
  }

  @AllowIncomplete() @ApiBearerAuth() @Delete(':id') @HttpCode(204) @ApiOperation({ summary: 'Remove a file you uploaded and have not yet used' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser) {
    const m = await this.media.byId(id);
    if (!m) return;
    if (m.ownerId !== me.id || m.storyId || m.commentId || m.messageId) return fail(403, 'forbidden');
    await this.media.remove(id);
  }

  /** Profile photos are the one kind of file shown without a signed link. */
  @Public() @SkipThrottle() @Get('avatar/:id') @ApiOperation({ summary: 'A profile photo' })
  async avatar(@Param('id', ParseUUIDPipe) id: string, @Query('size') size: string, @Res() res: Response) {
    const m = await this.media.byId(id);
    const v = m?.purpose === 'avatar' ? (m.variants?.[size === 'medium' ? 'medium' : 'thumb'] ?? m.variants?.thumb) : null;
    if (!v) return fail(404, 'not_found');
    const { stream, size: bytes } = await this.media.openKey(v.key, v.encrypted);
    res.setHeader('Content-Type', v.mime); res.setHeader('Content-Length', String(bytes));
    res.setHeader('Cache-Control', 'public, max-age=86400'); res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); res.setHeader('X-Content-Type-Options', 'nosniff');
    stream.pipe(res);
  }

  /** Streams a file for a signed link, with byte ranges so audio and video can seek. HLS playlists are written with signed segment links. */
  @Public() @SkipThrottle() @Get('file/:id/:variant') @ApiOperation({ summary: 'Download or stream a file (signed, expiring link only)' })
  async file(@Param('id', ParseUUIDPipe) id: string, @Param('variant') variant: string, @Query('exp') exp: string, @Query('sig') sig: string, @Query('download') download: string | undefined,
    @Headers('range') range: string | undefined, @Res() res: Response) {
    if (!this.media.verify(`${id}.${variant}`, Number(exp), sig)) return fail(403, 'session_expired');
    const m = await this.media.byId(id);
    if (!m) return fail(404, 'not_found');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'private, max-age=600');

    const hls = /^(hls\d+)\.m3u8$/.exec(variant);
    if (hls) {
      const v = m.variants?.[hls[1]];
      if (!v?.segments) return fail(404, 'not_found');
      const lines = ['#EXTM3U', '#EXT-X-VERSION:3', `#EXT-X-TARGETDURATION:${Math.ceil(Math.max(...v.segments.map((s: any) => s.duration), 6))}`, '#EXT-X-PLAYLIST-TYPE:VOD', '#EXT-X-MEDIA-SEQUENCE:0'];
      v.segments.forEach((s: any, i: number) => lines.push(`#EXTINF:${s.duration.toFixed(3)},`, this.media.link(id, `${hls[1]}.${i}.ts`)));
      lines.push('#EXT-X-ENDLIST');
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.send(lines.join('\n'));
      return;
    }
    if (variant === 'master.m3u8') {
      const lines = ['#EXTM3U'];
      for (const [name, bw] of [['hls360', 600_000], ['hls720', 2_000_000]] as const) {
        if (m.variants?.[name]) lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bw},RESOLUTION=${name === 'hls360' ? '640x360' : '1280x720'}`, this.media.link(id, `${name}.m3u8`));
      }
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.send(lines.join('\n'));
      return;
    }
    let key = m.storageKey, encrypted = m.encrypted, mime = m.mimeType;
    const seg = /^(hls\d+)\.(\d+)\.ts$/.exec(variant);
    if (seg) {
      const s = m.variants?.[seg[1]]?.segments?.[Number(seg[2])];
      if (!s) return fail(404, 'not_found');
      key = s.key; encrypted = m.variants[seg[1]].encrypted; mime = 'video/mp2t';
    } else if (variant !== 'original') {
      const v = m.variants?.[variant];
      if (!v) return fail(404, 'not_found');
      key = v.key; encrypted = v.encrypted; mime = v.mime;
    }
    const size = await this.media.sizeOfKey(key, encrypted);
    res.setHeader('Content-Type', mime);
    res.setHeader('Accept-Ranges', 'bytes');
    // Documents open in a sandbox and are never executed.
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
    const inline = !download && (m.kind !== 'document' || mime === 'application/pdf' || mime.startsWith('text/plain'));
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(m.originalName)}`);
    if (variant === 'original') res.setHeader('ETag', `"${m.sha256}"`);

    const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
    if (range && match && size > 0) {
      let start = match[1] ? Number(match[1]) : NaN, end = match[2] ? Number(match[2]) : size - 1;
      if (Number.isNaN(start)) { start = Math.max(0, size - end); end = size - 1; }
      end = Math.min(end, size - 1);
      if (start > end || start >= size) { res.status(416).setHeader('Content-Range', `bytes */${size}`); res.end(); return; }
      const { stream } = await this.media.openKey(key, encrypted, { start, end });
      res.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', String(end - start + 1));
      stream.pipe(res);
      return;
    }
    const { stream } = await this.media.openKey(key, encrypted);
    res.setHeader('Content-Length', String(size));
    stream.pipe(res);
  }
}
