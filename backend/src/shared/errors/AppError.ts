/**
 * The single error type the application throws on purpose.
 *
 * Anything that reaches the error middleware as an `AppError` is a known,
 * expected failure and is reported to the client verbatim. Anything else is
 * treated as a bug: logged with a stack trace and reduced to a generic 500.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_DISABLED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SLUG_TAKEN'
  | 'UNPROCESSABLE'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMITED'
  | 'MAIL_FAILED'
  | 'STORAGE_FAILED'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR';

export interface FieldIssue {
  field: string;
  message: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly issues?: FieldIssue[];
  public readonly details?: unknown;
  public readonly isOperational = true;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    options?: { issues?: FieldIssue[]; details?: unknown; cause?: unknown },
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.issues = options?.issues;
    this.details = options?.details;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
    Error.captureStackTrace(this, AppError);
  }

  // ── Factories ─────────────────────────────────────────────────────────────

  static badRequest(message = 'Bad request', issues?: FieldIssue[]) {
    return new AppError(message, 400, 'VALIDATION_ERROR', { issues });
  }

  static validation(issues: FieldIssue[], message = 'The submitted data is not valid') {
    return new AppError(message, 422, 'VALIDATION_ERROR', { issues });
  }

  static unauthorized(message = 'Authentication is required', code: ErrorCode = 'UNAUTHORIZED') {
    return new AppError(message, 401, code);
  }

  static invalidCredentials(message = 'Email or password is incorrect') {
    return new AppError(message, 401, 'INVALID_CREDENTIALS');
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(resource = 'Resource') {
    return new AppError(`${resource} was not found`, 404, 'NOT_FOUND');
  }

  static conflict(message: string, code: ErrorCode = 'CONFLICT') {
    return new AppError(message, 409, code);
  }

  static unprocessable(message: string) {
    return new AppError(message, 422, 'UNPROCESSABLE');
  }

  static payloadTooLarge(message = 'The uploaded file is too large') {
    return new AppError(message, 413, 'PAYLOAD_TOO_LARGE');
  }

  static unsupportedMediaType(message = 'That file type is not accepted') {
    return new AppError(message, 415, 'UNSUPPORTED_MEDIA_TYPE');
  }

  static rateLimited(message = 'Too many requests. Please try again shortly.') {
    return new AppError(message, 429, 'RATE_LIMITED');
  }

  static internal(message = 'Something went wrong on our end', cause?: unknown) {
    return new AppError(message, 500, 'INTERNAL_ERROR', { cause });
  }

  static database(message = 'A database error occurred', cause?: unknown) {
    return new AppError(message, 500, 'DATABASE_ERROR', { cause });
  }

  static storage(message = 'File storage is unavailable', cause?: unknown) {
    return new AppError(message, 502, 'STORAGE_FAILED', { cause });
  }

  static mail(message = 'The email could not be sent', cause?: unknown) {
    return new AppError(message, 502, 'MAIL_FAILED', { cause });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
