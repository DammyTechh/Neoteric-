/**
 * Applies `migrations/0001_init.sql`.
 *
 *   npm run db:migrate
 *
 * Convenience only. The file is a single, idempotent, self-contained script,
 * so it can equally be pasted into the Supabase SQL editor or piped through
 * `psql "$DATABASE_URL" -f migrations/0001_init.sql`.
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { env } from '@shared/config/env';

/* eslint-disable no-console */

const run = promisify(execFile);

const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

async function main(): Promise<void> {
  if (!env.DATABASE_URL) {
    console.error(
      `${RED}DATABASE_URL is not set.${RESET}\n\n` +
        'Find it in Supabase under Project Settings → Database → Connection string → URI.\n\n' +
        'Or apply the migration by hand:\n' +
        `  ${DIM}psql "$DATABASE_URL" -f migrations/0001_init.sql${RESET}\n` +
        'or paste the file into the Supabase SQL editor.\n',
    );
    process.exit(1);
  }

  const migrationPath = path.resolve(process.cwd(), 'migrations', '0001_init.sql');

  if (!existsSync(migrationPath)) {
    console.error(`${RED}Could not find${RESET} ${migrationPath}`);
    process.exit(1);
  }

  console.log(`\n${DIM}Applying 0001_init.sql …${RESET}\n`);

  try {
    const { stdout, stderr } = await run('psql', [
      env.DATABASE_URL,
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      migrationPath,
    ]);

    if (stdout.trim()) console.log(stdout.trim());
    // psql writes NOTICEs to stderr; they are not failures.
    if (stderr.trim()) console.log(`${DIM}${stderr.trim()}${RESET}`);

    console.log(`\n${GREEN}Migration applied.${RESET}`);
    console.log(`${DIM}Next: npm run db:seed:admin${RESET}\n`);
  } catch (error) {
    const err = error as { stderr?: string; message?: string; code?: string };

    if (err.code === 'ENOENT') {
      console.error(
        `${RED}psql is not installed.${RESET}\n\n` +
          'Either install the PostgreSQL client, or paste migrations/0001_init.sql\n' +
          'into the Supabase SQL editor.\n',
      );
      process.exit(1);
    }

    console.error(`${RED}Migration failed:${RESET}\n${err.stderr ?? err.message}`);
    process.exit(1);
  }
}

void main();
