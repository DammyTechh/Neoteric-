/**
 * Slug generation mirroring the `public.slugify()` SQL function, so a slug
 * computed in the application matches one computed by the database.
 */

const MAX_SLUG_LENGTH = 120;

export function slugify(input: string, maxLength = MAX_SLUG_LENGTH): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length <= maxLength) return slug;

  // Trim at a word boundary rather than mid-word.
  return slug.slice(0, maxLength).replace(/-[^-]*$/, '').replace(/-+$/, '');
}

/**
 * Appends `-2`, `-3`, … until the slug is free.
 *
 * `exists` is injected so this stays a pure function the repository layer can
 * satisfy however it likes.
 */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
  maxAttempts = 50,
): Promise<string> {
  const root = slugify(base) || 'item';

  if (!(await exists(root))) return root;

  for (let suffix = 2; suffix <= maxAttempts; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!(await exists(candidate))) return candidate;
  }

  // Extremely unlikely; keeps the function total rather than throwing.
  return `${root}-${Date.now().toString(36)}`;
}
