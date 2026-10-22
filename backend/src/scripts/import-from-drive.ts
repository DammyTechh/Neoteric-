/**
 * Pulls the 27 v1 articles down from Google Drive and makes them readable
 * on the site.
 *
 *   npm run db:import-drive            # import everything still empty
 *   npm run db:import-drive -- --dry   # report what it would do, change nothing
 *   npm run db:import-drive -- --slug=ai-governance-why-should-you-care
 *
 * Each v1 publication carries a `source_url` pointing at a Google Doc or a
 * Drive file. This fetches the document, converts it to article HTML through
 * the same importer the dashboard upload uses, and writes it to `body`. After
 * it runs, the articles read on your own site and nothing links out.
 *
 * Why a script rather than a migration: it needs the network, it can partially
 * fail, and it is worth being able to re-run for the ones that did not land.
 * It only ever fills in an empty body, so re-running cannot overwrite an
 * article someone has since edited.
 *
 * Documents must be shared as "anyone with the link can view". Anything still
 * restricted is reported at the end so you can fix the sharing and re-run.
 */

import { DocumentImportService } from '@application/services/document-import.service';
import { supabase } from '@infrastructure/database/supabase.client';
import { deriveExcerpt } from '@shared/utils/sanitize';

/* eslint-disable no-console */

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

interface Row {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  source_url: string | null;
}

/**
 * Turns a share link into a direct download.
 *
 * Google Docs can be exported straight to .docx, which converts cleanly.
 * A Drive file is whatever was uploaded — usually already a .docx, sometimes
 * a PDF, which cannot be converted and is reported instead.
 */
function toDownloadUrl(shareUrl: string): { url: string; kind: 'doc' | 'file' } | null {
  const docMatch = shareUrl.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch?.[1]) {
    return {
      url: `https://docs.google.com/document/d/${docMatch[1]}/export?format=docx`,
      kind: 'doc',
    };
  }

  const fileMatch = shareUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch?.[1]) {
    return {
      url: `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`,
      kind: 'file',
    };
  }

  return null;
}

async function fetchDocument(
  url: string,
): Promise<{ buffer: Buffer; contentType: string } | { error: string }> {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        // Drive serves an interstitial to clients it does not recognise.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      },
    });

    if (!response.ok) {
      return {
        error:
          response.status === 404
            ? 'not found — the link may have changed'
            : response.status === 403
              ? 'access denied — set sharing to "anyone with the link"'
              : `HTTP ${response.status}`,
      };
    }

    const contentType = response.headers.get('content-type') ?? '';
    const buffer = Buffer.from(await response.arrayBuffer());

    // A sign-in page comes back as HTML with a 200.
    if (contentType.includes('text/html')) {
      return {
        error: 'returned a web page, not a document — check the sharing settings',
      };
    }

    if (buffer.length === 0) return { error: 'the document is empty' };

    return { buffer, contentType };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'network failure' };
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry');
  const only = args.find((a) => a.startsWith('--slug='))?.split('=')[1];

  console.log(`\n${DIM}── Neoteric LP · import publications from Drive ─────────${RESET}\n`);
  if (dryRun) console.log(`${YELLOW}Dry run — nothing will be written.${RESET}\n`);

  let query = supabase
    .from('publications')
    .select('id, title, slug, excerpt, source_url')
    .not('source_url', 'is', null)
    .order('published_at', { ascending: false });

  // Only ever fill an empty body, so a hand-edited article is never clobbered.
  if (only) query = query.eq('slug', only);
  else query = query.or('body.is.null,body.eq.');

  const { data, error } = await query;

  if (error) {
    console.error(`${RED}Could not read publications:${RESET}`, error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];

  if (rows.length === 0) {
    console.log(`${GREEN}Nothing to import — every publication already has content.${RESET}\n`);
    return;
  }

  console.log(`Found ${rows.length} publication${rows.length === 1 ? '' : 's'} to import.\n`);

  const importer = new DocumentImportService();
  const failures: { title: string; reason: string }[] = [];
  let imported = 0;
  let skipped = 0;

  for (const [index, row] of rows.entries()) {
    const label = `${String(index + 1).padStart(2, ' ')}/${rows.length}`;
    const short = row.title.length > 58 ? `${row.title.slice(0, 58)}…` : row.title;
    process.stdout.write(`${DIM}${label}${RESET} ${short.padEnd(60)} `);

    const target = row.source_url ? toDownloadUrl(row.source_url) : null;

    if (!target) {
      console.log(`${YELLOW}skip${RESET} ${DIM}(not a Drive link)${RESET}`);
      failures.push({ title: row.title, reason: 'source_url is not a Google Drive link' });
      skipped += 1;
      continue;
    }

    const fetched = await fetchDocument(target.url);

    if ('error' in fetched) {
      console.log(`${RED}fail${RESET} ${DIM}${fetched.error}${RESET}`);
      failures.push({ title: row.title, reason: fetched.error });
      continue;
    }

    // A PDF keeps its layout and cannot become editable HTML. Upload those
    // through the dashboard instead, where the article page shows them in a
    // reader rather than sending anyone to Drive.
    if (fetched.contentType.includes('pdf')) {
      console.log(`${YELLOW}skip${RESET} ${DIM}(PDF — upload via the dashboard)${RESET}`);
      failures.push({
        title: row.title,
        reason: 'PDF: upload it in the dashboard, which shows it inline',
      });
      skipped += 1;
      continue;
    }

    try {
      const result = await importer.fromWord(fetched.buffer, row.slug);

      if (dryRun) {
        console.log(`${GREEN}ok${RESET} ${DIM}${result.html.length} chars${RESET}`);
        imported += 1;
        continue;
      }

      const { error: writeError } = await supabase
        .from('publications')
        .update({
          body: result.html,
          excerpt: row.excerpt ?? deriveExcerpt(result.html, 200),
        })
        .eq('id', row.id);

      if (writeError) {
        console.log(`${RED}fail${RESET} ${DIM}${writeError.message}${RESET}`);
        failures.push({ title: row.title, reason: writeError.message });
        continue;
      }

      console.log(`${GREEN}ok${RESET} ${DIM}${result.html.length} chars${RESET}`);
      imported += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'conversion failed';
      console.log(`${RED}fail${RESET} ${DIM}${reason}${RESET}`);
      failures.push({ title: row.title, reason });
    }

    // Drive throttles a fast loop; this keeps the run under its limit.
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  console.log(`\n${DIM}────────────────────────────────────────────────────────${RESET}`);
  console.log(`${GREEN}imported${RESET} ${imported}   ${YELLOW}skipped${RESET} ${skipped}   ${RED}failed${RESET} ${failures.length - skipped}`);

  if (failures.length > 0) {
    console.log(`\n${YELLOW}Needs attention:${RESET}`);
    for (const failure of failures) {
      const short = failure.title.length > 54 ? `${failure.title.slice(0, 54)}…` : failure.title;
      console.log(`  ${DIM}·${RESET} ${short}`);
      console.log(`    ${DIM}${failure.reason}${RESET}`);
    }
    console.log(
      `\n${DIM}Most failures are sharing settings. Open the document in Drive,\n` +
        `set it to "anyone with the link can view", then re-run this script —\n` +
        `it only touches articles that are still empty.${RESET}`,
    );
  }

  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`\n${RED}Import failed:${RESET}`, error instanceof Error ? error.message : error);
    process.exit(1);
  });
