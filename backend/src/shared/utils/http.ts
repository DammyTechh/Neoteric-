import type { Response } from 'express';
import type { ApiSuccess, PaginationMeta } from '@shared/types/common';

/**
 * Response helpers, so every endpoint speaks the same envelope and a client
 * only ever has to write one unwrapper.
 */

export function ok<T>(res: Response, data: T, message?: string): Response {
  const body: ApiSuccess<T> = { success: true, data, ...(message ? { message } : {}) };
  return res.status(200).json(body);
}

export function created<T>(res: Response, data: T, message = 'Created successfully'): Response {
  const body: ApiSuccess<T> = { success: true, message, data };
  return res.status(201).json(body);
}

export function paginated<T>(
  res: Response,
  items: T[],
  meta: PaginationMeta,
  message?: string,
): Response {
  const body: ApiSuccess<T[]> = {
    success: true,
    data: items,
    meta,
    ...(message ? { message } : {}),
  };
  return res.status(200).json(body);
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

/** Best-effort client IP, honouring a trusted proxy header. */
export function clientIp(req: { ip?: string; headers: Record<string, unknown> }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]!.trim();
  }
  return req.ip ?? 'unknown';
}
