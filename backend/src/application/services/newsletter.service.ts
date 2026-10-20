import type { NewsletterCampaign, Publication } from '@domain/entities';
import type {
  IAuditRepository,
  ICampaignRepository,
  IPublicationRepository,
  ISubscriberRepository,
} from '@domain/repositories';
import {
  newsletterCampaign,
  newsletterConfirm,
  newsletterPublication,
  newsletterUnsubscribed,
  newsletterWelcome,
} from '@application/mail/templates';
import { env } from '@shared/config/env';
import { AppError } from '@shared/errors/AppError';
import { createLogger } from '@shared/logger';
import { generateToken, hashToken } from '@shared/utils/crypto';
import { sanitizeArticleHtml } from '@shared/utils/sanitize';
import type { Paginated, PaginationParams, RequestContext, UUID } from '@shared/types/common';
import type { NewsletterSubscriber } from '@domain/entities';
import type { SubscriberFilters } from '@domain/repositories';
import type { IMailer, SendMailInput } from '@domain/services';

const log = createLogger('newsletter');

/** How many emails go out at once during a broadcast. */
const SEND_BATCH_SIZE = 20;
const SEND_BATCH_PAUSE_MS = 1_000;

/**
 * Mailing list with double opt-in.
 *
 * Confirmation is not optional politeness: sending to an unconfirmed address
 * is how a sending domain's reputation gets destroyed, and a law firm cannot
 * afford its client correspondence landing in spam folders.
 */
export class NewsletterService {
  constructor(
    private readonly subscribers: ISubscriberRepository,
    private readonly campaigns: ICampaignRepository,
    private readonly publications: IPublicationRepository,
    private readonly mailer: IMailer,
    private readonly audit: IAuditRepository,
  ) {}

  // ── Public ────────────────────────────────────────────────────────────────

  async subscribe(
    data: { email: string; fullName?: string | null; source?: string; website?: string },
    context: RequestContext,
  ): Promise<{ message: string; alreadySubscribed: boolean }> {
    // Honeypot, as on the contact form.
    if (data.website && data.website.trim().length > 0) {
      return { message: 'Please check your inbox to confirm your subscription.', alreadySubscribed: false };
    }

    const existing = await this.subscribers.findByEmail(data.email);

    if (existing?.status === 'subscribed') {
      // Say nothing that would confirm the address is on the list.
      return {
        message: 'Please check your inbox to confirm your subscription.',
        alreadySubscribed: true,
      };
    }

    const token = generateToken(24);

    await this.subscribers.upsertPending({
      email: data.email,
      fullName: data.fullName ?? null,
      confirmTokenHash: hashToken(token),
      source: data.source ?? 'website',
      ipAddress: context.ipAddress ?? null,
    });

    const confirmUrl = `${env.SITE_URL}/newsletter/confirm?token=${encodeURIComponent(token)}`;

    await this.mailer.sendQuietly({
      to: data.email,
      ...newsletterConfirm({ confirmUrl, email: data.email }),
      template: 'newsletter.confirm',
      metadata: { email: data.email },
    });

    return {
      message: 'Please check your inbox to confirm your subscription.',
      alreadySubscribed: false,
    };
  }

  async confirm(token: string): Promise<{ message: string }> {
    const subscriber = await this.subscribers.findByConfirmTokenHash(hashToken(token));

    if (!subscriber) {
      throw AppError.unauthorized(
        'This confirmation link is invalid or has already been used.',
        'TOKEN_INVALID',
      );
    }

    if (subscriber.status === 'subscribed') {
      return { message: 'You are already subscribed. Thank you.' };
    }

    const confirmed = await this.subscribers.markConfirmed(subscriber.id);

    await this.mailer.sendQuietly({
      to: confirmed.email,
      ...newsletterWelcome({ unsubscribeUrl: this.unsubscribeUrl(confirmed.unsubscribeToken) }),
      template: 'newsletter.welcome',
      metadata: { subscriberId: confirmed.id },
    });

    log.info({ subscriberId: confirmed.id }, 'subscription confirmed');
    return { message: 'Your subscription is confirmed. Thank you for subscribing.' };
  }

  async unsubscribe(token: string): Promise<{ message: string }> {
    const subscriber = await this.subscribers.findByUnsubscribeToken(token);

    // Don't reveal whether the token was real.
    if (!subscriber) {
      return { message: 'You have been unsubscribed.' };
    }

    if (subscriber.status !== 'unsubscribed') {
      await this.subscribers.markUnsubscribed(subscriber.id);

      await this.mailer.sendQuietly({
        to: subscriber.email,
        ...newsletterUnsubscribed({ email: subscriber.email }),
        template: 'newsletter.unsubscribed',
        metadata: { subscriberId: subscriber.id },
      });
    }

    log.info({ subscriberId: subscriber.id }, 'unsubscribed');
    return { message: 'You have been unsubscribed.' };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  async listSubscribers(
    params: PaginationParams,
    filters?: SubscriberFilters,
  ): Promise<Paginated<NewsletterSubscriber>> {
    return this.subscribers.findMany(params, filters);
  }

  async removeSubscriber(id: UUID, context: RequestContext): Promise<void> {
    await this.subscribers.delete(id);

    await this.audit.record({
      adminUserId: context.actor?.id ?? null,
      actorEmail: context.actor?.email ?? null,
      action: 'delete',
      entity: 'newsletter_subscriber',
      entityId: id,
      beforeState: null,
      afterState: null,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });
  }

  /** CSV of the active list, for the firm's own records. */
  async exportSubscribers(): Promise<string> {
    const active = await this.subscribers.listActiveEmails();

    const rows = [
      'email,full_name',
      ...active.map(
        (subscriber) =>
          `"${subscriber.email.replace(/"/g, '""')}","${(subscriber.fullName ?? '').replace(/"/g, '""')}"`,
      ),
    ];

    return rows.join('\n');
  }

  async listCampaigns(params: PaginationParams): Promise<Paginated<NewsletterCampaign>> {
    return this.campaigns.findMany(params);
  }

  async createCampaign(
    data: Record<string, unknown>,
    context: RequestContext,
  ): Promise<NewsletterCampaign> {
    const payload: Record<string, unknown> = {
      ...data,
      createdBy: context.actor?.id ?? null,
    };

    // Campaign bodies are authored in a rich-text editor, so they are
    // untrusted HTML headed for other people's inboxes.
    if (typeof payload.body === 'string') {
      payload.body = sanitizeArticleHtml(payload.body);
    }

    return this.campaigns.create(payload);
  }

  async getCampaign(id: UUID): Promise<NewsletterCampaign> {
    const campaign = await this.campaigns.findById(id);
    if (!campaign) throw AppError.notFound('Campaign');
    return campaign;
  }

  async updateCampaign(
    id: UUID,
    data: Record<string, unknown>,
    context: RequestContext,
  ): Promise<NewsletterCampaign> {
    const existing = await this.getCampaign(id);

    // Editing a campaign that has already gone out would rewrite history
    // without recalling a single email.
    if (existing.status === 'sent' || existing.status === 'sending') {
      throw AppError.conflict('A campaign that has been sent can no longer be edited');
    }

    const payload: Record<string, unknown> = { ...data };
    if (typeof payload.body === 'string') {
      payload.body = sanitizeArticleHtml(payload.body);
    }

    const updated = await this.campaigns.update(id, payload);

    await this.audit.record({
      adminUserId: context.actor?.id ?? null,
      actorEmail: context.actor?.email ?? null,
      action: 'update',
      entity: 'newsletter_campaign',
      entityId: id,
      beforeState: existing,
      afterState: updated,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });

    return updated;
  }

  async removeCampaign(id: UUID, context: RequestContext): Promise<void> {
    const existing = await this.getCampaign(id);

    if (existing.status === 'sending') {
      throw AppError.conflict('That campaign is currently being sent');
    }

    await this.campaigns.delete(id);

    await this.audit.record({
      adminUserId: context.actor?.id ?? null,
      actorEmail: context.actor?.email ?? null,
      action: 'delete',
      entity: 'newsletter_campaign',
      entityId: id,
      beforeState: existing,
      afterState: null,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });
  }

  /** Sends a campaign that was drafted in the dashboard. */
  async sendCampaign(id: UUID, context: RequestContext): Promise<{ sent: number; failed: number }> {
    const campaign = await this.campaigns.findById(id);
    if (!campaign) throw AppError.notFound('Campaign');

    if (campaign.status === 'sent') {
      throw AppError.conflict('That campaign has already been sent');
    }
    if (campaign.status === 'sending') {
      throw AppError.conflict('That campaign is already being sent');
    }

    const recipients = await this.subscribers.listActiveEmails();

    if (recipients.length === 0) {
      throw AppError.unprocessable('There are no confirmed subscribers to send to');
    }

    await this.campaigns.markSending(id, recipients.length);

    let bodyHtml = campaign.body ?? '';

    // A campaign can simply point at an article instead of carrying its own copy.
    if (!bodyHtml && campaign.publicationId) {
      const publication = await this.publications.findById(campaign.publicationId);
      if (publication) {
        bodyHtml = `<p>${publication.excerpt ?? publication.title}</p>`;
      }
    }

    try {
      const { delivered, failed } = await this.sendInBatches(recipients, (recipient) => ({
        to: recipient.email,
        ...newsletterCampaign({
          subject: campaign.subject,
          preheader: campaign.preheader,
          bodyHtml,
          unsubscribeUrl: this.unsubscribeUrl(recipient.unsubscribeToken),
        }),
        template: 'newsletter.campaign',
        headers: this.listUnsubscribeHeaders(recipient.unsubscribeToken),
        metadata: { campaignId: id, subscriberId: recipient.id },
      }));

      await this.campaigns.markSent(id, delivered, failed);

      await this.audit.record({
        adminUserId: context.actor?.id ?? null,
        actorEmail: context.actor?.email ?? null,
        action: 'send',
        entity: 'newsletter_campaign',
        entityId: id,
        beforeState: null,
        afterState: { delivered, failed, recipients: recipients.length },
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      });

      log.info({ campaignId: id, delivered, failed }, 'campaign sent');
      return { sent: delivered, failed };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown failure';
      await this.campaigns.markFailed(id, message);
      throw AppError.mail('The campaign could not be sent', error);
    }
  }

  /** Announces a newly published article to the list. */
  async broadcastPublication(publication: Publication): Promise<{ sent: number; failed: number }> {
    const recipients = await this.subscribers.listActiveEmails();
    if (recipients.length === 0) return { sent: 0, failed: 0 };

    const { delivered, failed } = await this.sendInBatches(recipients, (recipient) => ({
      to: recipient.email,
      ...newsletterPublication({
        title: publication.title,
        excerpt: publication.excerpt,
        slug: publication.slug,
        coverImageUrl: publication.coverImageUrl,
        categoryName: publication.category?.name ?? null,
        readingMinutes: publication.readingMinutes,
        unsubscribeUrl: this.unsubscribeUrl(recipient.unsubscribeToken),
      }),
      template: 'newsletter.publication',
      headers: this.listUnsubscribeHeaders(recipient.unsubscribeToken),
      metadata: { publicationId: publication.id, subscriberId: recipient.id },
    }));

    log.info(
      { publicationId: publication.id, delivered, failed },
      'publication broadcast complete',
    );

    return { sent: delivered, failed };
  }

  /**
   * Sends in small batches with a pause between them.
   *
   * Firing several hundred messages at an SMTP relay simultaneously is a
   * reliable way to get rate-limited or greylisted. One failed recipient is
   * counted and skipped rather than aborting the run.
   */
  private async sendInBatches<T>(
    recipients: T[],
    build: (recipient: T) => SendMailInput,
  ): Promise<{ delivered: number; failed: number }> {
    let delivered = 0;
    let failed = 0;

    for (let index = 0; index < recipients.length; index += SEND_BATCH_SIZE) {
      const batch = recipients.slice(index, index + SEND_BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((recipient) => this.mailer.send(build(recipient))),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') delivered += 1;
        else failed += 1;
      }

      const hasMore = index + SEND_BATCH_SIZE < recipients.length;
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, SEND_BATCH_PAUSE_MS));
      }
    }

    return { delivered, failed };
  }

  private unsubscribeUrl(token: string): string {
    return `${env.SITE_URL}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
  }

  /**
   * RFC 8058 one-click unsubscribe.
   *
   * Gmail and Yahoo require this on bulk mail. Without it, deliverability
   * suffers and recipients reach for "report spam" instead.
   */
  private listUnsubscribeHeaders(token: string): Record<string, string> {
    return {
      'List-Unsubscribe': `<${this.unsubscribeUrl(token)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  }
}
