/**
 * Creates the firm's single super-administrator.
 *
 *   npm run db:seed:admin
 *
 * This exists as a script rather than an INSERT in the migration because the
 * password must be bcrypt-hashed by the application — a plaintext password
 * committed into a .sql file would live forever in the repository history.
 *
 * It is the only way the first account comes into existence. There is no
 * registration endpoint anywhere in the API.
 *
 * Safe to re-run: an existing account is reported, not overwritten.
 */

import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { AdminUserRepository } from '@infrastructure/database/repositories/admin.repository';
import { ResendMailer } from '@infrastructure/mail/resend.mailer';
import { EmailLogRepository } from '@infrastructure/database/repositories/support.repository';
import { adminWelcome } from '@application/mail/templates';
import { env } from '@shared/config/env';
import { hashPassword } from '@shared/utils/crypto';
import { passwordSchema } from '@application/dto';

/* eslint-disable no-console */

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

async function promptForPassword(): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    console.log(
      `${YELLOW}SEED_ADMIN_PASSWORD is not set in your environment.${RESET}\n` +
        `${DIM}Enter one now (at least 12 characters). It will not be stored anywhere but the database, hashed.${RESET}`,
    );

    const password = await rl.question('Password: ');
    const confirmation = await rl.question('Confirm password: ');

    if (password !== confirmation) {
      throw new Error('The two passwords do not match.');
    }

    return password;
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  console.log(`\n${DIM}── Neoteric LP · seed administrator ───────────────────${RESET}\n`);

  const admins = new AdminUserRepository();
  const email = env.SEED_ADMIN_EMAIL;

  const existing = await admins.findByEmail(email);

  if (existing) {
    console.log(
      `${YELLOW}An account already exists for ${email}.${RESET}\n` +
        `${DIM}Nothing changed. To reset its password, use the "Forgot password" link on the sign-in page.${RESET}\n`,
    );
    return;
  }

  const password = env.SEED_ADMIN_PASSWORD ?? (await promptForPassword());

  // Hold the seeded account to the same password rules the API enforces.
  const validation = passwordSchema.safeParse(password);
  if (!validation.success) {
    console.error(`\n${RED}That password was rejected:${RESET}`);
    for (const issue of validation.error.issues) {
      console.error(`  • ${issue.message}`);
    }
    process.exit(1);
  }

  const user = await admins.createWithPassword({
    email,
    passwordHash: await hashPassword(password),
    fullName: env.SEED_ADMIN_NAME,
    role: 'super_admin',
    mustChangePassword: false,
  });

  console.log(`${GREEN}Super-administrator created.${RESET}\n`);
  console.log(`  Email   ${user.email}`);
  console.log(`  Name    ${user.fullName}`);
  console.log(`  Role    ${user.role}`);
  console.log(`  Sign in ${env.ADMIN_URL}\n`);

  // Best effort: a mail failure must not make it look as though the account
  // was not created, because it was.
  try {
    const mailer = new ResendMailer(new EmailLogRepository());
    await mailer.send({
      to: user.email,
      ...adminWelcome({ fullName: user.fullName, email: user.email }),
      template: 'admin.welcome',
      metadata: { userId: user.id },
    });
    await mailer.close();
    console.log(`${DIM}A welcome email has been sent.${RESET}\n`);
  } catch {
    console.log(`${DIM}Could not send the welcome email — the account is still ready to use.${RESET}\n`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`\n${RED}Seeding failed:${RESET}`, error instanceof Error ? error.message : error);
    process.exit(1);
  });
