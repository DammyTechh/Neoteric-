import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';
import { PublicationCard } from '@/components/publications/PublicationCard';
import { PublicationSearch } from '@/components/publications/PublicationSearch';
import { BreadcrumbSchema, PublicationListSchema } from '@/components/seo/StructuredData';
import { apiGetSafe, apiGetList } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Publication, PublicationCategory, SiteSettings, PaginationMeta } from '@/lib/types';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'News & Publications',
  description:
    'Practical commentary on Nigerian corporate, commercial, property, technology and ' +
    'public law from the lawyers at Neoteric LP.',
  alternates: { canonical: '/publications' },
};

const PAGE_SIZE = 12;

interface SearchParams {
  page?: string;
  category?: string;
  tag?: string;
  q?: string;
}

export default async function PublicationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);

  const [{ items, meta }, categories, settings] = await Promise.all([
    apiGetList<Publication>('/publications', {
      params: {
        page,
        limit: PAGE_SIZE,
        categorySlug: searchParams.category,
        tag: searchParams.tag,
        search: searchParams.q,
      },
      revalidate: 300,
    }).catch(() => ({
      items: [] as Publication[],
      meta: {
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      } as PaginationMeta,
    })),
    apiGetSafe<PublicationCategory[]>('/publications/categories', [], { revalidate: 600 }),
    apiGetSafe<SiteSettings>('/settings', {}, { revalidate: 600 }),
  ]);

  const filtering = Boolean(searchParams.category || searchParams.tag || searchParams.q);

  // The feature card only leads an unfiltered first page — on a filtered list
  // one result being twice the size of the others is noise, not hierarchy.
  const showFeature = !filtering && page === 1 && items.length > 0;
  const [lead, ...rest] = showFeature ? items : [];
  const grid = showFeature ? rest : items;

  /** Preserves the active filters when building a page link. */
  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (searchParams.category) query.set('category', searchParams.category);
    if (searchParams.tag) query.set('tag', searchParams.tag);
    if (searchParams.q) query.set('q', searchParams.q);
    if (target > 1) query.set('page', String(target));
    const suffix = query.toString();
    return suffix ? `/publications?${suffix}` : '/publications';
  };

  return (
    <>
      <PublicationListSchema publications={items} />
      <BreadcrumbSchema
        trail={[
          { name: 'Home', path: '/' },
          { name: 'News & Publications', path: '/publications' },
        ]}
      />

      <Header />

      <main id="main" className="pt-20 md:pt-24">
        {/* ── Masthead ─────────────────────────────────────────────────── */}
        <header className="relative overflow-hidden bg-primary-950 text-white">
          <div className="absolute inset-0 bg-grid" aria-hidden="true" />
          <div
            className="pointer-events-none absolute -left-24 top-0 h-96 w-96 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #c19766, transparent 70%)' }}
            aria-hidden="true"
          />

          <div className="shell relative py-16 md:py-24">
            <p className="eyebrow mb-4">News &amp; Publications</p>
            <h1 className="text-h1 text-white text-balance max-w-3xl">
              Commentary on the law as it actually works
            </h1>
            <p className="mt-6 max-w-2xl text-lead text-primary-200 text-pretty">
              Analysis of Nigerian corporate, commercial, property, technology and public
              law, written for the people who have to act on it.
            </p>

            <div className="mt-10 max-w-xl">
              <PublicationSearch initialValue={searchParams.q ?? ''} />
            </div>
          </div>
        </header>

        {/* ── Category rail ────────────────────────────────────────────── */}
        {categories.length > 0 && (
          <div className="sticky top-20 md:top-24 z-30 border-b border-surface-line bg-surface/90 backdrop-blur-xl">
            <div className="shell">
              <nav
                className="flex gap-2 overflow-x-auto py-4 no-scrollbar"
                aria-label="Filter by category"
              >
                <Link
                  href="/publications"
                  className={cn('chip shrink-0', !searchParams.category && 'chip-active')}
                >
                  All
                  <span className="mono text-caption opacity-60">{meta.total}</span>
                </Link>

                {categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/publications?category=${category.slug}`}
                    className={cn(
                      'chip shrink-0',
                      searchParams.category === category.slug && 'chip-active',
                    )}
                  >
                    {/* The category's colour lives in a small dot rather than
                        in the label, so the rail stays legible. */}
                    {category.colour && (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: category.colour }}
                        aria-hidden="true"
                      />
                    )}
                    {category.name}
                    {typeof category.publicationCount === 'number' && (
                      <span className="mono text-caption opacity-60">
                        {category.publicationCount}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────────── */}
        <div className="shell py-12 md:py-16">
          {filtering && (
            <div className="mb-8 flex flex-wrap items-center gap-3">
              <p className="text-ink-muted">
                <span className="mono text-ink">{meta.total}</span>{' '}
                {meta.total === 1 ? 'publication' : 'publications'}
                {searchParams.q && (
                  <>
                    {' '}matching <span className="text-ink">&ldquo;{searchParams.q}&rdquo;</span>
                  </>
                )}
                {searchParams.tag && (
                  <>
                    {' '}tagged <span className="text-ink">{searchParams.tag}</span>
                  </>
                )}
              </p>
              <Link href="/publications" className="chip">
                <Icon name="close" size="sm" />
                Clear filters
              </Link>
            </div>
          )}

          {items.length === 0 ? (
            <div className="card mx-auto max-w-md p-10 text-center">
              <Icon name="search_off" size="xl" className="text-ink-soft" />
              <h2 className="mt-4 text-h5">Nothing found</h2>
              <p className="mt-3 text-ink-muted text-pretty">
                {filtering
                  ? 'No publications match those filters. Try a broader search.'
                  : 'There are no publications here yet. Please check back soon.'}
              </p>
              {filtering && (
                <Link href="/publications" className="btn-primary mt-6">
                  See all publications
                </Link>
              )}
            </div>
          ) : (
            <>
              {showFeature && lead && (
                <Reveal className="mb-6">
                  <PublicationCard publication={lead} variant="feature" priority />
                </Reveal>
              )}

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {grid.map((publication, index) => (
                  <Reveal key={publication.id} delay={Math.min(index * 0.05, 0.3)}>
                    <PublicationCard
                      publication={publication}
                      priority={!showFeature && index < 3}
                    />
                  </Reveal>
                ))}
              </div>
            </>
          )}

          {/* ── Pagination ───────────────────────────────────────────────
              Real links rather than a "load more" button, so each page is
              shareable, crawlable and survives a back navigation.        */}
          {meta.totalPages > 1 && (
            <nav
              className="mt-16 flex items-center justify-center gap-2"
              aria-label="Pagination"
            >
              <Link
                href={pageHref(page - 1)}
                aria-disabled={!meta.hasPrevious}
                className={cn(
                  'btn btn-sm btn-ghost',
                  !meta.hasPrevious && 'pointer-events-none opacity-40',
                )}
              >
                <Icon name="arrow_back" size="sm" />
                <span className="hidden sm:inline">Previous</span>
              </Link>

              <div className="flex items-center gap-1">
                {Array.from({ length: meta.totalPages }, (_, index) => index + 1)
                  // Show the first, last and a window around the current page.
                  .filter(
                    (target) =>
                      target === 1 ||
                      target === meta.totalPages ||
                      Math.abs(target - page) <= 1,
                  )
                  .map((target, index, visible) => (
                    <span key={target} className="flex items-center gap-1">
                      {index > 0 && target - visible[index - 1]! > 1 && (
                        <span className="px-1 text-ink-soft">…</span>
                      )}
                      <Link
                        href={pageHref(target)}
                        aria-current={target === page ? 'page' : undefined}
                        className={cn(
                          'grid h-10 w-10 place-items-center rounded-lg mono text-small transition-colors',
                          target === page
                            ? 'bg-primary text-white'
                            : 'text-ink-muted hover:bg-surface-sunken hover:text-primary',
                        )}
                      >
                        {target}
                      </Link>
                    </span>
                  ))}
              </div>

              <Link
                href={pageHref(page + 1)}
                aria-disabled={!meta.hasNext}
                className={cn(
                  'btn btn-sm btn-ghost',
                  !meta.hasNext && 'pointer-events-none opacity-40',
                )}
              >
                <span className="hidden sm:inline">Next</span>
                <Icon name="arrow_forward" size="sm" />
              </Link>
            </nav>
          )}
        </div>
      </main>

      <Footer settings={settings} />
    </>
  );
}
