/**
 * Renders every email template to HTML files you can open in a browser.
 *
 *   npm run mail:preview
 *
 * Email templates are notoriously hard to get right and easy to break without
 * noticing. Being able to look at all of them in two seconds, without sending
 * anything, is the difference between checking them and hoping.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as templates from '@application/mail/templates';
import { BRAND } from '@application/mail/templates/layout';

/* eslint-disable no-console */

const OUT_DIR = path.resolve(process.cwd(), '.mail-preview');

const SAMPLES: Record<string, templates.RenderedEmail> = {
  'admin-welcome': templates.adminWelcome({
    fullName: 'Moyosore A. Mustapha',
    email: 'admin@neotericlp.com.ng',
  }),

  'admin-invite': templates.adminInvite({
    fullName: 'Adachukwu Okoh',
    email: 'adachukwu@neotericlp.com.ng',
    temporaryPassword: 'Kf3mQp7xRt2wNbVz',
    invitedBy: 'Moyosore A. Mustapha',
    role: 'admin',
  }),

  'admin-password-reset': templates.adminPasswordReset({
    fullName: 'Moyosore A. Mustapha',
    resetUrl: 'https://www.neotericlp.com.ng/admin/reset-password?token=sample',
    expiresInMinutes: 30,
  }),

  'admin-password-changed': templates.adminPasswordChanged({
    fullName: 'Moyosore A. Mustapha',
    ipAddress: '102.89.33.17',
  }),

  'admin-login-alert': templates.adminLoginAlert({
    fullName: 'Moyosore A. Mustapha',
    ipAddress: '102.89.33.17',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0',
  }),

  'admin-account-deactivated': templates.adminAccountDeactivated({
    fullName: 'Daramola Joshua',
  }),

  'inquiry-admin-notification': templates.inquiryAdminNotification({
    reference: 'NLP-2026-0042',
    fullName: 'Chinedu Okafor',
    email: 'chinedu.okafor@example.com',
    phone: '+234 802 555 0191',
    company: 'Harbourline Logistics Ltd',
    subject: 'Due diligence on a Lekki property purchase',
    practiceArea: 'Property Law',
    message:
      'Good afternoon,\n\nI am purchasing a property in Lekki Phase 1 and my bank has asked ' +
      'for a title verification report before releasing the mortgage. The vendor has ' +
      'produced a Governor’s Consent but I am told the survey plan may not be ' +
      'registered.\n\nCould you advise on scope and timelines?\n\nRegards,\nChinedu',
  }),

  'inquiry-acknowledgement': templates.inquiryAcknowledgement({
    fullName: 'Chinedu Okafor',
    reference: 'NLP-2026-0042',
    message:
      'I am purchasing a property in Lekki Phase 1 and my bank has asked for a title ' +
      'verification report before releasing the mortgage.',
  }),

  'inquiry-response': templates.inquiryResponse({
    fullName: 'Chinedu Okafor',
    reference: 'NLP-2026-0042',
    responderName: 'Oseluese E. Odianosen',
    responseBody:
      'Thank you for your enquiry.\n\nA title verification of this kind usually takes five ' +
      'to seven working days, covering a search at the Lands Registry, confirmation of the ' +
      'Governor’s Consent chain, and a check on whether the survey plan is registered.\n\n' +
      'I have attached our standard scope and fee note. If it suits, I can arrange a call ' +
      'this week.',
  }),

  'newsletter-confirm': templates.newsletterConfirm({
    confirmUrl: 'https://www.neotericlp.com.ng/newsletter/confirm?token=sample',
    email: 'reader@example.com',
  }),

  'newsletter-welcome': templates.newsletterWelcome({
    unsubscribeUrl: 'https://www.neotericlp.com.ng/newsletter/unsubscribe?token=sample',
  }),

  'newsletter-publication': templates.newsletterPublication({
    title:
      'Due Diligence in Nigerian Real Estate: A Safeguard for Diaspora Buyers and Institutional Lenders',
    excerpt:
      'For Nigerians abroad purchasing property back home, and for banks and financiers ' +
      'taking land as security, due diligence is the difference between an asset and a liability.',
    slug: 'due-diligence-in-nigerian-real-estate',
    coverImageUrl: null,
    categoryName: 'Property & Real Estate',
    readingMinutes: 7,
    unsubscribeUrl: 'https://www.neotericlp.com.ng/newsletter/unsubscribe?token=sample',
  }),

  'newsletter-unsubscribed': templates.newsletterUnsubscribed({
    email: 'reader@example.com',
  }),
};

/** A small index page so all of them can be flipped through in one tab. */
function buildIndex(names: string[]): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Neoteric LP · email previews</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; font-family: 'Archivo', Helvetica, Arial, sans-serif;
         background:${BRAND.canvas}; color:${BRAND.ink}; display:flex; height:100vh; }
  aside { width:280px; background:#fff; border-right:1px solid ${BRAND.border};
          overflow-y:auto; flex-shrink:0; }
  header { padding:20px 20px 16px; background:${BRAND.primary}; color:#fff; }
  header h1 { margin:0; font-size:16px; font-weight:600; }
  header p { margin:4px 0 0; font-size:12px; color:${BRAND.primaryLight}; }
  nav a { display:block; padding:11px 20px; font-size:13px; color:${BRAND.body};
          text-decoration:none; border-bottom:1px solid ${BRAND.border}; }
  nav a:hover { background:${BRAND.secondaryLight}; color:${BRAND.primary}; }
  main { flex:1; }
  iframe { width:100%; height:100%; border:0; }
</style></head>
<body>
  <aside>
    <header><h1>Email templates</h1><p>${names.length} transactional emails</p></header>
    <nav>
      ${names.map((name) => `<a href="${name}.html" target="preview">${name.replace(/-/g, ' ')}</a>`).join('\n      ')}
    </nav>
  </aside>
  <main><iframe name="preview" src="${names[0]}.html"></iframe></main>
</body></html>`;
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  const names = Object.keys(SAMPLES);

  for (const [name, email] of Object.entries(SAMPLES)) {
    await writeFile(path.join(OUT_DIR, `${name}.html`), email.html, 'utf8');
    await writeFile(path.join(OUT_DIR, `${name}.txt`), email.text, 'utf8');
  }

  await writeFile(path.join(OUT_DIR, 'index.html'), buildIndex(names), 'utf8');

  console.log(`\nRendered ${names.length} templates to ${OUT_DIR}`);
  console.log(`Open ${path.join(OUT_DIR, 'index.html')}\n`);

  for (const name of names) {
    console.log(`  · ${name}  ${SAMPLES[name]!.subject}`);
  }
  console.log();
}

void main();
