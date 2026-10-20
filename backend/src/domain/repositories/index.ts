/**
 * Repository contracts.
 *
 * The application layer depends on these interfaces, never on Supabase. That
 * is the whole point of the arrangement: swapping Supabase for `pg`, Prisma or
 * an in-memory fake for tests means writing a new implementation here and
 * changing one line in the composition root.
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
import type {
  InquiryStatus,
  Paginated,
  PaginationParams,
  PublicationStatus,
  SubscriberStatus,
  TeamGroup,
  UUID,
} from '@shared/types/common';

/**
 * A write payload.
 *
 * Deliberately loose rather than `Partial<T>`: services build payloads that
 * mix caller input with derived fields (a generated slug, a computed excerpt,
 * the acting user's id), so a strict entity-shaped type would be a lie that
 * every call site then has to cast its way around.
 */
export type WritePayload = Record<string, unknown>;

/**
 * The CRUD surface shared by every content collection. Specialised
 * repositories extend it with whatever else they need.
 */
export interface ICrudRepository<T, TFilters = Record<string, unknown>> {
  findMany(params: PaginationParams, filters?: TFilters): Promise<Paginated<T>>;
  findById(id: UUID): Promise<T | null>;
  findByIdOrFail(id: UUID): Promise<T>;
  create(data: WritePayload): Promise<T>;
  update(id: UUID, data: WritePayload): Promise<T>;
  delete(id: UUID): Promise<void>;
  exists(id: UUID): Promise<boolean>;
  count(filters?: TFilters): Promise<number>;
}

/** Collections ordered by a drag-and-drop list in the dashboard. */
export interface ISortableRepository {
  reorder(order: { id: UUID; sortOrder: number }[]): Promise<void>;
  nextSortOrder(): Promise<number>;
}

export interface ISluggedRepository<T> {
  findBySlug(slug: string): Promise<T | null>;
  slugExists(slug: string, excludeId?: UUID): Promise<boolean>;
}

/**
 * What the generic `CrudService` needs from a store.
 *
 * Declaring it here, in the domain, is what lets that service depend on an
 * interface rather than on `BaseRepository` — otherwise the application layer
 * would be importing a Supabase class, and the layering would be a comment
 * rather than a constraint.
 */
export interface IContentRepository<T, TFilters = Record<string, unknown>>
  extends ICrudRepository<T, TFilters>,
    ISluggedRepository<T>,
    ISortableRepository {}

// ── Identity ────────────────────────────────────────────────────────────────

export interface IAdminUserRepository extends ICrudRepository<AdminUser> {
  findByEmail(email: string): Promise<AdminUserWithSecret | null>;
  findByIdWithSecret(id: UUID): Promise<AdminUserWithSecret | null>;
  createWithPassword(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    role: AdminUser['role'];
    mustChangePassword?: boolean;
    createdBy?: UUID | null;
  }): Promise<AdminUser>;
  updatePassword(id: UUID, passwordHash: string): Promise<void>;
  recordSuccessfulLogin(id: UUID, ipAddress: string | null): Promise<void>;
  recordFailedLogin(id: UUID, lockUntil: Date | null): Promise<void>;
  countByRole(role: AdminUser['role']): Promise<number>;
}

export interface IRefreshTokenRepository {
  create(data: {
    adminUserId: UUID;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
  }): Promise<void>;
  findActiveByHash(tokenHash: string): Promise<{ id: UUID; adminUserId: UUID } | null>;
  revokeByHash(tokenHash: string): Promise<void>;
  revokeAllForUser(adminUserId: UUID): Promise<void>;
  deleteExpired(): Promise<number>;
}

export interface IPasswordResetRepository {
  create(data: {
    adminUserId: UUID;
    tokenHash: string;
    expiresAt: Date;
    requestedIp?: string | null;
  }): Promise<void>;
  findValidByHash(tokenHash: string): Promise<{ id: UUID; adminUserId: UUID } | null>;
  markUsed(id: UUID): Promise<void>;
  invalidateAllForUser(adminUserId: UUID): Promise<void>;
}

// ── Media ───────────────────────────────────────────────────────────────────

export interface MediaFilters {
  folder?: string;
  mimeGroup?: 'image' | 'document';
  search?: string;
}

export interface IMediaRepository extends IContentRepository<MediaAsset, MediaFilters> {
  findByChecksum(checksum: string): Promise<MediaAsset | null>;
  listFolders(): Promise<{ folder: string; count: number }[]>;
}

// ── Publications ────────────────────────────────────────────────────────────

export interface PublicationFilters {
  status?: PublicationStatus;
  categoryId?: UUID;
  categorySlug?: string;
  tag?: string;
  search?: string;
  isFeatured?: boolean;
  /** Public endpoints force this on, so drafts can never leak. */
  publishedOnly?: boolean;
}

export interface IPublicationRepository
  extends IContentRepository<Publication, PublicationFilters> {
  findBySlugPublic(slug: string): Promise<Publication | null>;
  incrementViewCount(id: UUID): Promise<void>;
  findRelated(id: UUID, categoryId: UUID | null, limit: number): Promise<Publication[]>;
  findAdjacent(publishedAt: string): Promise<{ previous: Publication | null; next: Publication | null }>;
  publishDueScheduled(): Promise<Publication[]>;
  listAllPublishedSlugs(): Promise<{ slug: string; updatedAt: string }[]>;
}

export interface IPublicationCategoryRepository
  extends IContentRepository<PublicationCategory, ActiveFilter> {
  withCounts(): Promise<(PublicationCategory & { publicationCount: number })[]>;
}

export interface IPublicationAttachmentRepository {
  listFor(publicationId: UUID): Promise<PublicationAttachment[]>;
  attach(data: { publicationId: UUID; mediaId: UUID; label?: string | null; sortOrder?: number }): Promise<PublicationAttachment>;
  detach(publicationId: UUID, mediaId: UUID): Promise<void>;
}

// ── Firm content ────────────────────────────────────────────────────────────

export interface ActiveFilter {
  isActive?: boolean;
  search?: string;
}

export type IPracticeAreaRepository = IContentRepository<PracticeArea, ActiveFilter>;

export type IIndustryRepository = IContentRepository<Industry, ActiveFilter>;

export interface TeamFilters extends ActiveFilter {
  teamGroup?: TeamGroup;
}

export type ITeamRepository = IContentRepository<TeamMember, TeamFilters>;

export interface TestimonialFilters {
  isPublished?: boolean;
  search?: string;
}

export type ITestimonialRepository = IContentRepository<Testimonial, TestimonialFilters>;

export type IAchievementRepository = IContentRepository<Achievement, ActiveFilter>;

export interface ISettingsRepository {
  all(includePrivate: boolean): Promise<SiteSetting[]>;
  byGroup(groupName: string, includePrivate: boolean): Promise<SiteSetting[]>;
  get(key: string): Promise<SiteSetting | null>;
  getValue<T = unknown>(key: string, fallback: T): Promise<T>;
  upsert(key: string, value: unknown, updatedBy?: UUID | null): Promise<SiteSetting>;
  upsertMany(entries: { key: string; value: unknown }[], updatedBy?: UUID | null): Promise<SiteSetting[]>;
}

// ── Engagement ──────────────────────────────────────────────────────────────

export interface InquiryFilters {
  status?: InquiryStatus;
  search?: string;
  from?: string;
  to?: string;
}

export interface IInquiryRepository extends IContentRepository<ContactInquiry, InquiryFilters> {
  nextReference(): Promise<string>;
  countByStatus(): Promise<Record<InquiryStatus, number>>;
}

export interface SubscriberFilters {
  status?: SubscriberStatus;
  search?: string;
}

export interface ISubscriberRepository
  extends IContentRepository<NewsletterSubscriber, SubscriberFilters> {
  findByEmail(email: string): Promise<NewsletterSubscriber | null>;
  findByConfirmTokenHash(tokenHash: string): Promise<NewsletterSubscriber | null>;
  findByUnsubscribeToken(token: string): Promise<NewsletterSubscriber | null>;
  upsertPending(data: {
    email: string;
    fullName?: string | null;
    confirmTokenHash: string;
    source?: string;
    ipAddress?: string | null;
  }): Promise<NewsletterSubscriber>;
  markConfirmed(id: UUID): Promise<NewsletterSubscriber>;
  markUnsubscribed(id: UUID): Promise<void>;
  listActiveEmails(): Promise<{ id: UUID; email: string; fullName: string | null; unsubscribeToken: string }[]>;
}

export interface ICampaignRepository extends IContentRepository<NewsletterCampaign> {
  markSending(id: UUID, recipientCount: number): Promise<void>;
  markSent(id: UUID, delivered: number, failed: number): Promise<void>;
  markFailed(id: UUID, error: string): Promise<void>;
}

// ── Observability ───────────────────────────────────────────────────────────

export interface AuditFilters {
  adminUserId?: UUID;
  entity?: string;
  action?: string;
  from?: string;
  to?: string;
}

export interface IAuditRepository {
  record(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void>;
  findMany(params: PaginationParams, filters?: AuditFilters): Promise<Paginated<AuditLog>>;
}

export interface IEmailLogRepository {
  record(entry: Omit<EmailLog, 'id' | 'createdAt'>): Promise<void>;
  findMany(params: PaginationParams, filters?: { status?: string; template?: string }): Promise<Paginated<EmailLog>>;
}

export interface IStatsRepository {
  dashboard(): Promise<DashboardStats>;
}
