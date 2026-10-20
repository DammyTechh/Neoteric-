import type { Request, Response } from 'express';
import { container } from '@infrastructure/container';
import { AppError } from '@shared/errors/AppError';
import { asyncHandler, parsedQuery } from '@presentation/http/middleware';
import { created, noContent, ok, paginated } from '@shared/utils/http';
import { parsePagination } from '@shared/utils/pagination';
import type { PublicationFilters } from '@domain/repositories';
import type { UUID } from '@shared/types/common';

/* eslint-disable @typescript-eslint/no-explicit-any */

const { publications, categories } = container.services;
const categoryRepository = container.repositories.categories;

const SORT_FIELDS = [
  'published_at',
  'created_at',
  'updated_at',
  'title',
  'view_count',
  'reading_minutes',
] as const;

const paginate = (query: any, defaultSortBy = 'published_at') =>
  parsePagination(query, {
    allowedSortFields: SORT_FIELDS,
    defaultSortBy,
    defaultSortDirection: 'desc',
  });

/** Resolves `?categorySlug=` to an id, since the public API speaks slugs. */
async function resolveCategoryId(query: any): Promise<UUID | undefined> {
  if (query.categoryId) return query.categoryId as UUID;
  if (!query.categorySlug) return undefined;

  const category = await categoryRepository.findBySlug(query.categorySlug);
  // A slug nobody has will match nothing, which is the honest answer.
  return category?.id ?? '00000000-0000-0000-0000-000000000000';
}

export const publicationController = {
  // ── Public ────────────────────────────────────────────────────────────────

  /** The News & Publications index. */
  listPublic: asyncHandler(async (req: Request, res: Response) => {
    const query = parsedQuery<any>(req);

    const filters: Omit<PublicationFilters, 'publishedOnly' | 'status'> = {
      categoryId: await resolveCategoryId(query),
      tag: query.tag,
      search: query.search,
      ...(query.isFeatured !== undefined ? { isFeatured: query.isFeatured } : {}),
    };

    const result = await publications.listPublic(paginate(query), filters);
    return paginated(res, result.items, result.meta);
  }),

  /** A single article, with its related reading and prev/next links. */
  getPublicBySlug: asyncHandler(async (req: Request, res: Response) => {
    const result = await publications.getPublicBySlug(req.params.slug as string);

    return ok(res, {
      publication: result.publication,
      related: result.related,
      navigation: { previous: result.previous, next: result.next },
    });
  }),

  /** Category list with article counts, for the index filter rail. */
  listCategoriesPublic: asyncHandler(async (_req: Request, res: Response) => {
    return ok(res, await categoryRepository.withCounts());
  }),

  /** Slugs and timestamps, for the frontend's sitemap. */
  sitemap: asyncHandler(async (_req: Request, res: Response) => {
    return ok(res, await publications.listPublishedSlugs());
  }),

  // ── Admin ─────────────────────────────────────────────────────────────────

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = parsedQuery<any>(req);

    const filters: PublicationFilters = {
      status: query.status,
      categoryId: await resolveCategoryId(query),
      tag: query.tag,
      search: query.search,
      ...(query.isFeatured !== undefined ? { isFeatured: query.isFeatured } : {}),
    };

    const result = await publications.list(paginate(query, 'created_at'), filters);
    return paginated(res, result.items, result.meta);
  }),

  getOne: asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await publications.getAdminById(req.params.id as UUID));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const publication = await publications.create(req.body, req.context);
    return created(res, publication, 'Publication created');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const publication = await publications.update(
      req.params.id as UUID,
      req.body,
      req.context,
    );
    return ok(res, publication, 'Publication updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await publications.remove(req.params.id as UUID, req.context);
    return noContent(res);
  }),

  publish: asyncHandler(async (req: Request, res: Response) => {
    const publication = await publications.publish(req.params.id as UUID, req.context);
    return ok(res, publication, 'Publication is now live');
  }),

  unpublish: asyncHandler(async (req: Request, res: Response) => {
    const publication = await publications.unpublish(req.params.id as UUID, req.context);
    return ok(res, publication, 'Publication moved back to draft');
  }),

  toggleFeatured: asyncHandler(async (req: Request, res: Response) => {
    const publication = await publications.toggleFeatured(req.params.id as UUID, req.context);
    return ok(
      res,
      publication,
      publication.isFeatured ? 'Added to featured' : 'Removed from featured',
    );
  }),

  /**
   * Upload a Word file or PDF and have it become the article's content.
   *
   * How the v1 back catalogue comes off Google Drive.
   */
  importDocument: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw AppError.badRequest('No document was included in the request');

    const result = await publications.importDocument(
      req.params.id as UUID,
      {
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
      },
      { replaceBody: req.body?.replaceBody === 'true' || req.body?.replaceBody === true },
      req.context,
    );

    return ok(
      res,
      {
        publication: result.publication,
        mode: result.mode,
        warnings: result.warnings,
      },
      result.mode === 'converted'
        ? 'Document imported. The text is now editable in the article body.'
        : 'PDF attached. It will be shown in a reader on the article page.',
    );
  }),

  addAttachment: asyncHandler(async (req: Request, res: Response) => {
    const attachment = await publications.addAttachment(req.params.id as UUID, req.body);
    return created(res, attachment, 'File attached');
  }),

  removeAttachment: asyncHandler(async (req: Request, res: Response) => {
    await publications.removeAttachment(
      req.params.id as UUID,
      req.params.mediaId as UUID,
    );
    return noContent(res);
  }),

  // ── Categories (admin) ────────────────────────────────────────────────────

  listCategories: asyncHandler(async (req: Request, res: Response) => {
    const query = parsedQuery<any>(req);
    const result = await categories.list(
      parsePagination(query, {
        allowedSortFields: ['sort_order', 'name', 'created_at'],
        defaultSortBy: 'sort_order',
        defaultSortDirection: 'asc',
      }),
      query,
    );
    return paginated(res, result.items, result.meta);
  }),

  createCategory: asyncHandler(async (req: Request, res: Response) => {
    return created(res, await categories.create(req.body, req.context), 'Category created');
  }),

  updateCategory: asyncHandler(async (req: Request, res: Response) => {
    const category = await categories.update(req.params.id as UUID, req.body, req.context);
    return ok(res, category, 'Category updated');
  }),

  removeCategory: asyncHandler(async (req: Request, res: Response) => {
    await categories.remove(req.params.id as UUID, req.context);
    return noContent(res);
  }),

  reorderCategories: asyncHandler(async (req: Request, res: Response) => {
    await categories.reorder(req.body.order, req.context);
    return ok(res, { reordered: req.body.order.length }, 'Order saved');
  }),
};
