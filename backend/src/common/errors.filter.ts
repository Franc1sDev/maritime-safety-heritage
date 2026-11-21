import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import type { AuthedRequest } from './decorators';
import { AppError, hasMessage, text } from './messages';

/**
 * Every error has the same shape: { statusCode, code, message, details }. The message is in the reader's language.
 * Unexpected errors are logged in full but never shown to the client.
 */
@Catch()
export class ErrorsFilter implements ExceptionFilter {
  private readonly log = new Logger('Errors');

  catch(err: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') return;
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<AuthedRequest>();
    const lang = req.user?.language || String(req.headers['x-language'] ?? req.headers['accept-language'] ?? 'en').slice(0, 2).toLowerCase();
    if (err instanceof AppError) {
      res.status(err.getStatus()).json({ statusCode: err.getStatus(), code: err.code, message: text(err.code, lang, err.vars), details: err.details });
      return;
    }
    if (err instanceof HttpException) {
      const status = err.getStatus();
      const body = err.getResponse() as { message?: string | string[]; code?: string };
      const raw = typeof body === 'string' ? body : body.message ?? err.message;
      const code = (typeof body === 'object' && body.code) || ({ 400: 'invalid_input', 401: 'session_expired', 403: 'forbidden', 404: 'not_found', 409: 'already_exists', 429: 'rate_limited' } as Record<number, string>)[status] || 'general_error';
      const details = Array.isArray(raw) ? raw : undefined;
      const message = hasMessage(code) && (lang !== 'en' || Array.isArray(raw) || status === 429) ? text(code, lang) : (Array.isArray(raw) ? raw.join(' ') : raw);
      res.status(status).json({ statusCode: status, code, message, details });
      return;
    }
    if (err instanceof QueryFailedError && (err as unknown as { code?: string }).code === '23505') {
      res.status(HttpStatus.CONFLICT).json({ statusCode: 409, code: 'already_exists', message: text('already_exists', lang) });
      return;
    }
    this.log.error(err instanceof Error ? err.stack : String(err));
    res.status(500).json({ statusCode: 500, code: 'general_error', message: text('general_error', lang) });
  }
}
