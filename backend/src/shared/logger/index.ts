import pino from 'pino';
import { env, isDevelopment, isTest } from '@shared/config/env';

/**
 * Structured logging. Pretty-printed while developing, newline-delimited JSON
 * everywhere else so a log shipper can parse it.
 *
 * Anything that looks like a credential is redacted before it is written.
 */
export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  base: { service: 'neoteric-api', env: env.NODE_ENV },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'currentPassword',
      'newPassword',
      'passwordHash',
      'password_hash',
      'token',
      'accessToken',
      'refreshToken',
      'confirm_token_hash',
      '*.password',
      '*.passwordHash',
    ],
    censor: '[redacted]',
  },
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname,service,env',
        },
      }
    : undefined,
});

/** A child logger tagged with the module it came from. */
export const createLogger = (module: string) => logger.child({ module });
