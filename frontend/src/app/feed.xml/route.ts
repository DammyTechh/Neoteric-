import { apiGetSafe } from '@/lib/api';
import type { Publication } from '@/lib/types';

/**
 * An RSS feed of the publications.
 *
 * Still the most reliable way for an aggregator, a newsreader or a crawler to
 * discover new articles without polling the HTML. It costs one route and it
 * is how a legal-commentary site gets picked up by the places that index
 * legal commentary.
 */
export const revalidate = 3600;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.neotericlp.com.ng';

/** XML has five characters that must never appear raw in a document. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(): Promise<Response> {
  const { items } = await apiGetSafe<{ items: Publication[] }>(
    '/publications',
    { items: [] },
    { params: { limit: 50 }, revalidate: 3600 },
  ).then((data) => ({ items: Array.isArray(data) ? data : (data.items ?? []) }));

  const entries = items
    .map((publication) => {
      const url = `${SITE}/publications/${publication.slug}`;
      const published = publication.publishedAt
        ? new Date(publication.publishedAt).toUTCString()
        : new Date().toUTCString();

      return `    <item>
      <title>${escapeXml(publication.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${published}</pubDate>
      <dc:creator>${escapeXml(publication.authorName)}</dc:creator>
      ${publication.category ? `<category>${escapeXml(publication.category.name)}</category>` : ''}
      <description>${escapeXml(publication.excerpt ?? publication.title)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Neoteric LP — News &amp; Publications</title>
    <link>${SITE}/publications</link>
    <description>Practical commentary on Nigerian corporate, commercial, property, technology and public law from Neoteric LP.</description>
    <language>en-NG</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
${entries}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
