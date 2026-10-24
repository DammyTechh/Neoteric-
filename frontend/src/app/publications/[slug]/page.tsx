import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { whatsAppLink } from '@/lib/whatsapp';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';
import { Thumbnail } from '@/components/publications/Thumbnail';
import { PublicationCard } from '@/components/publications/PublicationCard';
import { DocumentViewer } from '@/components/publications/DocumentViewer';
import { NewsletterForm } from '@/components/forms/NewsletterForm';
import { BreadcrumbSchema } from '@/components/seo/StructuredData';
import { apiGet, apiGetSafe, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { PublicationDetail, SiteSettings } from '@/lib/types';

export const revalidate = 300;

async function getArticle(slug: string): Promise<PublicationDetail | null> {
  try {
    return await apiGet<PublicationDetail>(`/publications/${slug}`, { revalidate: 300 });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const detail = await getArticle(params.slug).catch(() => null);
  if (!detail) return { title: 'Publication not found' };

  const { publication } = detail;

  return {
    title: publication.seoTitle ?? publication.title,
    description: publication.seoDescription ?? publication.excerpt ?? undefined,
    openGraph: {
      type: 'article',
      title: publication.seoTitle ?? publication.title,
      description: publication.seoDescription ?? publication.excerpt ?? undefined,
      publishedTime: publication.publishedAt ?? undefined,
      authors: [publication.authorName],
      images: publication.ogImageUrl ?? publication.coverImageUrl ?? undefined,
    },
    alternates: { canonical: `/publications/${publication.slug}` },
  };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const detail = await getArticle(params.slug);
  if (!detail) notFound();

  const { publication, related, navigation } = detail;
  const settings = await apiGetSafe<SiteSettings>('/settings', {}, { revalidate: 600 });
  const chatUrl = whatsAppLink(settings);

  /**
   * What to render as the article's content, in order of preference.
   *
   * 1. `body` — real HTML, either written in the dashboard or converted from
   *    an uploaded Word file.
   * 2. An attached PDF, shown inline by the viewer.
   * 3. A short notice.
   *
   * There is deliberately no fourth option linking out to Google Drive. The
   * reader stays here.
   */
  const pdfAttachment = publication.attachments?.find(
    (attachment) => attachment.media?.mimeType === 'application/pdf',
  );

  const hasBody = Boolean(publication.body && publication.body.trim().length > 0);

  // Structured data, so the piece is indexed as an article rather than a page.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: publication.title,
    description: publication.excerpt ?? undefined,
    image: publication.coverImageUrl ?? undefined,
    datePublished: publication.publishedAt ?? undefined,
    dateModified: publication.updatedAt,
    author: { '@type': 'Organization', name: publication.authorName },
    /*
     * `articleBody` and `wordCount` are what an assistant reads when it is
     * deciding whether this piece answers a question — without them it only
     * sees a headline. `keywords` and `articleSection` give it the subject.
     */
    ...(publication.body
      ? {
          articleBody: publication.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
          wordCount: publication.body.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length,
        }
      : {}),
    ...(publication.tags.length > 0 ? { keywords: publication.tags.join(', ') } : {}),
    ...(publication.category ? { articleSection: publication.category.name } : {}),
    inLanguage: 'en-NG',
    isAccessibleForFree: true,
    timeRequired: `PT${publication.readingMinutes}M`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.neotericlp.com.ng'}/publications/${publication.slug}`,
    },
    publisher: {
      '@type': 'LegalService',
      name: 'Neoteric LP',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Abuja',
        addressRegion: 'FCT',
        addressCountry: 'NG',
      },
    },
  };

  return (
    <>
      <Header whatsAppUrl={chatUrl} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BreadcrumbSchema
        trail={[
          { name: 'Home', path: '/' },
          { name: 'News & Publications', path: '/publications' },
          { name: publication.title, path: `/publications/${publication.slug}` },
        ]}
      />

      <main id="main" className="pt-20 md:pt-24">
        {/* ── Masthead ─────────────────────────────────────────────────── */}
        <header className="relative overflow-hidden bg-primary-950 text-white">
          <div className="absolute inset-0 bg-grid" aria-hidden="true" />
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #3a9291, transparent 70%)' }}
            aria-hidden="true"
          />

          <div className="shell relative py-12 md:py-20">
            <nav aria-label="Breadcrumb" className="mb-8">
              <ol className="flex flex-wrap items-center gap-2 text-small text-primary-300">
                <li>
                  <Link href="/" className="hover:text-white transition-colors">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true" className="opacity-50">/</li>
                <li>
                  <Link href="/publications" className="hover:text-white transition-colors">
                    Publications
                  </Link>
                </li>
              </ol>
            </nav>

            <div className="grid gap-10 lg:grid-cols-12 lg:gap-12 items-center">
              <div className="lg:col-span-7">
                {publication.category && (
                  <Link
                    href={`/publications?category=${publication.category.slug}`}
                    className="eyebrow inline-block mb-4 hover:text-secondary-200 transition-colors"
                  >
                    {publication.category.name}
                  </Link>
                )}

                <h1 className="text-h1 text-white text-balance">{publication.title}</h1>

                {publication.excerpt && (
                  <p className="mt-6 text-lead text-primary-200 text-pretty max-w-2xl">
                    {publication.excerpt}
                  </p>
                )}

                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-small text-primary-300">
                  <span className="flex items-center gap-2">
                    <Icon name="person" size="sm" className="text-secondary" />
                    {publication.authorName}
                  </span>
                  <span className="flex items-center gap-2 mono">
                    <Icon name="calendar_today" size="sm" className="text-secondary" />
                    {formatDate(publication.publishedAt, 'long')}
                  </span>
                  <span className="flex items-center gap-2 mono">
                    <Icon name="schedule" size="sm" className="text-secondary" />
                    {publication.readingMinutes} min read
                  </span>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="overflow-hidden rounded-panel shadow-deep">
                  <Thumbnail
                    src={publication.coverImageUrl}
                    alt={publication.coverAlt}
                    title={publication.title}
                    categoryName={publication.category?.name}
                    priority
                    className="aspect-[4/3] w-full"
                    sizes="(max-width: 1024px) 100vw, 40vw"
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="shell py-16 md:py-24">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <article className="lg:col-span-8">
              {hasBody ? (
                <div
                  className="article-body max-w-reading"
                  // Sanitised server-side on write, through an allow-list that
                  // strips script, event handlers and unknown schemes.
                  dangerouslySetInnerHTML={{ __html: publication.body! }}
                />
              ) : pdfAttachment ? (
                <>
                  <p className="text-ink-muted text-pretty max-w-reading">
                    The full text of this publication is below. You can read it here or
                    download a copy.
                  </p>
                  <DocumentViewer attachment={pdfAttachment} />
                </>
              ) : (
                <div className="card p-8 max-w-reading">
                  <Icon name="edit_note" size="xl" className="text-ink-soft" />
                  <h2 className="mt-4 text-h5">This publication is being prepared</h2>
                  <p className="mt-3 text-ink-muted text-pretty">
                    The full text is being added to the site. Please check back shortly, or
                    get in touch if you need it sooner.
                  </p>
                  {/* "if you need it sooner" means the fastest route, which
                      is WhatsApp when one is configured. */}
                  <Link
                    href={chatUrl ?? '/#contactUs'}
                    {...(chatUrl
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                    className="btn-primary mt-6"
                  >
                    Contact us
                    <Icon name={chatUrl ? 'chat' : 'arrow_forward'} size="sm" />
                  </Link>
                </div>
              )}

              {/* A PDF alongside a written body is a supporting document. */}
              {hasBody && pdfAttachment && (
                <div className="max-w-reading">
                  <h2 className="text-h5 mt-12 mb-4">The full document</h2>
                  <DocumentViewer attachment={pdfAttachment} />
                </div>
              )}

              {publication.tags.length > 0 && (
                <div className="mt-12 flex flex-wrap items-center gap-2 max-w-reading">
                  <span className="eyebrow mr-2">Tags</span>
                  {publication.tags.map((tag) => (
                    <Link key={tag} href={`/publications?tag=${encodeURIComponent(tag)}`} className="chip">
                      {tag}
                    </Link>
                  ))}
                </div>
              )}

              {/* ── Previous / next ─────────────────────────────────────── */}
              {(navigation.previous || navigation.next) && (
                <nav
                  className="mt-16 grid gap-4 border-t border-surface-line pt-8 sm:grid-cols-2"
                  aria-label="More publications"
                >
                  {navigation.previous ? (
                    <Link
                      href={`/publications/${navigation.previous.slug}`}
                      className="card-interactive group p-5"
                    >
                      <span className="eyebrow flex items-center gap-1">
                        <Icon name="arrow_back" size="sm" />
                        Previous
                      </span>
                      <p className="mt-2 text-h6 line-clamp-2 group-hover:text-primary transition-colors">
                        {navigation.previous.title}
                      </p>
                    </Link>
                  ) : (
                    <span />
                  )}

                  {navigation.next && (
                    <Link
                      href={`/publications/${navigation.next.slug}`}
                      className="card-interactive group p-5 sm:text-right"
                    >
                      <span className="eyebrow flex items-center gap-1 sm:justify-end">
                        Next
                        <Icon name="arrow_forward" size="sm" />
                      </span>
                      <p className="mt-2 text-h6 line-clamp-2 group-hover:text-primary transition-colors">
                        {navigation.next.title}
                      </p>
                    </Link>
                  )}
                </nav>
              )}
            </article>

            {/* ── Aside ────────────────────────────────────────────────── */}
            <aside className="lg:col-span-4">
              <div className="lg:sticky lg:top-28 space-y-8">
                <div className="card p-6">
                  <p className="eyebrow mb-3">Stay informed</p>
                  <p className="text-small text-ink-muted text-pretty mb-4">
                    We email when we publish. No schedule, no filler.
                  </p>
                  <NewsletterForm />
                </div>

                {related.length > 0 && (
                  <div className="card p-6">
                    <p className="eyebrow mb-5">Related reading</p>
                    <div className="space-y-5">
                      {related.map((item) => (
                        <PublicationCard key={item.id} publication={item} variant="compact" />
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-panel panel-dark p-6">
                  <Icon name="balance" className="text-secondary mb-3" />
                  <p className="text-small text-primary-200 text-pretty">
                    This publication is general commentary, not legal advice. For advice on
                    your own circumstances, please get in touch.
                  </p>
                  {/* The same destination as every other "Speak to us":
                      WhatsApp when a number is configured, the contact
                      section otherwise. */}
                  <Link
                    href={chatUrl ?? '/#contactUs'}
                    {...(chatUrl
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                    className="btn btn-sm mt-4 bg-white/10 text-white border border-white/20 hover:bg-white/20"
                  >
                    Speak to our team
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {related.length > 0 && (
          <section className="bg-surface-sunken py-section">
            <div className="shell">
              <Reveal>
                <h2 className="text-h3 mb-10">More from Neoteric LP</h2>
              </Reveal>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {related.map((item, index) => (
                  <Reveal key={item.id} delay={index * 0.08}>
                    <PublicationCard publication={item} />
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer settings={settings} />
    </>
  );
}
