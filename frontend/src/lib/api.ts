import type { ApiFailure, ApiSuccess, PaginationMeta } from './types';

/**
 * The API client.
 *
 * One place that knows the base URL, the response envelope and how an error
 * becomes an exception. Both the public site and the dashboard go through it,
 * so there is exactly one unwrapper to maintain rather than one per call site.
 */

/** Where the backend actually lives, e.g. https://neoteric-api.vercel.app/api/v1 */
const BACKEND_API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'
).replace(/\/$/, '');

/**
 * Server-side code calls the backend directly. The browser calls this site's
 * own `/api/v1/...` path instead, which next.config.mjs proxies to the
 * backend.
 *
 * The proxy is what keeps the admin session working when the frontend and
 * backend are deployed on different domains (two Vercel projects): the
 * refresh token is an httpOnly SameSite=strict cookie, and a browser only
 * sends that to the site that set it. Going through the same origin makes it
 * a first-party cookie, and it also removes the need for CORS in the browser.
 */
export const API_BASE =
  typeof window === 'undefined'
    ? BACKEND_API_URL
    : `${window.location.origin}${new URL(BACKEND_API_URL).pathname.replace(/\/$/, '')}`;

/** A failed request, carrying the backend's stable error code. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly issues?: { field: string; message: string }[],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field errors keyed by field, for attaching to form inputs. */
  get fieldErrors(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const issue of this.issues ?? []) map[issue.field] = issue.message;
    return map;
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Bearer token. The dashboard passes one; the public site does not. */
  token?: string | null;
  /** Query parameters. Undefined and empty values are dropped. */
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Next.js cache behaviour. Defaults to a short revalidate for public reads. */
  revalidate?: number | false;
  tags?: string[];
}

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const url = new URL(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

/**
 * Performs a request and unwraps the envelope.
 *
 * Returns `data` directly on success and throws `ApiError` otherwise, so call
 * sites read as though they were calling a function rather than inspecting a
 * response.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta?: PaginationMeta; message?: string }> {
  const { body, token, params, revalidate, tags, headers, ...rest } = options;

  const isFormData = body instanceof FormData;

  const response = await fetch(buildUrl(path, params), {
    ...rest,
    headers: {
      // FormData sets its own multipart boundary; setting Content-Type by
      // hand here would produce a boundary-less header and a 400 from multer.
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    ...(revalidate !== undefined || tags
      ? { next: { ...(revalidate !== undefined ? { revalidate: revalidate === false ? 0 : revalidate } : {}), ...(tags ? { tags } : {}) } }
      : {}),
  });

  // 204 has no body to parse.
  if (response.status === 204) {
    return { data: undefined as T };
  }

  let payload: ApiSuccess<T> | ApiFailure;

  try {
    payload = await response.json();
  } catch {
    // A non-JSON response means something upstream failed before the API —
    // a proxy error page, a gateway timeout. Say so rather than "undefined".
    throw new ApiError(
      response.ok
        ? 'The server returned an unreadable response'
        : `The server is not responding correctly (${response.status})`,
      response.status,
      'INVALID_RESPONSE',
    );
  }

  if (!response.ok || payload.success === false) {
    const failure = payload as ApiFailure;
    throw new ApiError(
      failure.error?.message ?? 'Something went wrong',
      response.status,
      failure.error?.code ?? 'UNKNOWN',
      failure.error?.issues,
      failure.requestId,
    );
  }

  const success = payload as ApiSuccess<T>;
  return { data: success.data, meta: success.meta, message: success.message };
}

/** Convenience wrapper for the common case of wanting only the data. */
export async function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  const { data } = await apiRequest<T>(path, { ...options, method: 'GET' });
  return data;
}

export async function apiGetList<T>(
  path: string,
  options?: RequestOptions,
): Promise<{ items: T[]; meta: PaginationMeta }> {
  const { data, meta } = await apiRequest<T[]>(path, { ...options, method: 'GET' });
  return {
    items: data ?? [],
    meta: meta ?? {
      page: 1,
      limit: data?.length ?? 0,
      total: data?.length ?? 0,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  };
}

export const apiPost = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  apiRequest<T>(path, { ...options, method: 'POST', body });

export const apiPatch = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  apiRequest<T>(path, { ...options, method: 'PATCH', body });

export const apiPut = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  apiRequest<T>(path, { ...options, method: 'PUT', body });

export const apiDelete = <T>(path: string, options?: RequestOptions) =>
  apiRequest<T>(path, { ...options, method: 'DELETE' });

/**
 * Fetches, but returns a fallback instead of throwing.
 *
 * For server components rendering the public site: if the API is briefly
 * unavailable the page should degrade to an empty section, not a 500 for a
 * visitor who only wanted to read about the firm.
 */
export async function apiGetSafe<T>(
  path: string,
  fallback: T,
  options?: RequestOptions,
): Promise<T> {
  try {
    return await apiGet<T>(path, options);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`[api] ${path} failed, using fallback:`, (error as Error).message);
    }
    return fallback;
  }
}
