/**
 * Fails if the frontend and backend brand tokens disagree.
 *
 *   npm run brand:check
 *
 * The two codebases deploy independently, so the tokens are duplicated rather
 * than shared through a package. Duplication without a check is how a web
 * page and an email end up in different shades of the same brand — which is
 * precisely what this project did before the check existed. Wired into
 * `npm run build`, so it cannot be skipped by forgetting to run it.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

const FRONTEND = path.join(here, '..', 'src', 'lib', 'brand.ts');
const BACKEND = path.join(
  here, '..', '..', 'backend', 'src', 'application', 'mail', 'templates', 'brand.ts',
);

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/** Pulls `key: '#hex'` pairs out of a token file, ignoring layout. */
function readTokens(file) {
  const source = readFileSync(file, 'utf8');
  const tokens = new Map();

  for (const match of source.matchAll(/(\w+)\s*:\s*'(#[0-9a-fA-F]{6})'/g)) {
    tokens.set(match[1], match[2].toLowerCase());
  }

  return tokens;
}

if (!existsSync(BACKEND)) {
  // The frontend is often cloned on its own; that is not a failure.
  console.log(
    `${YELLOW}brand:check skipped${RESET} ${DIM}— backend not present alongside this repo${RESET}`,
  );
  process.exit(0);
}

const frontend = readTokens(FRONTEND);
const backend = readTokens(BACKEND);

const problems = [];

for (const [key, value] of frontend) {
  if (!backend.has(key)) {
    problems.push(`  ${key}: frontend ${value}, missing from backend`);
  } else if (backend.get(key) !== value) {
    problems.push(`  ${key}: frontend ${value} ≠ backend ${backend.get(key)}`);
  }
}

for (const key of backend.keys()) {
  if (!frontend.has(key)) {
    problems.push(`  ${key}: backend only, missing from frontend`);
  }
}

if (problems.length > 0) {
  console.error(`\n${RED}Brand tokens have drifted:${RESET}\n`);
  console.error(problems.join('\n'));
  console.error(
    `\n${DIM}Fix both files:\n` +
      `  frontend/src/lib/brand.ts\n` +
      `  backend/src/application/mail/templates/brand.ts${RESET}\n`,
  );
  process.exit(1);
}

console.log(
  `${GREEN}✓ brand tokens in sync${RESET} ${DIM}(${frontend.size} values, frontend ↔ backend)${RESET}`,
);
