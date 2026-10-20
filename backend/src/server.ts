import type { Server } from 'node:http';
import { createApp } from './app';
import { container } from '@infrastructure/container';
import { env, isProduction } from '@shared/config/env';
import { logger } from '@shared/logger';
import { supabase } from '@infrastructure/database/supabase.client';

/**
 * Process entry point: boot checks, scheduler, graceful shutdown.
 */

/** How often to flip scheduled articles to published. */
const SCHEDULER_INTERVAL_MS = 60_000;
/** How long to let in-flight requests finish before forcing exit. */
const SHUTDOWN_GRACE_MS = 15_000;

let server: Server | undefined;
let schedulerTimer: NodeJS.Timeout | undefined;
let shuttingDown = false;

/**
 * Checks that the things the API depends on are actually reachable.
 *
 * Warnings rather than hard failures: a misconfigured SMTP password should
 * not stop the site serving its publications, and it is better to start and
 * report the problem loudly than to crash-loop in a way nobody can inspect.
 */
interface DatabaseReport {
  ok: boolean;
  message: string;
  remedy: string;
  detail?: string;
}

/**
 * Distinguishes the ways the database can be wrong at boot.
 *
 * Postgres error codes already carry the distinction: `42P01` means the table
 * is not there (the migration never ran), `42501` means it is there but this
 * role may not touch it (privileges missing). Collapsing those into one
 * "database error" is what sends people hunting in the wrong place — and
 * `service_role` on Supabase bypasses RLS while still needing table GRANTs,
 * so `42501` is a genuinely easy trap.
 */
async function inspectDatabase(): Promise<DatabaseReport> {
  const { error } = await supabase.from('site_settings').select('key').limit(1);

  if (!error) return { ok: true, message: 'database reachable', remedy: '' };

  const code = (error as { code?: string }).code;

  if (code === '42P01') {
    return {
      ok: false,
      message: 'The database schema is missing — the migration has not been run.',
      remedy: 'Run:  psql "$DATABASE_URL" -1 -f migrations/0001_init.sql',
      detail: error.message,
    };
  }

  if (code === '42501') {
    return {
      ok: false,
      message: 'The schema exists, but this role cannot read it — table privileges are missing.',
      remedy:
        'Re-run the migration, which now grants them, or apply section 11b of ' +
        'migrations/0001_init.sql on its own.',
      detail: error.message,
    };
  }

  return {
    ok: false,
    message: 'The database could not be reached.',
    remedy: 'Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.',
    detail: error.message,
  };
}

async function runStartupChecks(): Promise<void> {
  const { storage, mailer } = container.services;

  /**
   * The database comes first, and its failures are named explicitly.
   *
   * Without this the first sign of trouble was a stack trace from the
   * scheduler sixty seconds in, which says nothing about the actual cause.
   * The two failures worth telling apart are "I cannot reach the database"
   * and "I can reach it but the schema is not there / I lack privileges" —
   * they have completely different fixes.
   */
  const database = await inspectDatabase();

  if (!database.ok) {
    logger.error({ detail: database.detail }, database.message);
    logger.error(database.remedy);
  }

  const [bucket, smtp] = await Promise.allSettled([
    storage.ensureBucket(),
    mailer.verifyConnection(),
  ]);

  if (bucket.status === 'rejected') {
    logger.warn({ err: bucket.reason }, 'storage bucket check failed — uploads may not work');
  }

  if (smtp.status === 'fulfilled' && smtp.value === false) {
    logger.warn(
      'SMTP is not verified — emails will not be delivered. Check SMTP_PASSWORD, or set MAIL_DRY_RUN=true in development.',
    );
  }

  if (isProduction && !env.SMTP_PASSWORD) {
    logger.error('Running in production without an SMTP password. No email will be sent.');
  }
}

/**
 * Publishes anything whose scheduled time has passed.
 *
 * An interval in-process rather than a cron service: the cadence is one
 * minute, the work is a single indexed UPDATE, and adding a queue for it
 * would be more moving parts than the problem deserves. If the API is ever
 * scaled horizontally, this should move to a single worker or a database
 * advisory lock so two instances do not both publish the same article.
 */
function startScheduler(): void {
  const tick = async () => {
    if (shuttingDown) return;

    try {
      const count = await container.services.publications.runScheduledPublishing();
      if (count > 0) logger.info({ count }, 'scheduled publications went live');
    } catch (error) {
      logger.error({ err: error }, 'scheduled publishing failed');
    }
  };

  schedulerTimer = setInterval(() => void tick(), SCHEDULER_INTERVAL_MS);
  // Do not hold the process open on this timer alone.
  schedulerTimer.unref();

  void tick();
}

async function start(): Promise<void> {
  await runStartupChecks();

  const app = createApp();

  server = app.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        environment: env.NODE_ENV,
        api: env.API_PREFIX,
        docs: `http://localhost:${env.PORT}/api/docs`,
      },
      'Neoteric LP API is listening',
    );
  });

  // A port already in use is the one startup error worth naming explicitly;
  // the default message sends people hunting through stack traces.
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.fatal({ port: env.PORT }, 'port is already in use');
      process.exit(1);
    }
    throw error;
  });

  startScheduler();
}

/**
 * Stops accepting connections, lets in-flight requests finish, then exits.
 *
 * Without this, a deploy cuts off whatever was mid-flight — including a
 * newsletter send halfway through its recipient list.
 */
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'shutting down');

  if (schedulerTimer) clearInterval(schedulerTimer);

  const forceExit = setTimeout(() => {
    logger.error('graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  forceExit.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((error) => (error ? reject(error) : resolve()));
    });

    await container.services.mailer.close().catch(() => undefined);

    logger.info('shutdown complete');
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

/**
 * An unhandled rejection leaves the process in an unknown state. Log it, then
 * shut down cleanly rather than carrying on and serving corrupt results.
 */
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled promise rejection');
  void shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception');
  void shutdown('uncaughtException');
});

void start().catch((error) => {
  logger.fatal({ err: error }, 'failed to start');
  process.exit(1);
});
