/**
 * Domain entities.
 *
 * These describe the shape of the business objects and deliberately know
 * nothing about Postgres, Express or Supabase. Database rows are mapped onto
 * them in the infrastructure layer, which is also where snake_case becomes
 * camelCase — nothing above that boundary sees a database column name.
 */

import type {
  AdminRole,
  CampaignStatus,
  EmailStatus,
  InquiryStatus,
  ISODateString,
  PublicationStatus,
  SubscriberStatus,
  TeamGroup,
  UUID,
} from '@shared/types/common';

// ── Identity ────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: UUID;
  email: string;
  fullName: string;
  role: AdminRole;
  avatarUrl: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: ISODateString | null;
  lastLoginIp: string | null;
  failedLoginAttempts: number;
  lockedUntil: ISODateString | null;
  passwordChangedAt: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Only ever used inside the auth service; never serialised to a client. */
export interface AdminUserWithSecret extends AdminUser {
  passwordHash: string;
}

// ── Media ───────────────────────────────────────────────────────────────────

export interface MediaAsset {
  id: UUID;
  bucket: string;
  storagePath: string;
  publicUrl: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
  folder: string;
  checksum: string | null;
  uploadedBy: UUID | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ── Publications ────────────────────────────────────────────────────────────

export interface PublicationCategory {
  id: UUID;
  name: string;
  slug: string;
  description: string | null;
  colour: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Publication {
  id: UUID;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  categoryId: UUID | null;
  category?: Pick<PublicationCategory, 'id' | 'name' | 'slug' | 'colour'> | null;

  /** Thumbnail shown on the News & Publications index. */
  coverImageId: UUID | null;
  coverImageUrl: string | null;
  coverAlt: string | null;

  /** Legacy Google Drive link carried over from v1. */
  sourceUrl: string | null;

  status: PublicationStatus;
  isFeatured: boolean;
  authorName: string;
  tags: string[];

  readingMinutes: number;
  viewCount: number;

  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;

  publishedAt: ISODateString | null;
  scheduledFor: ISODateString | null;

  createdBy: UUID | null;
  updatedBy: UUID | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;

  attachments?: PublicationAttachment[];
}

export interface PublicationAttachment {
  id: UUID;
  publicationId: UUID;
  mediaId: UUID;
  label: string | null;
  sortOrder: number;
  media?: MediaAsset;
  createdAt: ISODateString;
}

// ── Firm content ────────────────────────────────────────────────────────────

export interface PracticeArea {
  id: UUID;
  name: string;
  slug: string;
  summary: string | null;
  description: string | null;
  imageId: UUID | null;
  imageUrl: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Industry {
  id: UUID;
  name: string;
  slug: string;
  description: string | null;
  imageId: UUID | null;
  imageUrl: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface TeamMember {
  id: UUID;
  fullName: string;
  slug: string;
  roleTitle: string;
  teamGroup: TeamGroup;
  bio: string | null;
  qualifications: string[];
  imageId: UUID | null;
  imageUrl: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Testimonial {
  id: UUID;
  quote: string;
  authorName: string;
  authorRole: string | null;
  authorCompany: string | null;
  authorImageId: UUID | null;
  authorImageUrl: string | null;
  rating: number | null;
  isPublished: boolean;
  sortOrder: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Achievement {
  id: UUID;
  label: string;
  value: string;
  suffix: string | null;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface SiteSetting {
  key: string;
  value: unknown;
  valueType: 'string' | 'text' | 'number' | 'boolean' | 'json' | 'image' | 'url' | 'email';
  groupName: string;
  label: string;
  description: string | null;
  isPublic: boolean;
  sortOrder: number;
  updatedBy: UUID | null;
  updatedAt: ISODateString;
}

// ── Engagement ──────────────────────────────────────────────────────────────

export interface ContactInquiry {
  id: UUID;
  reference: string;
  fullName: string;
  email: string;
  phone: string | null;
  company: string | null;
  subject: string | null;
  message: string;
  practiceAreaId: UUID | null;
  status: InquiryStatus;
  internalNote: string | null;
  respondedAt: ISODateString | null;
  respondedBy: UUID | null;
  source: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface NewsletterSubscriber {
  id: UUID;
  email: string;
  fullName: string | null;
  status: SubscriberStatus;
  unsubscribeToken: string;
  confirmedAt: ISODateString | null;
  unsubscribedAt: ISODateString | null;
  bounceCount: number;
  source: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface NewsletterCampaign {
  id: UUID;
  subject: string;
  preheader: string | null;
  body: string | null;
  publicationId: UUID | null;
  status: CampaignStatus;
  scheduledFor: ISODateString | null;
  sentAt: ISODateString | null;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  errorMessage: string | null;
  createdBy: UUID | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ── Observability ───────────────────────────────────────────────────────────

export interface AuditLog {
  id: UUID;
  adminUserId: UUID | null;
  actorEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  beforeState: unknown;
  afterState: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: ISODateString;
}

export interface EmailLog {
  id: UUID;
  toEmail: string;
  ccEmails: string[] | null;
  template: string;
  subject: string;
  status: EmailStatus;
  providerMessageId: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  sentAt: ISODateString | null;
  createdAt: ISODateString;
}

export interface DashboardStats {
  publicationsTotal: number;
  publicationsPublished: number;
  publicationsDraft: number;
  publicationsScheduled: number;
  publicationsViews: number;
  inquiriesNew: number;
  inquiriesTotal: number;
  subscribersActive: number;
  teamActive: number;
  practiceAreasActive: number;
  industriesActive: number;
  testimonialsPublished: number;
  mediaTotal: number;
}
