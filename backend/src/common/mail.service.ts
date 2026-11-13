import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config/config';

/** Sends email through SMTP. Without SMTP settings (development) it prints the message to the server log instead. */
@Injectable()
export class MailService {
  private readonly log = new Logger('Mail');
  private readonly transport: Transporter | null = config.mail.host
    ? nodemailer.createTransport({
        host: config.mail.host, port: config.mail.port, secure: config.mail.port === 465,
        auth: config.mail.user ? { user: config.mail.user, pass: config.mail.password } : undefined,
      })
    : null;

  /** Last message per address, kept only outside production so automated tests can read reset links. */
  readonly outbox = new Map<string, { subject: string; text: string }>();

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!config.isProd) this.outbox.set(to, { subject, text });
    if (!this.transport) {
      if (!config.isProd) this.log.log(`Email to ${to}: ${subject}\n${text}`);
      else this.log.warn(`SMTP is not configured; email to ${to} was not sent.`);
      return;
    }
    try {
      await this.transport.sendMail({ from: config.mail.from, to, subject, text });
    } catch (e) {
      this.log.error(`Email to ${to} failed: ${(e as Error).message}`);
    }
  }
}
