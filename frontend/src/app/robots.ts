import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.neotericlp.com.ng';

/**
 * robots.txt.
 *
 * The AI crawlers are allowed deliberately. A law firm's publications are
 * written to be found and cited; being quotable by an assistant answering
 * "what does Nigerian law say about X" is the modern version of being found
 * in a search result, and blocking those crawlers forfeits it.
 *
 * `/admin` is disallowed, though that is politeness rather than security —
 * the dashboard is behind authentication regardless, and a disallow line is
 * public. It keeps the login page out of search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/api/'],
      },
      // Named explicitly so the permission is unambiguous rather than
      // inherited from the wildcard rule.
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'OAI-SearchBot',
          'ClaudeBot',
          'Claude-Web',
          'anthropic-ai',
          'PerplexityBot',
          'Google-Extended',
          'Applebot-Extended',
          'CCBot',
        ],
        allow: '/',
        disallow: ['/admin', '/admin/'],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
