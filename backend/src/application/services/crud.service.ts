import type { IAuditRepository, IContentRepository } from '@domain/repositories';
import { AppError } from '@shared/errors/AppError';
import { slugify, uniqueSlug } from '@shared/utils/slug';
import type { Paginated, PaginationParams, RequestContext, UUID } from '@shared/types/common';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CrudServiceOptions<T> {
  /** Used in error messages and audit rows, e.g. "Practice area". */
  resource: string;
  /** Entity name recorded in the audit log, e.g. "practice_area". */
  auditEntity: string;
  /** Field the slug is derived from, when the collection is slugged. */
  slugSource?: keyof T & string;
  /** New rows land at the end of the list. */
  autoSortOrder?: boolean;
}

/**
 * Generic CRUD with auditing, slug handling and ordering.
 *
 * Six of the content collections are structurally identical — a list the
 * admin creates, edits, reorders and toggles. Writing six copies of that
 * would be six places for a bug to hide, so the shared behaviour lives here
 * and the specific bits stay in the subclasses.
 */
export class CrudService<T extends { id: UUID }, TFilters = Record<string, unknown>> {
  constructor(
    protected readonly repository: IContentRepository<T, TFilters>,
    protected readonly audit: IAuditRepository,
    protected readonly options: CrudServiceOptions<T>,
  ) {}

  async list(params: PaginationParams, filters?: TFilters): Promise<Paginated<T>> {
    return this.repository.findMany(params, filters);
  }

  async getById(id: UUID): Promise<T> {
    const found = await this.repository.findById(id);
    if (!found) throw AppError.notFound(this.options.resource);
    return found;
  }

  async getBySlug(slug: string): Promise<T> {
    const found = await this.repository.findBySlug(slug);
    if (!found) throw AppError.notFound(this.options.resource);
    return found;
  }

  async create(data: Record<string, unknown>, context: RequestContext): Promise<T> {
    const payload = { ...data };

    if (this.options.slugSource) {
      payload.slug = await this.resolveSlug(payload, undefined);
    }

    if (this.options.autoSortOrder && payload.sortOrder === undefined) {
      payload.sortOrder = await this.repository.nextSortOrder();
    }

    const createdRow = await this.repository.create(payload);

    await this.audit.record({
      adminUserId: context.actor?.id ?? null,
      actorEmail: context.actor?.email ?? null,
      action: 'create',
      entity: this.options.auditEntity,
      entityId: createdRow.id,
      beforeState: null,
      afterState: createdRow,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });

    return createdRow;
  }

  async update(id: UUID, data: Record<string, unknown>, context: RequestContext): Promise<T> {
    const before = await this.getById(id);
    const payload = { ...data };

    /**
     * The slug is only recomputed when one was explicitly sent.
     *
     * Renaming an article must not silently change its URL — anything already
     * linking to it would break, and a law firm's publications get cited.
     * Changing the slug is therefore a deliberate act, not a side effect of
     * fixing a typo in the title.
     */
    if (this.options.slugSource) {
      if (payload.slug) {
        payload.slug = await this.resolveSlug(payload, id);
      } else {
        delete payload.slug;
      }
    }

    const after = await this.repository.update(id, payload);

    await this.audit.record({
      adminUserId: context.actor?.id ?? null,
      actorEmail: context.actor?.email ?? null,
      action: 'update',
      entity: this.options.auditEntity,
      entityId: id,
      beforeState: before,
      afterState: after,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });

    return after;
  }

  async remove(id: UUID, context: RequestContext): Promise<void> {
    const before = await this.getById(id);
    await this.repository.delete(id);

    await this.audit.record({
      adminUserId: context.actor?.id ?? null,
      actorEmail: context.actor?.email ?? null,
      action: 'delete',
      entity: this.options.auditEntity,
      entityId: id,
      beforeState: before,
      afterState: null,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });
  }

  async reorder(order: { id: UUID; sortOrder: number }[], context: RequestContext): Promise<void> {
    await this.repository.reorder(order);

    await this.audit.record({
      adminUserId: context.actor?.id ?? null,
      actorEmail: context.actor?.email ?? null,
      action: 'reorder',
      entity: this.options.auditEntity,
      entityId: null,
      beforeState: null,
      afterState: { order },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });
  }

  /** Builds a slug from the explicit value or the source field, then dedupes. */
  protected async resolveSlug(
    payload: Record<string, unknown>,
    excludeId: UUID | undefined,
  ): Promise<string> {
    const source = this.options.slugSource;
    const explicit = typeof payload.slug === 'string' ? payload.slug : undefined;
    const derived = source && typeof payload[source] === 'string' ? (payload[source] as string) : '';

    const base = slugify(explicit ?? derived);
    if (!base) throw AppError.unprocessable('Could not build a URL slug from that name');

    return uniqueSlug(base, (candidate) => this.repository.slugExists(candidate, excludeId));
  }
}
