import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { tmpdir } from 'os';
import { join } from 'path';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { config } from '../config/config';

export const UPLOAD_TMP = join(tmpdir(), 'msh-uploads');
mkdirSync(UPLOAD_TMP, { recursive: true });

/** Uploads stream to a temporary file (never held in memory), with random names and size limits. */
export const uploadOptions = (maxFiles: number): MulterOptions => ({
  storage: diskStorage({ destination: UPLOAD_TMP, filename: (_req, _file, cb) => cb(null, randomUUID()) }),
  limits: { fileSize: config.media.maxUploadMb * 1024 * 1024, files: maxFiles, fields: 40, fieldSize: 64 * 1024, parts: maxFiles + 40 },
});
