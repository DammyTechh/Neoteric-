/** Cross-cutting types shared by every layer. */

export type UUID = string;
export type ISODateString = string;

/** Sort direction used by every list endpoint. */
export type SortDirection = 'asc' | 'desc';

/** Normalised pagination input, produced by `parsePagination`. */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
  sortBy: string;
  sortDirection: SortDirection;
}

/** What every list endpoint returns alongside its rows. */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

/** The success envelope every endpoint responds with. */
export interface ApiSuccess<T> {
  success: true;
  message?: string;
  data: T;
  meta?: PaginationMeta;
}

/** The failure envelope every endpoint responds with. */
export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    issues?: { field: string; message: string }[];
  };
  requestId?: string;
}

/** The authenticated operator, attached to `req.user` by the auth guard. */
export interface AuthenticatedActor {
  id: UUID;
  email: string;
  fullName: string;
  role: AdminRole;
}

export type AdminRole = 'super_admin' | 'admin' | 'editor';

export type PublicationStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type TeamGroup = 'legal' | 'non_legal';
export type InquiryStatus = 'new' | 'in_review' | 'responded' | 'closed' | 'spam';
export type SubscriberStatus = 'pending' | 'subscribed' | 'unsubscribed' | 'bounced';
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
export type EmailStatus = 'queued' | 'sent' | 'failed' | 'skipped';

/** Request context threaded into services so they can write a useful audit row. */
export interface RequestContext {
  actor?: AuthenticatedActor;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}
