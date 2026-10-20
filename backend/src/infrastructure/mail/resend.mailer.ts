import nodemailer, { type Transporter } from 'nodemailer';
import type { IMailer, SendMailInput, SendMailResult } from '@domain/services';
import type { IEmailLogRepository } from '@domain/repositories';
import { env } from '@shared/config/env';
import { AppError } from '@shared/errors/AppError';
import { createLogger } from '@shared/logger';

const log = createLogger('mailer');

/**
 * Transactional mail over Resend's SMTP endpoint.
 *
 * SMTP rather than Resend's REST API because it keeps the provider swappable —
 * moving to SES, Postmark or a client's own relay is a change of four
 * environment variables, not a rewrite.
 *
 * Every attempt is written to `email_logs`, so a client insisting they never
 * received an acknowledgement can be answered from the database.
 */
export class ResendMailer implements IMailer {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly emailLogs?: IEmailLogRepository) {
    this.from = `${env.MAIL_FROM_NAME} <${env.MAIL_FROM_EMAIL}>`;

    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      // Keep the connection warm across a burst of newsletter sends.
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(input: SendMailInput): Promise<SendMailResult> {
    const recipients = Array.isArray(input.to) ? input.to : [input.to];

    // Dry-run mode: render and log, send nothing. Useful in development and
    // in CI, where a real send would be both slow and rude.
    if (env.MAIL_DRY_RUN || !env.SMTP_PASSWORD) {
      log.info(
        { to: recipients, subject: input.subject, template: input.template },
        env.SMTP_PASSWORD ? 'mail dry-run: not sent' : 'no SMTP password configured: not sent',
      );

      await this.record(input, recipients, 'skipped', null, null);
      return { messageId: null, accepted: [], rejected: [], skipped: true };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: recipients,
        cc: input.cc,
        bcc: input.bcc,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo ?? env.MAIL_REPLY_TO,
        headers: input.headers,
      });

      log.info(
        { to: recipients, subject: input.subject, template: input.template, messageId: info.messageId },
        'mail sent',
      );

      await this.record(input, recipients, 'sent', info.messageId ?? null, null);

      return {
        messageId: info.messageId ?? null,
        accepted: (info.accepted ?? []).map(String),
        rejected: (info.rejected ?? []).map(String),
        skipped: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown SMTP failure';
      log.error({ err: error, to: recipients, template: input.template }, 'mail send failed');

      await this.record(input, recipients, 'failed', null, message);
      throw AppError.mail('The email could not be sent', error);
    }
  }

  /**
   * Sends without throwing.
   *
   * Used where mail is a side effect rather than the point: a client's contact
   * form submission must still succeed if the notification email bounces off a
   * misconfigured SMTP server.
   */
  async sendQuietly(input: SendMailInput): Promise<SendMailResult | null> {
    try {
      return await this.send(input);
    } catch {
      return null;
    }
  }

  async verifyConnection(): Promise<boolean> {
    if (env.MAIL_DRY_RUN || !env.SMTP_PASSWORD) return false;

    try {
      await this.transporter.verify();
      log.info({ host: env.SMTP_HOST }, 'SMTP connection verified');
      return true;
    } catch (error) {
      log.warn({ err: error, host: env.SMTP_HOST }, 'SMTP verification failed');
      return false;
    }
  }

  async close(): Promise<void> {
    this.transporter.close();
  }

  private async record(
    input: SendMailInput,
    recipients: string[],
    status: 'sent' | 'failed' | 'skipped',
    messageId: string | null,
    errorMessage: string | null,
  ): Promise<void> {
    if (!this.emailLogs) return;

    try {
      await this.emailLogs.record({
        toEmail: recipients.join(', '),
        ccEmails: input.cc ?? null,
        template: input.template,
        subject: input.subject,
        status,
        providerMessageId: messageId,
        errorMessage,
        metadata: input.metadata ?? {},
        sentAt: status === 'sent' ? new Date().toISOString() : null,
      });
    } catch (error) {
      // A logging failure must never fail the send it was recording.
      log.warn({ err: error }, 'could not write email log');
    }
  }
}
