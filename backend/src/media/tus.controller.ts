import { Controller, Delete, Get, Head, HttpCode, Options, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { createWriteStream, promises as fs } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { AllowIncomplete, AuthUser, CurrentUser, isTeam, Public } from '../common/decorators';
import { fail } from '../common/messages';
import { config } from '../config/config';
import { MediaService, Purpose } from './media.service';
import { UPLOAD_TMP } from './upload';

const TUS = '1.0.0';
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
interface State { owner: string; length: number; name: string; purpose: Purpose; altText: string; mediaId?: string; createdAt: number }
const paths = (id: string) => ({ data: join(UPLOAD_TMP, `tus-${id}`), info: join(UPLOAD_TMP, `tus-${id}.json`) });
const TEAM_ONLY: Purpose[] = ['consent', 'resource', 'import', 'cover'];

/**
 * Resumable uploads with the tus protocol (Section 8.4): large files are sent in pieces and continue from where they
 * stopped if the network drops. Works with tus-js-client, Uppy and the tus client for Flutter.
 * When the last piece arrives the file goes through the same checks as any upload (type, virus scan, encryption).
 */
@ApiTags('Media') @SkipThrottle()
@Controller('uploads')
export class TusController {
  constructor(private readonly media: MediaService) {}

  private headers(res: Response) { res.setHeader('Tus-Resumable', TUS); res.setHeader('Cache-Control', 'no-store'); }
  private async load(id: string, me: AuthUser): Promise<State> {
    if (!ID.test(id)) return fail(404, 'not_found');
    const raw = await fs.readFile(paths(id).info, 'utf8').catch(() => null);
    if (!raw) return fail(404, 'not_found');
    const st = JSON.parse(raw) as State;
    if (st.owner !== me.id) return fail(404, 'not_found');
    return st;
  }

  @Public() @Options() @HttpCode(204) @ApiOperation({ summary: 'tus: what this server supports' })
  options(@Res() res: Response) {
    this.headers(res);
    res.setHeader('Tus-Version', TUS); res.setHeader('Tus-Extension', 'creation,termination'); res.setHeader('Tus-Max-Size', String(config.media.maxUploadMb * 1024 * 1024));
    res.end();
  }

  @AllowIncomplete() @ApiBearerAuth() @Post() @ApiOperation({ summary: 'tus: start a resumable upload (Upload-Length and Upload-Metadata headers)' })
  async create(@Req() req: Request, @Res() res: Response, @CurrentUser() me: AuthUser) {
    this.headers(res);
    const length = Number(req.headers['upload-length']);
    if (!Number.isInteger(length) || length <= 0) return fail(400, 'invalid_input');
    if (length > config.media.maxUploadMb * 1024 * 1024) return fail(413, 'file_too_large', { kind: 'a file', max: config.media.maxUploadMb });
    const meta: Record<string, string> = {};
    for (const part of String(req.headers['upload-metadata'] ?? '').split(',')) { const [k, v] = part.trim().split(' '); if (k) meta[k] = v ? Buffer.from(v, 'base64').toString('utf8') : ''; }
    const purpose = (meta.purpose || 'story') as Purpose;
    if (!['story', 'comment', 'message', 'avatar', 'consent', 'resource', 'import', 'cover'].includes(purpose) || (TEAM_ONLY.includes(purpose) && !isTeam(me.role))) return fail(403, 'forbidden');
    const id = randomUUID();
    const st: State = { owner: me.id, length, name: (meta.filename || meta.name || 'file').slice(0, 200), purpose, altText: (meta.altText ?? '').slice(0, 500), createdAt: Date.now() };
    await fs.writeFile(paths(id).data, ''); await fs.writeFile(paths(id).info, JSON.stringify(st));
    res.status(201).setHeader('Location', `${config.publicApiUrl}/api/v1/uploads/${id}`);
    res.setHeader('Upload-Offset', '0');
    res.end();
  }

  @AllowIncomplete() @ApiBearerAuth() @Head(':id') @ApiOperation({ summary: 'tus: how much has arrived so far' })
  async head(@Param('id') id: string, @Res() res: Response, @CurrentUser() me: AuthUser) {
    this.headers(res);
    const st = await this.load(id, me);
    const size = st.mediaId ? st.length : (await fs.stat(paths(id).data)).size;
    res.setHeader('Upload-Offset', String(size)); res.setHeader('Upload-Length', String(st.length));
    res.status(200).end();
  }

  @AllowIncomplete() @ApiBearerAuth() @Patch(':id') @ApiOperation({ summary: 'tus: send the next piece (Upload-Offset header, application/offset+octet-stream body)' })
  async patch(@Param('id') id: string, @Req() req: Request, @Res() res: Response, @CurrentUser() me: AuthUser) {
    this.headers(res);
    const st = await this.load(id, me);
    if (st.mediaId) { res.setHeader('Upload-Offset', String(st.length)); return void res.status(204).end(); }
    if (!String(req.headers['content-type'] ?? '').startsWith('application/offset+octet-stream')) return fail(415, 'invalid_input');
    const p = paths(id);
    const size = (await fs.stat(p.data)).size;
    if (Number(req.headers['upload-offset']) !== size) { res.setHeader('Upload-Offset', String(size)); return void res.status(409).json({ statusCode: 409, code: 'invalid_input', message: 'The upload offset does not match.' }); }
    let received = 0;
    req.on('data', (c: Buffer) => { received += c.length; if (size + received > st.length) req.destroy(new Error('Too much data')); });
    // If the connection drops mid-piece, what arrived is kept; the client asks for the offset and continues from there.
    await pipeline(req, createWriteStream(p.data, { flags: 'a' })).catch(() => undefined);
    const now = (await fs.stat(p.data)).size;
    res.setHeader('Upload-Offset', String(now));
    if (now >= st.length) {
      const m = await this.media.ingest({ path: p.data, originalname: st.name, size: now } as Express.Multer.File, { ownerId: me.id, purpose: st.purpose, altText: st.altText })
        .catch(async (e) => { await fs.rm(p.info, { force: true }); throw e; });
      st.mediaId = m.id;
      await fs.writeFile(p.info, JSON.stringify(st));
      res.setHeader('Upload-Media-Id', m.id);
    }
    res.status(204).end();
  }

  @AllowIncomplete() @ApiBearerAuth() @Get(':id') @ApiOperation({ summary: 'The stored file of a finished resumable upload (its id is what a story, comment or message attaches)' })
  async result(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    const st = await this.load(id, me);
    if (!st.mediaId) return { complete: false, offset: (await fs.stat(paths(id).data)).size, length: st.length };
    const m = await this.media.byId(st.mediaId);
    return m ? { complete: true, media: this.media.view(m, { original: true }) } : fail(404, 'not_found');
  }

  @AllowIncomplete() @ApiBearerAuth() @Delete(':id') @HttpCode(204) @ApiOperation({ summary: 'tus: cancel an upload' })
  async cancel(@Param('id') id: string, @Res() res: Response, @CurrentUser() me: AuthUser) {
    this.headers(res);
    await this.load(id, me);
    await fs.rm(paths(id).data, { force: true }); await fs.rm(paths(id).info, { force: true });
    res.status(204).end();
  }
}
