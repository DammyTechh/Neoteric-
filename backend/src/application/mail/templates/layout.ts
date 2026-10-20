import { env } from '@shared/config/env';
import { escapeHtml } from '@shared/utils/sanitize';

/**
 * The shell every transactional email is rendered into.
 *
 * Email clients are a hostile rendering target: Outlook uses Word's engine,
 * Gmail strips <style> blocks in some contexts, and almost nothing supports
 * flexbox. So this is table-based, inline-styled, and built on web-safe fonts
 * — Archivo is used on the website but will not load in most mail clients, so
 * the stack degrades to Helvetica/Arial rather than pretending otherwise.
 */

export { BRAND } from './brand';
import { BRAND } from './brand';

const FONT_STACK = "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO_STACK = "'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace";

export interface LayoutOptions {
  /** Shown in the inbox preview line, after the subject. */
  preheader: string;
  heading: string;
  /** Pre-rendered, already-escaped HTML for the message body. */
  bodyHtml: string;
  cta?: { label: string; url: string };
  /** Small print under the main body, above the footer rule. */
  footnote?: string;
  /** Appended to the footer — the newsletter unsubscribe line, for instance. */
  unsubscribeUrl?: string;
}

/** A paragraph in the body copy. Escapes its input. */
export const p = (text: string): string =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND.body};">${escapeHtml(text)}</p>`;

/** A paragraph that trusts its input — for copy with inline links. */
export const rawP = (html: string): string =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND.body};">${html}</p>`;

/** Key/value rows — contact-form details, account summaries. */
export const detailTable = (rows: { label: string; value: string }[]): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="margin:0 0 24px;border:1px solid ${BRAND.border};border-radius:6px;border-collapse:separate;">
    ${rows
      .map(
        (row, index) => `
      <tr>
        <td style="padding:12px 16px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;
                   color:${BRAND.muted};width:38%;vertical-align:top;
                   ${index > 0 ? `border-top:1px solid ${BRAND.border};` : ''}">
          ${escapeHtml(row.label)}
        </td>
        <td style="padding:12px 16px;font-size:15px;line-height:1.5;color:${BRAND.ink};
                   ${index > 0 ? `border-top:1px solid ${BRAND.border};` : ''}">
          ${row.value}
        </td>
      </tr>`,
      )
      .join('')}
  </table>`;

/** A quoted block — the body of a client's message, for example. */
export const quoteBlock = (text: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="margin:0 0 24px;">
    <tr>
      <td style="padding:16px 20px;background:${BRAND.secondaryLight};
                 border-left:3px solid ${BRAND.secondary};border-radius:0 6px 6px 0;
                 font-size:15px;line-height:1.65;color:${BRAND.ink};white-space:pre-wrap;">
        ${escapeHtml(text)}
      </td>
    </tr>
  </table>`;

/** A one-time code or reference, set in the monospace face. */
export const codeBlock = (code: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="margin:0 0 24px;">
    <tr>
      <td align="center" style="padding:18px;background:${BRAND.primaryLight};border-radius:6px;
                 font-family:${MONO_STACK};font-size:22px;letter-spacing:0.16em;
                 color:${BRAND.primaryDark};font-weight:600;">
        ${escapeHtml(code)}
      </td>
    </tr>
  </table>`;

const button = (label: string, url: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
    <tr>
      <td align="center" bgcolor="${BRAND.primary}" style="border-radius:4px;">
        <a href="${url}"
           style="display:inline-block;padding:13px 28px;font-family:${FONT_STACK};
                  font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;
                  border-radius:4px;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;

export function renderLayout(options: LayoutOptions): string {
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<title>${escapeHtml(options.heading)}</title>
<!--[if mso]>
<style>body,table,td,a{font-family:Arial,Helvetica,sans-serif !important;}</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas};">

  <!-- Inbox preview text, hidden in the rendered message. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${escapeHtml(options.preheader)}
    ${'&#8199;&#65279;&#847;'.repeat(60)}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="background:${BRAND.canvas};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="max-width:600px;background:${BRAND.surface};border-radius:8px;
                      overflow:hidden;border:1px solid ${BRAND.border};">

          <!-- Masthead -->
          <tr>
            <td style="padding:28px 32px;background:${BRAND.primary};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="font-family:${FONT_STACK};font-size:20px;font-weight:700;
                                 color:#ffffff;letter-spacing:-0.01em;">
                      Neoteric&nbsp;LP
                    </span>
                  </td>
                  <td align="right">
                    <span style="font-family:${FONT_STACK};font-size:11px;font-weight:500;
                                 color:${BRAND.primaryLight};letter-spacing:0.14em;
                                 text-transform:uppercase;">
                      Legal Practitioners
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- A thin bronze rule: the one brand flourish. -->
          <tr><td style="height:3px;background:${BRAND.secondary};line-height:3px;font-size:0;">&nbsp;</td></tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 8px;font-family:${FONT_STACK};">
              <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;font-weight:600;
                         color:${BRAND.ink};letter-spacing:-0.01em;">
                ${escapeHtml(options.heading)}
              </h1>
              ${options.bodyHtml}
              ${options.cta ? button(options.cta.label, options.cta.url) : ''}
              ${
                options.footnote
                  ? `<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${BRAND.muted};">
                       ${options.footnote}
                     </p>`
                  : ''
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px 32px;font-family:${FONT_STACK};">
              <div style="border-top:1px solid ${BRAND.border};padding-top:20px;">
                <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:${BRAND.muted};">
                  <strong style="color:${BRAND.body};font-weight:600;">Neoteric LP</strong><br>
                  J10B, Zik Sunday Close, SunnyVale Estate, Lokogoma, Abuja, FCT, Nigeria
                </p>
                <p style="margin:0 0 14px;font-size:13px;color:${BRAND.muted};">
                  <a href="${env.SITE_URL}" style="color:${BRAND.primary};text-decoration:none;">
                    neotericlp.com.ng
                  </a>
                </p>
                <p style="margin:0;font-size:11px;line-height:1.6;color:${BRAND.muted};">
                  © ${year} Neoteric LP. All rights reserved.
                  ${
                    options.unsubscribeUrl
                      ? `<br><a href="${options.unsubscribeUrl}"
                             style="color:${BRAND.muted};text-decoration:underline;">
                             Unsubscribe from these updates
                           </a>`
                      : ''
                  }
                </p>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Plain-text alternative.
 *
 * Worth sending properly rather than as an afterthought: it is what spam
 * filters read, and what a screen reader or a watch notification falls back to.
 */
export function renderPlainText(options: {
  heading: string;
  lines: string[];
  cta?: { label: string; url: string };
  unsubscribeUrl?: string;
}): string {
  const parts = [
    options.heading,
    '='.repeat(Math.min(options.heading.length, 60)),
    '',
    ...options.lines,
  ];

  if (options.cta) {
    parts.push('', `${options.cta.label}: ${options.cta.url}`);
  }

  parts.push(
    '',
    '—',
    'Neoteric LP',
    'J10B, Zik Sunday Close, SunnyVale Estate, Lokogoma, Abuja, FCT, Nigeria',
    env.SITE_URL,
  );

  if (options.unsubscribeUrl) {
    parts.push('', `Unsubscribe: ${options.unsubscribeUrl}`);
  }

  return parts.join('\n');
}
