import type { PracticeArea, SiteSettings, TeamMember } from '@/lib/types';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.neotericlp.com.ng';

/**
 * JSON-LD describing the firm.
 *
 * This is the part search engines and assistants actually read when deciding
 * what an organisation *is*. Prose on a page tells a human the firm practises
 * maritime law; `LegalService` with an `areaServed` and a `hasOfferCatalog`
 * tells a machine, which is what gets the firm surfaced for "maritime lawyer
 * Abuja" rather than only for its own name.
 *
 * Emitted once, in the homepage, since it describes the organisation rather
 * than the page. Article-level data lives on the article pages.
 */
export function OrganisationSchema({
  settings,
  practiceAreas,
  team,
}: {
  settings: SiteSettings;
  practiceAreas: PracticeArea[];
  team: TeamMember[];
}) {
  const contact = settings.contact ?? {};
  const social = settings.social ?? {};

  const sameAs = Object.values(social).filter(
    (url): url is string => typeof url === 'string' && url.length > 0,
  );

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['LegalService', 'Organization'],
        '@id': `${SITE}/#organisation`,
        name: 'Neoteric LP',
        alternateName: 'M. A Mustapha & Co.',
        description:
          typeof settings.seo?.description === 'string'
            ? settings.seo.description
            : 'Neoteric LP is a Nigerian law firm providing innovative legal solutions across corporate and commercial law, dispute resolution, property law, energy law and technology law.',
        url: SITE,
        logo: { '@type': 'ImageObject', url: `${SITE}/images/neoteric.svg` },
        image: `${SITE}/images/neotericHor_1200by628.jpg`,
        ...(contact.phone ? { telephone: String(contact.phone) } : {}),
        ...(contact.email ? { email: String(contact.email) } : {}),
        address: {
          '@type': 'PostalAddress',
          streetAddress: [contact.street, contact.area].filter(Boolean).join(', '),
          addressLocality: String(contact.city ?? 'Abuja'),
          addressRegion: String(contact.state ?? 'FCT'),
          addressCountry: 'NG',
        },
        areaServed: { '@type': 'Country', name: 'Nigeria' },
        ...(sameAs.length > 0 ? { sameAs } : {}),
        // The practice areas, in the vocabulary a search engine understands.
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Practice areas',
          itemListElement: practiceAreas.map((area) => ({
            '@type': 'Offer',
            itemOffered: { '@type': 'Service', name: area.name, serviceType: area.name },
          })),
        },
        ...(team.length > 0
          ? {
              employee: team.map((member) => ({
                '@type': 'Person',
                name: member.fullName,
                jobTitle: member.roleTitle,
                ...(member.imageUrl ? { image: `${SITE}${member.imageUrl}` } : {}),
              })),
            }
          : {}),
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        url: SITE,
        name: 'Neoteric LP',
        publisher: { '@id': `${SITE}/#organisation` },
        inLanguage: 'en-NG',
        // Declares the search endpoint, so results can offer a sitelinks box.
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE}/publications?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/** Breadcrumbs, so a result shows a path rather than a bare URL. */
export function BreadcrumbSchema({
  trail,
}: {
  trail: { name: string; path: string }[];
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${SITE}${crumb.path}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/** The publications index as an ItemList, so crawlers see all of them at once. */
export function PublicationListSchema({
  publications,
}: {
  publications: { title: string; slug: string; excerpt: string | null }[];
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'News & Publications — Neoteric LP',
    description:
      'Practical commentary on Nigerian corporate, commercial, property, technology and public law.',
    url: `${SITE}/publications`,
    isPartOf: { '@id': `${SITE}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: publications.length,
      itemListElement: publications.map((publication, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${SITE}/publications/${publication.slug}`,
        name: publication.title,
      })),
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
