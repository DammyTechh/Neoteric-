import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

/**
 * Every environment variable the API understands, validated once at boot.
 *
 * The process refuses to start on an invalid environment rather than failing
 * later at an awkward moment — a missing SMTP password should surface on
 * deploy, not the first time a client submits the contact form.
 */

const csv = (value: string) =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const envSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().startsWith('/').default('/api/v1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:3000').transform(csv),
  SITE_URL: z.string().url().default('https://www.neotericlp.com.ng'),
  ADMIN_URL: z.string().url().default('http://localhost:3000/admin'),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default('neoteric-media'),
  DATABASE_URL: z.string().optional(),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  JWT_ISSUER: z.string().default('neoteric-api'),
  JWT_AUDIENCE: z.string().default('neoteric-admin'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),

  // Seeded admin
  SEED_ADMIN_EMAIL: z.string().email().default('admin@neotericlp.com.ng'),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  SEED_ADMIN_NAME: z.string().default('Neoteric Administrator'),

  // Mail
  SMTP_HOST: z.string().default('smtp.resend.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: booleanish.default('true'),
  SMTP_USER: z.string().default('resend'),
  SMTP_PASSWORD: z.string().default(''),
  MAIL_FROM_NAME: z.string().default('Neoteric LP'),
  MAIL_FROM_EMAIL: z.string().email().default('no-reply@neotericlp.com.ng'),
  MAIL_REPLY_TO: z.string().email().optional(),
  MAIL_ADMIN_RECIPIENTS: z.string().default('info@neotericlp.com.ng').transform(csv),
  MAIL_DRY_RUN: booleanish.default('false'),

  // Uploads
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(15),
  UPLOAD_ALLOWED_MIME: z
    .string()
    .default(
      'image/jpeg,image/png,image/webp,image/avif,image/svg+xml,application/pdf,' +
        'application/msword,' +
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    .transform(csv),

  // Rate limiting
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().positive().default(15),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  PUBLIC_FORM_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    // Logger is not available yet at this point in the boot sequence.
    // eslint-disable-next-line no-console
    console.error(`\nInvalid environment configuration:\n${problems}\n`);
    process.exit(1);
  }

  return parsed.data;
}

export const env = parseEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
