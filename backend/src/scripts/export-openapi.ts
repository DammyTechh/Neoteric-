/**
 * Writes the OpenAPI document to `openapi.json`.
 *
 *   npm run openapi:export
 *
 * For importing into Postman or Insomnia, or generating a typed client with
 * `openapi-typescript` so the frontend's API types come from one source.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { openApiDocument } from '@presentation/docs/openapi';

/* eslint-disable no-console */

async function main(): Promise<void> {
  const outPath = path.resolve(process.cwd(), 'openapi.json');
  await writeFile(outPath, JSON.stringify(openApiDocument, null, 2), 'utf8');

  const pathCount = Object.keys(openApiDocument.paths ?? {}).length;
  const operationCount = Object.values(
    openApiDocument.paths as Record<string, Record<string, unknown>>,
  ).reduce((total, methods) => total + Object.keys(methods).length, 0);

  console.log(`\nWrote ${outPath}`);
  console.log(`  ${pathCount} paths · ${operationCount} operations\n`);
}

void main();
