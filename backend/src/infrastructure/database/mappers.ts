/**
 * Row → entity mappers.
 *
 * This is the only place in the codebase that knows a column is called
 * `cover_image_url` rather than `coverImageUrl`. Everything above this file
 * speaks camelCase entities.
 */

import type {
  Achievement,
  AdminUser,
  AdminUserWithSecret,
  AuditLog,
  ContactInquiry,
  DashboardStats,
  EmailLog,
  Industry,
  MediaAsset,
  NewsletterCampaign,
  NewsletterSubscriber,
  PracticeArea,
  Publication,
  PublicationAttachment,
  PublicationCategory,
  SiteSetting,
  TeamMember,
  Testimonial,
} from '@domain/entities';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export const toAdminUser = (row: Row): AdminUser => ({
  id: row.id,
  email: row.email,
  fullName: row.full_name,
  role: row.role,
  avatarUrl: row.avatar_url ?? null,
  isActive: row.is_active,
  mustChangePassword: row.must_change_password,
  lastLoginAt: row.last_login_at ?? null,
  lastLoginIp: row.last_login_ip ?? null,
  failedLoginAttempts: row.failed_login_attempts ?? 0,
  lockedUntil: row.locked_until ?? null,
  passwordChangedAt: row.password_changed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toAdminUserWithSecret = (row: Row): AdminUserWithSecret => ({
  ...toAdminUser(row),
  passwordHash: row.password_hash,
});

export const toMediaAsset = (row: Row): MediaAsset => ({
  id: row.id,
  bucket: row.bucket,
  storagePath: row.storage_path,
  publicUrl: row.public_url,
  originalName: row.original_name,
  mimeType: row.mime_type,
  sizeBytes: Number(row.size_bytes),
  width: row.width ?? null,
  height: row.height ?? null,
  altText: row.alt_text ?? null,
  caption: row.caption ?? null,
  folder: row.folder,
  checksum: row.checksum ?? null,
  uploadedBy: row.uploaded_by ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toPublicationCategory = (row: Row): PublicationCategory => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description ?? null,
  colour: row.colour ?? null,
  sortOrder: row.sort_order ?? 0,
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toPublication = (row: Row): Publication => ({
  id: row.id,
  title: row.title,
  slug: row.slug,
  excerpt: row.excerpt ?? null,
  body: row.body ?? null,
  categoryId: row.category_id ?? null,
  category: row.publication_categories
    ? {
        id: row.publication_categories.id,
        name: row.publication_categories.name,
        slug: row.publication_categories.slug,
        colour: row.publication_categories.colour ?? null,
      }
    : null,
  coverImageId: row.cover_image_id ?? null,
  coverImageUrl: row.cover_image_url ?? null,
  coverAlt: row.cover_alt ?? null,
  sourceUrl: row.source_url ?? null,
  status: row.status,
  isFeatured: row.is_featured ?? false,
  authorName: row.author_name ?? 'Neoteric LP',
  tags: row.tags ?? [],
  readingMinutes: row.reading_minutes ?? 1,
  viewCount: Number(row.view_count ?? 0),
  seoTitle: row.seo_title ?? null,
  seoDescription: row.seo_description ?? null,
  ogImageUrl: row.og_image_url ?? null,
  publishedAt: row.published_at ?? null,
  scheduledFor: row.scheduled_for ?? null,
  createdBy: row.created_by ?? null,
  updatedBy: row.updated_by ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toPublicationAttachment = (row: Row): PublicationAttachment => ({
  id: row.id,
  publicationId: row.publication_id,
  mediaId: row.media_id,
  label: row.label ?? null,
  sortOrder: row.sort_order ?? 0,
  media: row.media_assets ? toMediaAsset(row.media_assets) : undefined,
  createdAt: row.created_at,
});

export const toPracticeArea = (row: Row): PracticeArea => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  summary: row.summary ?? null,
  description: row.description ?? null,
  imageId: row.image_id ?? null,
  imageUrl: row.image_url ?? null,
  icon: row.icon ?? null,
  sortOrder: row.sort_order ?? 0,
  isActive: row.is_active ?? true,
  seoTitle: row.seo_title ?? null,
  seoDescription: row.seo_description ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toIndustry = (row: Row): Industry => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description ?? null,
  imageId: row.image_id ?? null,
  imageUrl: row.image_url ?? null,
  icon: row.icon ?? null,
  sortOrder: row.sort_order ?? 0,
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toTeamMember = (row: Row): TeamMember => ({
  id: row.id,
  fullName: row.full_name,
  slug: row.slug,
  roleTitle: row.role_title,
  teamGroup: row.team_group,
  bio: row.bio ?? null,
  qualifications: row.qualifications ?? [],
  imageId: row.image_id ?? null,
  imageUrl: row.image_url ?? null,
  email: row.email ?? null,
  phone: row.phone ?? null,
  linkedinUrl: row.linkedin_url ?? null,
  twitterUrl: row.twitter_url ?? null,
  sortOrder: row.sort_order ?? 0,
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toTestimonial = (row: Row): Testimonial => ({
  id: row.id,
  quote: row.quote,
  authorName: row.author_name,
  authorRole: row.author_role ?? null,
  authorCompany: row.author_company ?? null,
  authorImageId: row.author_image_id ?? null,
  authorImageUrl: row.author_image_url ?? null,
  rating: row.rating ?? null,
  isPublished: row.is_published ?? false,
  sortOrder: row.sort_order ?? 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toAchievement = (row: Row): Achievement => ({
  id: row.id,
  label: row.label,
  value: row.value,
  suffix: row.suffix ?? null,
  description: row.description ?? null,
  icon: row.icon ?? null,
  sortOrder: row.sort_order ?? 0,
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toSiteSetting = (row: Row): SiteSetting => ({
  key: row.key,
  value: row.value,
  valueType: row.value_type,
  groupName: row.group_name,
  label: row.label,
  description: row.description ?? null,
  isPublic: row.is_public ?? true,
  sortOrder: row.sort_order ?? 0,
  updatedBy: row.updated_by ?? null,
  updatedAt: row.updated_at,
});

export const toContactInquiry = (row: Row): ContactInquiry => ({
  id: row.id,
  reference: row.reference,
  fullName: row.full_name,
  email: row.email,
  phone: row.phone ?? null,
  company: row.company ?? null,
  subject: row.subject ?? null,
  message: row.message,
  practiceAreaId: row.practice_area_id ?? null,
  status: row.status,
  internalNote: row.internal_note ?? null,
  respondedAt: row.responded_at ?? null,
  respondedBy: row.responded_by ?? null,
  source: row.source ?? 'website',
  ipAddress: row.ip_address ?? null,
  userAgent: row.user_agent ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toSubscriber = (row: Row): NewsletterSubscriber => ({
  id: row.id,
  email: row.email,
  fullName: row.full_name ?? null,
  status: row.status,
  unsubscribeToken: row.unsubscribe_token,
  confirmedAt: row.confirmed_at ?? null,
  unsubscribedAt: row.unsubscribed_at ?? null,
  bounceCount: row.bounce_count ?? 0,
  source: row.source ?? 'website',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toCampaign = (row: Row): NewsletterCampaign => ({
  id: row.id,
  subject: row.subject,
  preheader: row.preheader ?? null,
  body: row.body ?? null,
  publicationId: row.publication_id ?? null,
  status: row.status,
  scheduledFor: row.scheduled_for ?? null,
  sentAt: row.sent_at ?? null,
  recipientCount: row.recipient_count ?? 0,
  deliveredCount: row.delivered_count ?? 0,
  failedCount: row.failed_count ?? 0,
  errorMessage: row.error_message ?? null,
  createdBy: row.created_by ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toAuditLog = (row: Row): AuditLog => ({
  id: row.id,
  adminUserId: row.admin_user_id ?? null,
  actorEmail: row.actor_email ?? null,
  action: row.action,
  entity: row.entity,
  entityId: row.entity_id ?? null,
  beforeState: row.before_state ?? null,
  afterState: row.after_state ?? null,
  ipAddress: row.ip_address ?? null,
  userAgent: row.user_agent ?? null,
  createdAt: row.created_at,
});

export const toEmailLog = (row: Row): EmailLog => ({
  id: row.id,
  toEmail: row.to_email,
  ccEmails: row.cc_emails ?? null,
  template: row.template,
  subject: row.subject,
  status: row.status,
  providerMessageId: row.provider_message_id ?? null,
  errorMessage: row.error_message ?? null,
  metadata: row.metadata ?? {},
  sentAt: row.sent_at ?? null,
  createdAt: row.created_at,
});

export const toDashboardStats = (row: Row): DashboardStats => ({
  publicationsTotal: Number(row.publications_total ?? 0),
  publicationsPublished: Number(row.publications_published ?? 0),
  publicationsDraft: Number(row.publications_draft ?? 0),
  publicationsScheduled: Number(row.publications_scheduled ?? 0),
  publicationsViews: Number(row.publications_views ?? 0),
  inquiriesNew: Number(row.inquiries_new ?? 0),
  inquiriesTotal: Number(row.inquiries_total ?? 0),
  subscribersActive: Number(row.subscribers_active ?? 0),
  teamActive: Number(row.team_active ?? 0),
  practiceAreasActive: Number(row.practice_areas_active ?? 0),
  industriesActive: Number(row.industries_active ?? 0),
  testimonialsPublished: Number(row.testimonials_published ?? 0),
  mediaTotal: Number(row.media_total ?? 0),
});

/**
 * camelCase → snake_case for write payloads, skipping `undefined` so a PATCH
 * only touches the fields the caller actually sent.
 */
export function toColumns(
  input: Record<string, unknown>,
  mapping: Record<string, string>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const column = mapping[key];
    if (column) row[column] = value;
  }

  return row;
}
