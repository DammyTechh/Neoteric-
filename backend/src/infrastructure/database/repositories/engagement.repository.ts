import { BaseRepository, type QueryBuilder } from './base.repository';
import {
  supabase,
  translateDatabaseError,
  unwrapMaybe,
} from '@infrastructure/database/supabase.client';
import { toCampaign, toContactInquiry, toSubscriber } from '@infrastructure/database/mappers';
import type { ContactInquiry, NewsletterCampaign, NewsletterSubscriber } from '@domain/entities';
import type {
  ICampaignRepository,
  IInquiryRepository,
  InquiryFilters,
  ISubscriberRepository,
  SubscriberFilters,
} from '@domain/repositories';
import type { InquiryStatus, UUID } from '@shared/types/common';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Contact inquiries ───────────────────────────────────────────────────────

const INQUIRY_COLUMNS = {
  reference: 'reference',
  fullName: 'full_name',
  email: 'email',
  phone: 'phone',
  company: 'company',
  subject: 'subject',
  message: 'message',
  practiceAreaId: 'practice_area_id',
  status: 'status',
  internalNote: 'internal_note',
  respondedAt: 'responded_at',
  respondedBy: 'responded_by',
  source: 'source',
  ipAddress: 'ip_address',
  userAgent: 'user_agent',
};

export class InquiryRepository
  extends BaseRepository<ContactInquiry, InquiryFilters>
  implements IInquiryRepository
{
  constructor() {
    super({
      table: 'contact_inquiries',
      resource: 'Inquiry',
      mapper: toContactInquiry,
      columnMap: INQUIRY_COLUMNS,
    });
  }

  protected override applyFilters(query: QueryBuilder, filters?: InquiryFilters): QueryBuilder {
    let next = query;
    if (filters?.status) next = next.eq('status', filters.status);
    if (filters?.from) next = next.gte('created_at', filters.from);
    if (filters?.to) next = next.lte('created_at', filters.to);
    if (filters?.search) {
      next = this.searchAcross(next, filters.search, [
        'full_name',
        'email',
        'subject',
        'message',
        'reference',
      ]);
    }
    return next;
  }

  /** Human-readable reference, e.g. NLP-2026-0007. */
  async nextReference(): Promise<string> {
    const { data, error } = await supabase.rpc('next_inquiry_reference');

    if (error || !data) {
      // Fall back to a timestamp-derived reference rather than failing the
      // submission — losing a client enquiry is worse than an odd reference.
      const year = new Date().getFullYear();
      return `NLP-${year}-${Date.now().toString().slice(-4)}`;
    }

    return data as string;
  }

  async countByStatus(): Promise<Record<InquiryStatus, number>> {
    const statuses: InquiryStatus[] = ['new', 'in_review', 'responded', 'closed', 'spam'];

    const counts = await Promise.all(
      statuses.map(async (status) => {
        const { count } = await supabase
          .from('contact_inquiries')
          .select('id', { count: 'exact', head: true })
          .eq('status', status);
        return [status, count ?? 0] as const;
      }),
    );

    return Object.fromEntries(counts) as Record<InquiryStatus, number>;
  }
}

// ── Newsletter subscribers ──────────────────────────────────────────────────

const SUBSCRIBER_COLUMNS = {
  email: 'email',
  fullName: 'full_name',
  status: 'status',
  source: 'source',
  ipAddress: 'ip_address',
  bounceCount: 'bounce_count',
};

export class SubscriberRepository
  extends BaseRepository<NewsletterSubscriber, SubscriberFilters>
  implements ISubscriberRepository
{
  constructor() {
    super({
      table: 'newsletter_subscribers',
      resource: 'Subscriber',
      mapper: toSubscriber,
      columnMap: SUBSCRIBER_COLUMNS,
    });
  }

  protected override applyFilters(query: QueryBuilder, filters?: SubscriberFilters): QueryBuilder {
    let next = query;
    if (filters?.status) next = next.eq('status', filters.status);
    if (filters?.search) next = this.searchAcross(next, filters.search, ['email', 'full_name']);
    return next;
  }

  async findByEmail(email: string): Promise<NewsletterSubscriber | null> {
    const result = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .ilike('email', email.trim())
      .maybeSingle();

    const row = unwrapMaybe(result as any, 'find subscriber');
    return row ? toSubscriber(row) : null;
  }

  async findByConfirmTokenHash(tokenHash: string): Promise<NewsletterSubscriber | null> {
    const result = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .eq('confirm_token_hash', tokenHash)
      .maybeSingle();

    const row = unwrapMaybe(result as any, 'find subscriber by token');
    return row ? toSubscriber(row) : null;
  }

  async findByUnsubscribeToken(token: string): Promise<NewsletterSubscriber | null> {
    const result = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .eq('unsubscribe_token', token)
      .maybeSingle();

    const row = unwrapMaybe(result as any, 'find subscriber by unsubscribe token');
    return row ? toSubscriber(row) : null;
  }

  /**
   * Double opt-in entry point.
   *
   * Re-subscribing an address that previously unsubscribed resets it to
   * pending rather than erroring, so a returning reader just gets a fresh
   * confirmation email.
   */
  async upsertPending(data: {
    email: string;
    fullName?: string | null;
    confirmTokenHash: string;
    source?: string;
    ipAddress?: string | null;
  }): Promise<NewsletterSubscriber> {
    const email = data.email.trim().toLowerCase();
    const existing = await this.findByEmail(email);

    if (existing) {
      const { data: row, error } = await supabase
        .from('newsletter_subscribers')
        .update({
          status: existing.status === 'subscribed' ? 'subscribed' : 'pending',
          confirm_token_hash: data.confirmTokenHash,
          full_name: data.fullName ?? existing.fullName,
          unsubscribed_at: null,
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw translateDatabaseError(error, 'update subscriber');
      return toSubscriber(row);
    }

    const { data: row, error } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email,
        full_name: data.fullName ?? null,
        status: 'pending',
        confirm_token_hash: data.confirmTokenHash,
        source: data.source ?? 'website',
        ip_address: data.ipAddress ?? null,
      })
      .select('*')
      .single();

    if (error) throw translateDatabaseError(error, 'create subscriber');
    return toSubscriber(row);
  }

  async markConfirmed(id: UUID): Promise<NewsletterSubscriber> {
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .update({
        status: 'subscribed',
        confirmed_at: new Date().toISOString(),
        confirm_token_hash: null,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw translateDatabaseError(error, 'confirm subscriber');
    return toSubscriber(data);
  }

  async markUnsubscribed(id: UUID): Promise<void> {
    const { error } = await supabase
      .from('newsletter_subscribers')
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw translateDatabaseError(error, 'unsubscribe');
  }

  /** The send list for a broadcast. */
  async listActiveEmails(): Promise<
    { id: UUID; email: string; fullName: string | null; unsubscribeToken: string }[]
  > {
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select('id, email, full_name, unsubscribe_token')
      .eq('status', 'subscribed');

    if (error) throw translateDatabaseError(error, 'list active subscribers');

    return (data ?? []).map((row: any) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name ?? null,
      unsubscribeToken: row.unsubscribe_token,
    }));
  }
}

// ── Campaigns ───────────────────────────────────────────────────────────────

const CAMPAIGN_COLUMNS = {
  subject: 'subject',
  preheader: 'preheader',
  body: 'body',
  publicationId: 'publication_id',
  status: 'status',
  scheduledFor: 'scheduled_for',
  createdBy: 'created_by',
};

export class CampaignRepository
  extends BaseRepository<NewsletterCampaign>
  implements ICampaignRepository
{
  constructor() {
    super({
      table: 'newsletter_campaigns',
      resource: 'Campaign',
      mapper: toCampaign,
      columnMap: CAMPAIGN_COLUMNS,
    });
  }

  async markSending(id: UUID, recipientCount: number): Promise<void> {
    const { error } = await supabase
      .from('newsletter_campaigns')
      .update({ status: 'sending', recipient_count: recipientCount })
      .eq('id', id);

    if (error) throw translateDatabaseError(error, 'mark campaign sending');
  }

  async markSent(id: UUID, delivered: number, failed: number): Promise<void> {
    const { error } = await supabase
      .from('newsletter_campaigns')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        delivered_count: delivered,
        failed_count: failed,
      })
      .eq('id', id);

    if (error) throw translateDatabaseError(error, 'mark campaign sent');
  }

  async markFailed(id: UUID, errorMessage: string): Promise<void> {
    const { error } = await supabase
      .from('newsletter_campaigns')
      .update({ status: 'failed', error_message: errorMessage })
      .eq('id', id);

    if (error) throw translateDatabaseError(error, 'mark campaign failed');
  }
}
