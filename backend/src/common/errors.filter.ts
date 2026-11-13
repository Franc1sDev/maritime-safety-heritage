import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';

/** Consistent JSON errors. Unexpected errors are logged in full but never shown to the client. */
@Catch()
export class ErrorsFilter implements ExceptionFilter {
  private readonly log = new Logger('Errors');

  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (err instanceof HttpException) {
      const status = err.getStatus();
      const body = err.getResponse();
      const message = typeof body === 'string' ? body : (body as { message?: string | string[] }).message ?? err.message;
      res.status(status).json({ statusCode: status, message });
      return;
    }
    if (err instanceof QueryFailedError && (err as unknown as { code?: string }).code === '23505') {
      res.status(HttpStatus.CONFLICT).json({ statusCode: 409, message: 'That already exists.' });
      return;
    }
    this.log.error(err instanceof Error ? err.stack : String(err));
    res.status(500).json({ statusCode: 500, message: 'Something went wrong on the server. Try again shortly.' });
  }
}
