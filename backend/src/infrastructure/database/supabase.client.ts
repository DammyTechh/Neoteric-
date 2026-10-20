import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@shared/config/env';
import { AppError } from '@shared/errors/AppError';
import { createLogger } from '@shared/logger';

const log = createLogger('supabase');

/**
 * The service-role client.
 *
 * It bypasses Row Level Security, which is exactly what a trusted backend
 * wants — authorisation is decided in the application layer where it can be
 * reasoned about and audited. The key must never reach the browser.
 */
export const supabase: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
    global: { headers: { 'x-application-name': 'neoteric-api' } },
  },
);

/** Postgres error codes worth translating into something a client can act on. */
const PG_ERROR_MAP: Record<string, () => AppError> = {
  '23505': () => AppError.conflict('A record with those details already exists'),
  '23503': () => AppError.unprocessable('That reference points at a record which does not exist'),
  '23514': () => AppError.unprocessable('The submitted data violates a database constraint'),
  '22P02': () => AppError.badRequest('Malformed identifier'),
  PGRST116: () => AppError.notFound('Record'),
};

interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Normalises a Supabase/PostgREST error into an `AppError`.
 *
 * Driver-level detail is logged but never returned to the client — a unique
 * constraint name is useful in a log and an information leak in a response.
 */
export function translateDatabaseError(error: SupabaseErrorLike, context: string): AppError {
  log.error({ err: error, context }, 'database operation failed');

  const mapped = error.code ? PG_ERROR_MAP[error.code] : undefined;
  if (mapped) return mapped();

  return AppError.database(`Could not complete the ${context} operation`, error);
}

/** As `unwrap`, but a missing row is a legitimate `null` rather than a 404. */
export function unwrapMaybe<T>(
  result: { data: T | null; error: SupabaseErrorLike | null },
  context: string,
): T | null {
  if (result.error) {
    // PGRST116 = "no rows returned" from .single(); that is not a failure here.
    if (result.error.code === 'PGRST116') return null;
    throw translateDatabaseError(result.error, context);
  }
  return result.data;
}

/** Confirms the database is reachable. Used by the readiness probe. */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('site_settings').select('key').limit(1);
    if (error) {
      log.error({ err: error }, 'database health check failed');
      return false;
    }
    return true;
  } catch (error) {
    log.error({ err: error }, 'database health check threw');
    return false;
  }
}
