import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { ZodError, type ZodSchema } from 'zod';
import { container } from '@infrastructure/container';
import { env, isProduction } from '@shared/config/env';
import { AppError, isAppError } from '@shared/errors/AppError';
import { createLogger } from '@shared/logger';
import { clientIp } from '@shared/utils/http';
import type { ApiFailure, AdminRole, AuthenticatedActor, RequestContext } from '@shared/types/common';

const log = createLogger('http');

/** Fields the auth and context middleware attach to the request. */
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedActor;
    requestId?: string;
    context: RequestContext;
  }
}

// ── Request context ─────────────────────────────────────────────────────────

/**
 * Stamps every request with an id and a context object.
 *
 * The id travels into logs, audit rows and error responses, so a client can
 * quote one number and have it traced end to end.
 */
export const requestContext: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const requestId = incoming && incoming.length <= 64 ? incoming : randomUUID();

  req.requestId = requestId;
  req.context = {
    ipAddress: clientIp(req),
    userAgent: req.header('user-agent') ?? undefined,
    requestId,
  };

  res.setHeader('x-request-id', requestId);
  next();
};

// ── Authentication ──────────────────────────────────────────────────────────

function extractToken(req: Request): string | null {
  const header = req.header('authorization');

  if (header?.startsWith('Bearer ')) {
    return header.slice(7).trim() || null;
  }

  // Also accept the httpOnly cookie, so a browser dashboard need not keep the
  // access token in JavaScript-reachable storage.
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.access_token;
  return cookieToken ?? null;
}

/** Rejects anything without a valid access token. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw AppError.unauthorized('Please sign in to continue');
    }

    const actor = container.services.auth.verifyAccessToken(token);

    req.user = actor;
    req.context = { ...req.context, actor };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role check.
 *
 * `super_admin` implies every lower permission, so routes list only the
 * minimum role they need rather than enumerating the hierarchy each time.
 */
export function requireRole(...allowed: AdminRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Please sign in to continue'));
    }

    if (req.user.role === 'super_admin' || allowed.includes(req.user.role)) {
      return next();
    }

    log.warn(
      { userId: req.user.id, role: req.user.role, path: req.path },
      'authorisation refused',
    );

    return next(
      AppError.forbidden('Your account does not have permission to perform this action'),
    );
  };
}

// ── Validation ──────────────────────────────────────────────────────────────

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Validates and replaces part of the request with the parsed result.
 *
 * Downstream handlers then work with coerced, trimmed, typed data rather than
 * raw strings — and anything not in the schema has been stripped, so an
 * unexpected field cannot reach a repository.
 */
export function validate(schema: ZodSchema, target: ValidationTarget = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      return next(
        AppError.validation(
          (result.error as ZodError).issues.map((issue) => ({
            field: issue.path.join('.') || target,
            message: issue.message,
          })),
        ),
      );
    }

    if (target === 'query') {
      // `req.query` is a getter in Express 5 and assigning to it throws, so the
      // parsed result goes to a side channel that `parsedQuery()` reads back.
      (req as Request & { validatedQuery?: unknown }).validatedQuery = result.data;
    } else {
      req[target] = result.data as never;
    }

    next();
  };
}

/** Reads whichever of the two places `validate` put the parsed query. */
export function parsedQuery<T>(req: Request): T {
  return ((req as Request & { validatedQuery?: unknown }).validatedQuery ?? req.query) as T;
}

// ── Async handler ───────────────────────────────────────────────────────────

/**
 * Wraps an async handler so a rejected promise reaches the error middleware.
 *
 * Express 4 does not await handlers; without this, a thrown error inside an
 * async controller becomes an unhandled rejection and the request hangs until
 * it times out.
 */
export function asyncHandler<T extends Request = Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req as T, res, next)).catch(next);
  };
}

// ── Rate limiting ───────────────────────────────────────────────────────────

const windowMs = env.RATE_LIMIT_WINDOW_MINUTES * 60_000;

const limiterOptions = {
  windowMs,
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  handler: (_req: Request, _res: Response, next: NextFunction) => {
    next(AppError.rateLimited());
  },
};

export const generalLimiter = rateLimit({ ...limiterOptions, limit: env.RATE_LIMIT_MAX });

/** Tighter budget on the login and reset endpoints. */
export const authLimiter = rateLimit({
  ...limiterOptions,
  limit: env.AUTH_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
  handler: (_req, _res, next) => {
    next(
      AppError.rateLimited(
        'Too many sign-in attempts from this address. Please wait a few minutes.',
      ),
    );
  },
});

/** Public forms: generous enough for a human, useless for a spam run. */
export const publicFormLimiter = rateLimit({
  ...limiterOptions,
  limit: env.PUBLIC_FORM_RATE_LIMIT_MAX,
  handler: (_req, _res, next) => {
    next(
      AppError.rateLimited(
        'You have submitted several messages already. Please wait a few minutes before sending another.',
      ),
    );
  },
});

// ── Uploads ─────────────────────────────────────────────────────────────────

/**
 * Files are buffered in memory rather than written to a temp directory: they
 * go straight back out to Supabase Storage, so touching the disk would only
 * add a cleanup problem. The size cap keeps that safe.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, callback) => {
    if (!env.UPLOAD_ALLOWED_MIME.includes(file.mimetype)) {
      callback(
        AppError.unsupportedMediaType(
          `${file.mimetype} is not an accepted file type. Images, PDFs and Word documents are supported.`,
        ),
      );
      return;
    }
    callback(null, true);
  },
});

// ── Errors ──────────────────────────────────────────────────────────────────

/** 404 for anything no route matched. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl}`));
};

/**
 * The single place an error becomes a response.
 *
 * Known `AppError`s are reported as-is. Everything else is a bug: it is logged
 * in full and reduced to a generic 500, because a stack trace or a driver
 * message in a response body is an information leak.
 */
export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Multer reports its own limits through a code rather than an AppError.
  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? `That file is larger than the ${env.UPLOAD_MAX_FILE_SIZE_MB}MB limit`
        : `Upload failed: ${error.message}`;

    res.status(413).json({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message },
      requestId: req.requestId,
    } satisfies ApiFailure);
    return;
  }

  if (isAppError(error)) {
    // 5xx means something broke; 4xx is the client being told no.
    const level = error.statusCode >= 500 ? 'error' : 'warn';
    log[level](
      {
        err: error,
        code: error.code,
        status: error.statusCode,
        path: req.originalUrl,
        requestId: req.requestId,
      },
      error.message,
    );

    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.issues ? { issues: error.issues } : {}),
      },
      requestId: req.requestId,
    } satisfies ApiFailure);
    return;
  }

  log.error(
    { err: error, path: req.originalUrl, requestId: req.requestId },
    'unhandled error',
  );

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction
        ? 'Something went wrong on our end. Please try again.'
        : error instanceof Error
          ? error.message
          : 'Unknown error',
    },
    requestId: req.requestId,
  } satisfies ApiFailure);
};
