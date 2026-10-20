/**
 * API types.
 *
 * Mirrors the entities the backend serialises. Kept hand-written rather than
 * generated so the frontend can use narrower, more honest types than the
 * server's — `Publication.body` being nullable is load-bearing here, and a
 * generator would bury that in a sea of optional fields.
 */

export type PublicationStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type TeamGroup = 'legal' | 'non_legal';
export type AdminRole = 'super_admin' | 'admin' | 'editor';
export type InquiryStatus = 'new' | 'in_review' | 'responded' | 'closed' | 'spam';
export type SubscriberStatus = 'pending' | 'subscribed' | 'unsubscribed' | 'bounced';
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ApiSuccess<T> {
  success: true;
  message?: string;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    issues?: { field: string; message: string }[];
  };
  requestId?: string;
}

export interface PublicationCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  colour: string | null;
  sortOrder: number;
  isActive: boolean;
  publicationCount?: number;
}

export interface MediaAsset {
  id: string;
  publicUrl: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
  folder: string;
  createdAt: string;
}

export interface PublicationAttachment {
  id: string;
  publicationId: string;
  mediaId: string;
  label: string | null;
  sortOrder: number;
  media?: MediaAsset;
}

export interface Publication {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  /**
   * Null for a piece carried over from v1 that has not been imported yet.
   * The article page reads this first, then falls back to an attached PDF —
   * never to an off-site link.
   */
  body: string | null;
  categoryId: string | null;
  category?: Pick<PublicationCategory, 'id' | 'name' | 'slug' | 'colour'> | null;
  coverImageId: string | null;
  /** The thumbnail shown on the News & Publications index. */
  coverImageUrl: string | null;
  coverAlt: string | null;
  /** Provenance — where the piece originally came from. Not a destination. */
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
  publishedAt: string | null;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
  attachments?: PublicationAttachment[];
}

export interface PublicationDetail {
  publication: Publication;
  related: Publication[];
  navigation: {
    previous: Publication | null;
    next: Publication | null;
  };
}

export interface PracticeArea {
  id: string;
  name: string;
  slug: string;
  summary: string | null;
  description: string | null;
  imageUrl: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Industry {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface TeamMember {
  id: string;
  fullName: string;
  slug: string;
  roleTitle: string;
  teamGroup: TeamGroup;
  bio: string | null;
  qualifications: string[];
  imageUrl: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Testimonial {
  id: string;
  quote: string;
  authorName: string;
  authorRole: string | null;
  authorCompany: string | null;
  authorImageUrl: string | null;
  rating: number | null;
  isPublished: boolean;
  sortOrder: number;
}

export interface Achievement {
  id: string;
  label: string;
  value: string;
  suffix: string | null;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** Site settings, nested by group — `settings.contact.phone`. */
export interface SiteSettings {
  site?: Record<string, string>;
  hero?: Record<string, string>;
  about?: Record<string, string>;
  vision?: Record<string, string>;
  mission?: Record<string, string>;
  contact?: Record<string, string>;
  social?: Record<string, string | null>;
  seo?: Record<string, unknown>;
  [group: string]: Record<string, unknown> | undefined;
}

export interface HomepagePayload {
  settings: SiteSettings;
  practiceAreas: PracticeArea[];
  industries: Industry[];
  team: TeamMember[];
  testimonials: Testimonial[];
  achievements: Achievement[];
  publications: Publication[];
}

export interface ContactInquiry {
  id: string;
  reference: string;
  fullName: string;
  email: string;
  phone: string | null;
  company: string | null;
  subject: string | null;
  message: string;
  status: InquiryStatus;
  internalNote: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  fullName: string | null;
  status: SubscriberStatus;
  confirmedAt: string | null;
  source: string;
  createdAt: string;
}

export interface NewsletterCampaign {
  id: string;
  subject: string;
  preheader: string | null;
  body: string | null;
  publicationId: string | null;
  status: CampaignStatus;
  sentAt: string | null;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  avatarUrl: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
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
  inquiriesByStatus: Record<InquiryStatus, number>;
}

export interface AuditLog {
  id: string;
  adminUserId: string | null;
  actorEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  beforeState: unknown;
  afterState: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface LoginResponse {
  user: AdminUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  mustChangePassword: boolean;
}
