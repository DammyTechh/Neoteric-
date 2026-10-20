import type { PaginationParams, SortDirection } from '@shared/types/common';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface PaginationInput {
  page?: number | string;
  limit?: number | string;
  sortBy?: string;
  sortDirection?: string;
}

export interface PaginationOptions {
  /** Columns a client is allowed to sort by. Anything else falls back. */
  allowedSortFields: readonly string[];
  defaultSortBy: string;
  defaultSortDirection?: SortDirection;
  defaultLimit?: number;
}

/**
 * Turns untrusted query-string values into a safe pagination descriptor.
 *
 * `sortBy` is checked against an allow-list rather than escaped, because it is
 * interpolated into an ORDER BY clause where escaping is not enough.
 */
export function parsePagination(
  input: PaginationInput,
  options: PaginationOptions,
): PaginationParams {
  const requestedPage = Number(input.page);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

  const requestedLimit = Number(input.limit);
  const fallbackLimit = options.defaultLimit ?? DEFAULT_LIMIT;
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), MAX_LIMIT)
      : fallbackLimit;

  const sortBy =
    input.sortBy && options.allowedSortFields.includes(input.sortBy)
      ? input.sortBy
      : options.defaultSortBy;

  const sortDirection: SortDirection =
    input.sortDirection === 'asc' || input.sortDirection === 'desc'
      ? input.sortDirection
      : (options.defaultSortDirection ?? 'desc');

  return { page, limit, offset: (page - 1) * limit, sortBy, sortDirection };
}

