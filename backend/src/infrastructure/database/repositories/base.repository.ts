import { supabase, translateDatabaseError, unwrapMaybe } from '@infrastructure/database/supabase.client';
import { toColumns } from '@infrastructure/database/mappers';
import { AppError } from '@shared/errors/AppError';
import type { Paginated, PaginationParams, UUID } from '@shared/types/common';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The PostgREST query builder.
 *
 * Typed loosely on purpose: `@supabase/postgrest-js` is a transitive
 * dependency whose generic signature shifts between minor releases, and
 * pinning to it here would make every repository brittle. The narrow,
 * well-typed surface is the repository interface in `domain/`.
 */
export type QueryBuilder = any;

export interface BaseRepositoryConfig<T> {
  /** Table name in the `public` schema. */
  table: string;
  /** Human-readable name used in error messages. */
  resource: string;
  /** Row → entity. */
  mapper: (row: any) => T;
  /** Entity field → column, used to build write payloads. */
  columnMap: Record<string, string>;
  /** Columns selected by default; override to pull in a join. */
  selectColumns?: string;
  /** Column holding the display order, when the collection is sortable. */
  sortColumn?: string;
}

/**
 * Shared CRUD against a Supabase table.
 *
 * Most content collections differ only in their table name and column map, so
 * they extend this and add only what is genuinely specific to them. The
 * alternative — thirteen near-identical repositories — is where bugs breed.
 */
export abstract class BaseRepository<T, TFilters = Record<string, unknown>> {
  protected readonly table: string;
  protected readonly resource: string;
  protected readonly mapper: (row: any) => T;
  protected readonly columnMap: Record<string, string>;
  protected readonly selectColumns: string;
  protected readonly sortColumn: string | undefined;

  constructor(config: BaseRepositoryConfig<T>) {
    this.table = config.table;
    this.resource = config.resource;
    this.mapper = config.mapper;
    this.columnMap = config.columnMap;
    this.selectColumns = config.selectColumns ?? '*';
    this.sortColumn = config.sortColumn;
  }

  /** Subclasses translate their filter object into `where` clauses here. */
  protected applyFilters(
    query: QueryBuilder,
    _filters?: TFilters,
  ): QueryBuilder {
    return query;
  }

  async findMany(params: PaginationParams, filters?: TFilters): Promise<Paginated<T>> {
    const { limit, offset, sortBy, sortDirection, page } = params;

    let query = supabase
      .from(this.table)
      .select(this.selectColumns, { count: 'exact' }) as unknown as QueryBuilder;

    query = this.applyFilters(query, filters);

    const { data, error, count } = await query
      .order(sortBy, { ascending: sortDirection === 'asc', nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) throw translateDatabaseError(error, `list ${this.resource}`);

    const total = count ?? 0;
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    return {
      items: (data ?? []).map(this.mapper),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  async findById(id: UUID): Promise<T | null> {
    const result = await supabase
      .from(this.table)
      .select(this.selectColumns)
      .eq('id', id)
      .maybeSingle();

    const row = unwrapMaybe(result as any, `find ${this.resource}`);
    return row ? this.mapper(row) : null;
  }

  /** As `findById` but throws a 404 — saves a null-check in every service. */
  async findByIdOrFail(id: UUID): Promise<T> {
    const found = await this.findById(id);
    if (!found) throw AppError.notFound(this.resource);
    return found;
  }

  async create(data: Record<string, unknown>): Promise<T> {
    const payload = toColumns(data, this.columnMap);

    const result = await supabase
      .from(this.table)
      .insert(payload)
      .select(this.selectColumns)
      .single();

    if (result.error) throw translateDatabaseError(result.error, `create ${this.resource}`);
    return this.mapper(result.data);
  }

  async update(id: UUID, data: Record<string, unknown>): Promise<T> {
    const payload = toColumns(data, this.columnMap);

    // An empty payload would produce an UPDATE with no SET clause.
    if (Object.keys(payload).length === 0) return this.findByIdOrFail(id);

    const result = await supabase
      .from(this.table)
      .update(payload)
      .eq('id', id)
      .select(this.selectColumns)
      .maybeSingle();

    if (result.error) throw translateDatabaseError(result.error, `update ${this.resource}`);
    if (!result.data) throw AppError.notFound(this.resource);

    return this.mapper(result.data);
  }

  async delete(id: UUID): Promise<void> {
    const { error, count } = await supabase
      .from(this.table)
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) throw translateDatabaseError(error, `delete ${this.resource}`);
    if (count === 0) throw AppError.notFound(this.resource);
  }

  async exists(id: UUID): Promise<boolean> {
    const { count, error } = await supabase
      .from(this.table)
      .select('id', { count: 'exact', head: true })
      .eq('id', id);

    if (error) throw translateDatabaseError(error, `check ${this.resource}`);
    return (count ?? 0) > 0;
  }

  async count(filters?: TFilters): Promise<number> {
    let query = supabase
      .from(this.table)
      .select('id', { count: 'exact', head: true }) as unknown as QueryBuilder;

    query = this.applyFilters(query, filters);

    const { count, error } = await query;
    if (error) throw translateDatabaseError(error, `count ${this.resource}`);
    return count ?? 0;
  }

  // ── Slug helpers (used by the slugged repositories) ───────────────────────

  async findBySlug(slug: string): Promise<T | null> {
    const result = await supabase
      .from(this.table)
      .select(this.selectColumns)
      .eq('slug', slug)
      .maybeSingle();

    const row = unwrapMaybe(result as any, `find ${this.resource} by slug`);
    return row ? this.mapper(row) : null;
  }

  async slugExists(slug: string, excludeId?: UUID): Promise<boolean> {
    let query = supabase
      .from(this.table)
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug);

    if (excludeId) query = query.neq('id', excludeId);

    const { count, error } = await query;
    if (error) throw translateDatabaseError(error, `check ${this.resource} slug`);
    return (count ?? 0) > 0;
  }

  // ── Ordering ──────────────────────────────────────────────────────────────

  /**
   * Persists a new display order.
   *
   * Supabase has no multi-statement transaction over PostgREST, so this issues
   * one update per row. The lists involved are short (a dozen practice areas,
   * not a million), and a partial failure only leaves the order inconsistent,
   * never the data.
   */
  async reorder(order: { id: UUID; sortOrder: number }[]): Promise<void> {
    const column = this.sortColumn ?? 'sort_order';

    const results = await Promise.allSettled(
      order.map(({ id, sortOrder }) =>
        supabase.from(this.table).update({ [column]: sortOrder }).eq('id', id),
      ),
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      throw AppError.database(`Could not reorder ${this.resource}`, failed);
    }
  }

  /** Next free sort position, so a newly created row lands at the end. */
  async nextSortOrder(): Promise<number> {
    const column = this.sortColumn ?? 'sort_order';

    const { data, error } = await supabase
      .from(this.table)
      .select(column)
      .order(column, { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw translateDatabaseError(error, `next sort order for ${this.resource}`);
    const current = data ? Number((data as any)[column] ?? 0) : 0;
    return current + 1;
  }

  /** Case-insensitive `ILIKE %term%` across the given columns. */
  protected searchAcross(
    query: QueryBuilder,
    term: string,
    columns: string[],
  ): QueryBuilder {
    // PostgREST `or` syntax: col.ilike.*term*,col2.ilike.*term*
    // Commas and parentheses inside the term would break the expression.
    const safe = term.replace(/[,()*]/g, ' ').trim();
    if (!safe) return query;

    return query.or(columns.map((column) => `${column}.ilike.*${safe}*`).join(','));
  }
}
