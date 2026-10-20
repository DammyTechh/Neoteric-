import sanitizeHtml from 'sanitize-html';

/**
 * Article bodies arrive as HTML from the dashboard's rich-text editor, which
 * means they are untrusted input that will later be rendered into other
 * people's browsers. Everything is stripped back to a known-good allow-list.
 */
const ARTICLE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr', 'div', 'span',
    'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub', 'mark',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    '*': ['class', 'id'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan', 'scope'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  // Every outbound link opens safely, whatever the editor pasted in.
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        ...(attribs.href && !attribs.href.startsWith('#')
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : {}),
      },
    }),
  },
  disallowedTagsMode: 'discard',
};

/** Sanitised rich text, safe to render. */
export function sanitizeArticleHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const clean = sanitizeHtml(html, ARTICLE_OPTIONS).trim();
  return clean.length > 0 ? clean : null;
}

/**
 * All markup removed — for excerpts, previews and plain-text email bodies.
 *
 * Block-level tags become a space before they are stripped. Without that,
 * `<h2>Title</h2><p>Body</p>` collapses to `TitleBody`, which then shows up
 * run together in every excerpt and every plain-text email.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';

  const spaced = html.replace(
    /<\/(h[1-6]|p|div|li|tr|blockquote|figcaption|td|th)\s*>|<br\s*\/?>/gi,
    ' ',
  );

  return sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
}

/** HTML-escape a value being interpolated into an email template. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** First `maxLength` characters of the body, cut at a word boundary. */
export function deriveExcerpt(html: string | null | undefined, maxLength = 200): string | null {
  const text = stripHtml(html);
  if (!text) return null;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).replace(/\s+\S*$/, '')}…`;
}

