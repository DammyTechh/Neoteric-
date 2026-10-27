import { waitUntil } from '@vercel/functions';
import { logger } from '@shared/logger';

/**
 * Runs work after the response has been sent, without losing it.
 *
 * On a long-running server (Docker, `npm start`) a bare `void promise` is
 * enough: the process stays up and the promise finishes. On Vercel the
 * function is frozen as soon as the response goes out, so a contact-form
 * notification or a newsletter announcement started that way would simply
 * never be delivered. `waitUntil` keeps the invocation alive until the
 * promise settles; outside Vercel it is a no-op and the promise runs as
 * before.
 *
 * Failures are logged here, because nothing else is awaiting the promise.
 */
export function runInBackground(task: Promise<unknown>, label = 'background task'): void {
  const guarded = task.catch((error: unknown) => {
    logger.error({ err: error }, `${label} failed`);
  });

  try {
    waitUntil(guarded);
  } catch {
    // Not inside a Vercel request context — the promise still runs.
  }
}
