import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config/config';

/**
 * Sends email, by one of two routes:
 * - over HTTPS to a mail relay (MAIL_WEBHOOK_URL), for hosts that block mail ports (such as Render's free plan);
 * - through SMTP (SMTP_HOST and friends).
 * Without either (development) it prints the message to the server log instead.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger('Mail');
  private readonly transport: Transporter | null = !config.mail.webhook && config.mail.host
    ? nodemailer.createTransport({
        host: config.mail.host, port: config.mail.port, secure: config.mail.port === 465,
        auth: config.mail.user ? { user: config.mail.user, pass: config.mail.password } : undefined,
        // Never let a blocked or slow mail server hold up a request for long.
        connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 20_000,
      })
    : null;

  /** Last message per address, kept only outside production so automated tests can read reset links. */
  readonly outbox = new Map<string, { subject: string; text: string }>();

  get enabled(): boolean { return !!(config.mail.webhook || this.transport); }

  /** Queues the email and returns at once: delivery happens in the background, so a slow mail server never holds up a page. */
  async send(to: string, subject: string, text: string): Promise<void> {
    if (!config.isProd) this.outbox.set(to, { subject, text });
    void this.deliver(to, subject, text);
  }

  private async deliver(to: string, subject: string, text: string): Promise<void> {
    if (config.mail.webhook) return this.viaWebhook(to, subject, text);
    if (!this.transport) {
      if (!config.isProd) this.log.log(`Email to ${to}: ${subject}\n${text}`);
      else this.log.warn(`Email is not configured; email to ${to} was not sent.`);
      return;
    }
    try {
      await this.transport.sendMail({ from: config.mail.from, to, subject, text });
    } catch (e) {
      this.log.error(`Email to ${to} failed: ${(e as Error).message}`);
    }
  }

  /** The display name in MAIL_FROM, for example "Maritime Safety Heritage Archive". */
  private get fromName(): string {
    const m = /^\s*"?([^"<]+?)"?\s*</.exec(config.mail.from);
    return m ? m[1].trim() : 'Maritime Safety Heritage Archive';
  }

  private async viaWebhook(to: string, subject: string, text: string): Promise<void> {
    try {
      const res = await fetch(config.mail.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text, name: this.fromName }),
        redirect: 'follow',
        signal: AbortSignal.timeout(20_000),
      });
      const answer = (await res.text()).trim().slice(0, 200);
      if (!res.ok || !/^sent\b/i.test(answer)) this.log.error(`Email to ${to} failed: relay answered ${res.status} ${answer}`);
    } catch (e) {
      this.log.error(`Email to ${to} failed: ${(e as Error).message}`);
    }
  }
}
