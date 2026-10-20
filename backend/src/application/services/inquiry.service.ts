import type { ContactInquiry } from '@domain/entities';
import type {
  IAuditRepository,
  IInquiryRepository,
  IPracticeAreaRepository,
  ISettingsRepository,
  InquiryFilters,
} from '@domain/repositories';
import {
  inquiryAcknowledgement,
  inquiryAdminNotification,
  inquiryResponse,
} from '@application/mail/templates';
import { CrudService } from './crud.service';
import { env } from '@shared/config/env';
import { AppError } from '@shared/errors/AppError';
import { createLogger } from '@shared/logger';
import type { InquiryStatus, RequestContext, UUID } from '@shared/types/common';
import type { IMailer } from '@domain/services';

const log = createLogger('inquiries');

/**
 * The contact form and everything behind it.
 *
 * v1 had no form at all — just an email address on the page. This gives the
 * firm a tracked queue with references, statuses and a reply path, which is
 * what a law firm actually needs for client intake.
 */
export class InquiryService extends CrudService<ContactInquiry, InquiryFilters> {
  constructor(
    private readonly inquiries: IInquiryRepository,
    private readonly practiceAreas: IPracticeAreaRepository,
    private readonly settings: ISettingsRepository,
    private readonly mailer: IMailer,
    audit: IAuditRepository,
  ) {
    super(inquiries, audit, { resource: 'Inquiry', auditEntity: 'contact_inquiry' });
  }

  /**
   * Public submission.
   *
   * Both emails are dispatched without blocking the response: a client who has
   * just pressed "send" should see a confirmation immediately, and an SMTP
   * hiccup must not turn their enquiry into an error page. The record is
   * already safely in the database by that point.
   */
  async submit(
    data: {
      fullName: string;
      email: string;
      phone?: string | null;
      company?: string | null;
      subject?: string | null;
      message: string;
      practiceAreaId?: string | null;
      website?: string;
    },
    context: RequestContext,
  ): Promise<{ reference: string; message: string }> {
    // Honeypot: a human never sees this field, so anything in it is a bot.
    // Accepted and quietly filed as spam — rejecting it would teach the bot
    // which field to leave alone next time.
    const isSpam = Boolean(data.website && data.website.trim().length > 0);

    const reference = await this.inquiries.nextReference();

    const inquiry = await this.inquiries.create({
      reference,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone ?? null,
      company: data.company ?? null,
      subject: data.subject ?? null,
      message: data.message,
      practiceAreaId: data.practiceAreaId ?? null,
      status: isSpam ? 'spam' : 'new',
      source: 'website',
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });

    if (isSpam) {
      log.info({ reference }, 'inquiry flagged as spam by honeypot');
      return { reference, message: 'Thank you. Your message has been received.' };
    }

    void this.dispatchNotifications(inquiry);

    log.info({ reference, email: data.email }, 'inquiry received');

    return {
      reference,
      message:
        'Thank you for contacting Neoteric LP. We have received your enquiry and will ' +
        'respond shortly.',
    };
  }

  async updateStatus(
    id: UUID,
    status: InquiryStatus,
    internalNote: string | null | undefined,
    context: RequestContext,
  ): Promise<ContactInquiry> {
    const payload: Record<string, unknown> = { status };

    if (internalNote !== undefined) payload.internalNote = internalNote;

    if (status === 'responded') {
      payload.respondedAt = new Date().toISOString();
      payload.respondedBy = context.actor?.id ?? null;
    }

    return this.update(id, payload, context);
  }

  /** Sends a reply written in the dashboard, then files the enquiry. */
  async respond(
    id: UUID,
    message: string,
    markResponded: boolean,
    context: RequestContext,
  ): Promise<ContactInquiry> {
    const inquiry = await this.getById(id);

    if (inquiry.status === 'spam') {
      throw AppError.unprocessable('This enquiry is marked as spam. Reclassify it first.');
    }

    await this.mailer.send({
      to: inquiry.email,
      ...inquiryResponse({
        fullName: inquiry.fullName,
        reference: inquiry.reference,
        responseBody: message,
        responderName: context.actor?.fullName ?? 'Neoteric LP',
      }),
      template: 'inquiry.response',
      metadata: { inquiryId: id, reference: inquiry.reference },
    });

    if (!markResponded) return inquiry;

    return this.update(
      id,
      {
        status: 'responded',
        respondedAt: new Date().toISOString(),
        respondedBy: context.actor?.id ?? null,
      },
      context,
    );
  }

  async statusCounts(): Promise<Record<InquiryStatus, number>> {
    return this.inquiries.countByStatus();
  }

  private async dispatchNotifications(inquiry: ContactInquiry): Promise<void> {
    const practiceArea = inquiry.practiceAreaId
      ? await this.practiceAreas.findById(inquiry.practiceAreaId).catch(() => null)
      : null;

    const notification = inquiryAdminNotification({
      reference: inquiry.reference,
      fullName: inquiry.fullName,
      email: inquiry.email,
      phone: inquiry.phone,
      company: inquiry.company,
      subject: inquiry.subject,
      message: inquiry.message,
      practiceArea: practiceArea?.name ?? null,
      submittedAt: new Date(inquiry.createdAt),
    });

    await this.mailer.sendQuietly({
      to: env.MAIL_ADMIN_RECIPIENTS,
      ...notification,
      // So hitting reply in the firm's inbox goes to the client.
      replyTo: inquiry.email,
      template: 'inquiry.admin-notification',
      metadata: { inquiryId: inquiry.id, reference: inquiry.reference },
    });

    const autoReply = await this.settings
      .getValue<boolean>('features.auto_reply_inquiries', true)
      .catch(() => true);

    if (!autoReply) return;

    await this.mailer.sendQuietly({
      to: inquiry.email,
      ...inquiryAcknowledgement({
        fullName: inquiry.fullName,
        reference: inquiry.reference,
        message: inquiry.message,
      }),
      template: 'inquiry.acknowledgement',
      metadata: { inquiryId: inquiry.id, reference: inquiry.reference },
    });
  }
}
