import type { MetadataRoute } from 'next';
import { apiGetSafe } from '@/lib/api';
import type { PracticeArea, PublicationCategory, TeamMember } from '@/lib/types';

/**
 * The sitemap, generated from the database rather than hand-maintained.
 *
 * Every published article, practice area, industry and team member gets a URL,
 * so a crawler reaches the whole site from one file instead of having to
 * discover it by following links. `lastModified` comes from the row's own
 * timestamp, which is what tells a crawler an article is worth re-reading.
 */
export const revalidate = 3600;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.neotericlp.com.ng';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [publications, categories, practiceAreas, team] = await Promise.all([
    apiGetSafe<{ slug: string; updatedAt: string }[]>('/publications/sitemap', [], {
      revalidate: 3600,
    }),
    apiGetSafe<PublicationCategory[]>('/publications/categories', [], { revalidate: 3600 }),
    apiGetSafe<PracticeArea[]>('/practice-areas', [], { revalidate: 3600 }),
    apiGetSafe<TeamMember[]>('/team', [], { revalidate: 3600 }),
  ]);

  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    {
      url: `${SITE}/publications`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];

  // Articles are the reason anyone finds a law firm through search, so they
  // carry the highest priority after the two landing pages.
  const articlePages: MetadataRoute.Sitemap = publications.map((publication) => ({
    url: `${SITE}/publications/${publication.slug}`,
    lastModified: new Date(publication.updatedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  const categoryPages: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${SITE}/publications?category=${category.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  // Anchors on the homepage: listed so a search engine can deep-link to the
  // section a query actually matched rather than dropping people at the top.
  const sectionPages: MetadataRoute.Sitemap = [
    'aboutUs',
    'achievements',
    'practiceAreas',
    'ourTeam',
    'visionMission',
    'contactUs',
  ].map((anchor) => ({
    url: `${SITE}/#${anchor}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  return [
    ...staticPages,
    ...articlePages,
    ...categoryPages,
    ...sectionPages,
    // Included for completeness; both resolve to homepage sections today.
    ...practiceAreas.map((area) => ({
      url: `${SITE}/#practiceAreas`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    })).slice(0, 1),
    ...team.map(() => ({
      url: `${SITE}/#ourTeam`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    })).slice(0, 1),
  ];
}
