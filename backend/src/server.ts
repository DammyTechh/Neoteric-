import type { Server } from 'node:http';
import { createApp } from './app';
import { container } from '@infrastructure/container';
import { env, isProduction } from '@shared/config/env';
import { logger } from '@shared/logger';

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
async function runStartupChecks(): Promise<void> {
  const { storage, mailer } = container.services;

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
