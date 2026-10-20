import type { Request, RequestHandler, Response } from 'express';
import type { CrudService } from '@application/services/crud.service';
import { asyncHandler, parsedQuery } from '@presentation/http/middleware';
import { created, noContent, ok, paginated } from '@shared/utils/http';
import { parsePagination } from '@shared/utils/pagination';
import type { UUID } from '@shared/types/common';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CrudControllerOptions<TFilters> {
  /** Columns a client may sort by. Checked against an allow-list. */
  allowedSortFields: readonly string[];
  defaultSortBy: string;
  defaultSortDirection?: 'asc' | 'desc';
  /** Turns the validated query string into repository filters. */
  buildFilters?: (query: any) => TFilters;
  /** Noun used in the success messages. */
  resourceLabel: string;
}

/**
 * Builds the seven standard handlers for a content collection.
 *
 * The six simple collections differ only in their service and their filters,
 * so the routing layer stays a description of the API rather than six
 * near-identical copies of the same paging and envelope code.
 */
export function createCrudController<T extends { id: UUID }, TFilters = Record<string, unknown>>(
  service: CrudService<T, TFilters>,
  options: CrudControllerOptions<TFilters>,
): {
  list: RequestHandler;
  getOne: RequestHandler;
  getBySlug: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
  reorder: RequestHandler;
} {
  const paginate = (query: any) =>
    parsePagination(query, {
      allowedSortFields: options.allowedSortFields,
      defaultSortBy: options.defaultSortBy,
      defaultSortDirection: options.defaultSortDirection ?? 'desc',
    });

  return {
    list: asyncHandler(async (req: Request, res: Response) => {
      const query = parsedQuery<any>(req);
      const result = await service.list(
        paginate(query),
        options.buildFilters ? options.buildFilters(query) : (query as TFilters),
      );
      return paginated(res, result.items, result.meta);
    }),

    getOne: asyncHandler(async (req: Request, res: Response) => {
      return ok(res, await service.getById(req.params.id as UUID));
    }),

    getBySlug: asyncHandler(async (req: Request, res: Response) => {
      return ok(res, await service.getBySlug(req.params.slug as string));
    }),

    create: asyncHandler(async (req: Request, res: Response) => {
      const record = await service.create(req.body, req.context);
      return created(res, record, `${options.resourceLabel} created`);
    }),

    update: asyncHandler(async (req: Request, res: Response) => {
      const record = await service.update(req.params.id as UUID, req.body, req.context);
      return ok(res, record, `${options.resourceLabel} updated`);
    }),

    remove: asyncHandler(async (req: Request, res: Response) => {
      await service.remove(req.params.id as UUID, req.context);
      return noContent(res);
    }),

    reorder: asyncHandler(async (req: Request, res: Response) => {
      await service.reorder(req.body.order, req.context);
      return ok(res, { reordered: req.body.order.length }, 'Order saved');
    }),
  };
}
