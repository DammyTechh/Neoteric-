import { env } from '@shared/config/env';
import { escapeHtml } from '@shared/utils/sanitize';
import {
  BRAND,
  codeBlock,
  detailTable,
  p,
  quoteBlock,
  rawP,
  renderLayout,
  renderPlainText,
} from './layout';

/**
 * Every transactional email the system sends.
 *
 * Each template is a pure function returning `{ subject, html, text }`, which
 * makes them trivially previewable (`npm run mail:preview`) and testable
 * without an SMTP connection anywhere in sight.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const link = (url: string, label: string) =>
  `<a href="${url}" style="color:${BRAND.primary};font-weight:500;">${escapeHtml(label)}</a>`;

const formatDate = (value: Date | string = new Date()) =>
  new Date(value).toLocaleString('en-NG', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  });

// ╭───────────────────────────────────────────────────────────────────────────╮
// │ Admin account lifecycle                                                   │
// ╰───────────────────────────────────────────────────────────────────────────╯

/** Sent to the seeded super-admin once the account exists. */
export function adminWelcome(input: { fullName: string; email: string }): RenderedEmail {
  const heading = 'Your Neoteric LP dashboard is ready';

  return {
    subject: 'Your Neoteric LP admin account is ready',
    html: renderLayout({
      preheader: 'Sign in to manage publications, the team page and site content.',
      heading,
      bodyHtml: [
        p(`Hello ${input.fullName},`),
        p(
          'Your administrator account for the Neoteric LP website has been created. ' +
            'From the dashboard you can publish articles, manage the team and practice ' +
            'areas, review client enquiries and update site content.',
        ),
        detailTable([
          { label: 'Email', value: escapeHtml(input.email) },
          { label: 'Role', value: 'Super administrator' },
          { label: 'Sign-in', value: link(env.ADMIN_URL, 'Open the dashboard') },
        ]),
        p(
          'Use the password you set when the account was seeded. If you did not set one, ' +
            'use the “Forgot password” link on the sign-in page.',
        ),
      ].join(''),
      cta: { label: 'Sign in to the dashboard', url: env.ADMIN_URL },
      footnote:
        'For security, this site has no public registration — accounts are created only by an existing administrator.',
    }),
    text: renderPlainText({
      heading,
      lines: [
        `Hello ${input.fullName},`,
        '',
        'Your administrator account for the Neoteric LP website has been created.',
        '',
        `Email: ${input.email}`,
        'Role: Super administrator',
      ],
      cta: { label: 'Sign in', url: env.ADMIN_URL },
    }),
  };
}

/** Sent when a super-admin adds a colleague, carrying a one-time password. */
export function adminInvite(input: {
  fullName: string;
  email: string;
  temporaryPassword: string;
  invitedBy: string;
  role: string;
}): RenderedEmail {
  const heading = 'You have been added to the Neoteric LP dashboard';

  return {
    subject: 'Your Neoteric LP dashboard access',
    html: renderLayout({
      preheader: 'A temporary password is inside. You will be asked to change it on first sign-in.',
      heading,
      bodyHtml: [
        p(`Hello ${input.fullName},`),
        p(
          `${input.invitedBy} has given you access to the Neoteric LP website dashboard ` +
            `as ${input.role.replace('_', ' ')}.`,
        ),
        detailTable([
          { label: 'Email', value: escapeHtml(input.email) },
          { label: 'Role', value: escapeHtml(input.role.replace('_', ' ')) },
        ]),
        p('Your temporary password is:'),
        codeBlock(input.temporaryPassword),
        p('You will be asked to set your own password the first time you sign in.'),
      ].join(''),
      cta: { label: 'Sign in and set your password', url: env.ADMIN_URL },
      footnote:
        'If you were not expecting this email, please ignore it and let the sender know.',
    }),
    text: renderPlainText({
      heading,
      lines: [
        `Hello ${input.fullName},`,
        '',
        `${input.invitedBy} has given you access to the Neoteric LP dashboard as ${input.role}.`,
        '',
        `Email: ${input.email}`,
        `Temporary password: ${input.temporaryPassword}`,
        '',
        'You will be asked to set your own password on first sign-in.',
      ],
      cta: { label: 'Sign in', url: env.ADMIN_URL },
    }),
  };
}

export function adminPasswordReset(input: {
  fullName: string;
  resetUrl: string;
  expiresInMinutes: number;
}): RenderedEmail {
  const heading = 'Reset your password';

  return {
    subject: 'Reset your Neoteric LP password',
    html: renderLayout({
      preheader: `This link expires in ${input.expiresInMinutes} minutes.`,
      heading,
      bodyHtml: [
        p(`Hello ${input.fullName},`),
        p(
          'We received a request to reset the password on your Neoteric LP dashboard ' +
            'account. Use the button below to choose a new one.',
        ),
        p(`This link expires in ${input.expiresInMinutes} minutes and can be used once.`),
      ].join(''),
      cta: { label: 'Choose a new password', url: input.resetUrl },
      footnote:
        'If you did not request this, no action is needed — your password has not been changed. ' +
        'Any previous reset links have been invalidated.',
    }),
    text: renderPlainText({
      heading,
      lines: [
        `Hello ${input.fullName},`,
        '',
        'We received a request to reset your Neoteric LP dashboard password.',
        `This link expires in ${input.expiresInMinutes} minutes and can be used once.`,
        '',
        'If you did not request this, no action is needed.',
      ],
      cta: { label: 'Reset your password', url: input.resetUrl },
    }),
  };
}

export function adminPasswordChanged(input: {
  fullName: string;
  changedAt?: Date;
  ipAddress?: string | null;
}): RenderedEmail {
  const heading = 'Your password was changed';
  const when = formatDate(input.changedAt);

  return {
    subject: 'Your Neoteric LP password was changed',
    html: renderLayout({
      preheader: 'If this was not you, contact your administrator immediately.',
      heading,
      bodyHtml: [
        p(`Hello ${input.fullName},`),
        p('The password on your Neoteric LP dashboard account has just been changed.'),
        detailTable([
          { label: 'When', value: escapeHtml(when) },
          ...(input.ipAddress
            ? [{ label: 'IP address', value: escapeHtml(input.ipAddress) }]
            : []),
        ]),
        p('All other sessions have been signed out as a precaution.'),
      ].join(''),
      footnote:
        'If you did not make this change, contact your administrator immediately — your account may be compromised.',
    }),
    text: renderPlainText({
      heading,
      lines: [
        `Hello ${input.fullName},`,
        '',
        'The password on your Neoteric LP dashboard account has just been changed.',
        `When: ${when}`,
        ...(input.ipAddress ? [`IP address: ${input.ipAddress}`] : []),
        '',
        'All other sessions have been signed out.',
        'If this was not you, contact your administrator immediately.',
      ],
    }),
  };
}

export function adminLoginAlert(input: {
  fullName: string;
  ipAddress: string | null;
  userAgent: string | null;
  at?: Date;
}): RenderedEmail {
  const heading = 'New sign-in to your account';
  const when = formatDate(input.at);

  return {
    subject: 'New sign-in to your Neoteric LP account',
    html: renderLayout({
      preheader: `Signed in ${when}`,
      heading,
      bodyHtml: [
        p(`Hello ${input.fullName},`),
        p('Your Neoteric LP dashboard account was just signed in to.'),
        detailTable([
          { label: 'When', value: escapeHtml(when) },
          { label: 'IP address', value: escapeHtml(input.ipAddress ?? 'Unknown') },
          { label: 'Device', value: escapeHtml(input.userAgent ?? 'Unknown') },
        ]),
      ].join(''),
      footnote: 'If this was you, nothing further is needed.',
    }),
    text: renderPlainText({
      heading,
      lines: [
        `Hello ${input.fullName},`,
        '',
        'Your Neoteric LP dashboard account was just signed in to.',
        `When: ${when}`,
        `IP address: ${input.ipAddress ?? 'Unknown'}`,
        `Device: ${input.userAgent ?? 'Unknown'}`,
      ],
    }),
  };
}

export function adminAccountDeactivated(input: { fullName: string }): RenderedEmail {
  const heading = 'Your dashboard access has been removed';

  return {
    subject: 'Your Neoteric LP dashboard access has been removed',
    html: renderLayout({
      preheader: 'Your administrator account has been deactivated.',
      heading,
      bodyHtml: [
        p(`Hello ${input.fullName},`),
        p(
          'Your access to the Neoteric LP website dashboard has been deactivated and ' +
            'all active sessions have been signed out.',
        ),
        p('If you believe this is a mistake, please contact the firm directly.'),
      ].join(''),
    }),
    text: renderPlainText({
      heading,
      lines: [
        `Hello ${input.fullName},`,
        '',
        'Your access to the Neoteric LP dashboard has been deactivated.',
        'If you believe this is a mistake, please contact the firm directly.',
      ],
    }),
  };
}

// ╭───────────────────────────────────────────────────────────────────────────╮
// │ Contact enquiries                                                         │
// ╰───────────────────────────────────────────────────────────────────────────╯

/** Lands in the firm's inbox the moment someone submits the contact form. */
export function inquiryAdminNotification(input: {
  reference: string;
  fullName: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  subject?: string | null;
  message: string;
  practiceArea?: string | null;
  submittedAt?: Date;
}): RenderedEmail {
  const heading = 'New enquiry from the website';

  return {
    subject: `New enquiry · ${input.subject || input.fullName} [${input.reference}]`,
    html: renderLayout({
      preheader: `${input.fullName} — ${input.subject ?? 'General enquiry'}`,
      heading,
      bodyHtml: [
        p(`A new enquiry has come in through the website contact form.`),
        detailTable([
          { label: 'Reference', value: escapeHtml(input.reference) },
          { label: 'Name', value: escapeHtml(input.fullName) },
          {
            label: 'Email',
            value: `<a href="mailto:${escapeHtml(input.email)}" style="color:${BRAND.primary};">${escapeHtml(input.email)}</a>`,
          },
          ...(input.phone
            ? [
                {
                  label: 'Phone',
                  value: `<a href="tel:${escapeHtml(input.phone)}" style="color:${BRAND.primary};">${escapeHtml(input.phone)}</a>`,
                },
              ]
            : []),
          ...(input.company ? [{ label: 'Company', value: escapeHtml(input.company) }] : []),
          ...(input.practiceArea
            ? [{ label: 'Practice area', value: escapeHtml(input.practiceArea) }]
            : []),
          ...(input.subject ? [{ label: 'Subject', value: escapeHtml(input.subject) }] : []),
          { label: 'Received', value: escapeHtml(formatDate(input.submittedAt)) },
        ]),
        rawP('<strong style="color:' + BRAND.ink + ';">Message</strong>'),
        quoteBlock(input.message),
      ].join(''),
      cta: { label: 'Open in the dashboard', url: `${env.ADMIN_URL}/inquiries` },
    }),
    text: renderPlainText({
      heading,
      lines: [
        'A new enquiry has come in through the website contact form.',
        '',
        `Reference: ${input.reference}`,
        `Name: ${input.fullName}`,
        `Email: ${input.email}`,
        ...(input.phone ? [`Phone: ${input.phone}`] : []),
        ...(input.company ? [`Company: ${input.company}`] : []),
        ...(input.practiceArea ? [`Practice area: ${input.practiceArea}`] : []),
        ...(input.subject ? [`Subject: ${input.subject}`] : []),
        `Received: ${formatDate(input.submittedAt)}`,
        '',
        'Message:',
        input.message,
      ],
      cta: { label: 'Open in the dashboard', url: `${env.ADMIN_URL}/inquiries` },
    }),
  };
}

/** The automatic "we got it" reply to whoever submitted the form. */
export function inquiryAcknowledgement(input: {
  fullName: string;
  reference: string;
  message: string;
}): RenderedEmail {
  const heading = 'Thank you for contacting Neoteric LP';
  const firstName = input.fullName.split(' ')[0] ?? input.fullName;

  return {
    subject: `We have received your enquiry [${input.reference}]`,
    html: renderLayout({
      preheader: 'Our team will respond shortly. Your reference is inside.',
      heading,
      bodyHtml: [
        p(`Dear ${firstName},`),
        p(
          'Thank you for getting in touch. We have received your enquiry and a member ' +
            'of our team will review it and respond as soon as possible — usually within ' +
            'one working day.',
        ),
        p('Please quote this reference in any follow-up correspondence:'),
        codeBlock(input.reference),
        rawP(`<strong style="color:${BRAND.ink};">What you sent us</strong>`),
        quoteBlock(input.message),
        p(
          'If your matter is urgent, you are welcome to call us on +234 (0) 813-602-2316 ' +
            'during business hours.',
        ),
      ].join(''),
      footnote:
        'This is an automated acknowledgement. Please do not treat it as legal advice or ' +
        'as confirmation that a solicitor–client relationship has been established.',
    }),
    text: renderPlainText({
      heading,
      lines: [
        `Dear ${firstName},`,
        '',
        'Thank you for getting in touch. We have received your enquiry and will respond',
        'as soon as possible, usually within one working day.',
        '',
        `Your reference: ${input.reference}`,
        '',
        'What you sent us:',
        input.message,
        '',
        'If your matter is urgent, call us on +234 (0) 813-602-2316 during business hours.',
        '',
        'This is an automated acknowledgement and is not legal advice.',
      ],
    }),
  };
}

/** A reply written by an administrator from inside the dashboard. */
export function inquiryResponse(input: {
  fullName: string;
  reference: string;
  responseBody: string;
  responderName: string;
}): RenderedEmail {
  const heading = 'A response to your enquiry';
  const firstName = input.fullName.split(' ')[0] ?? input.fullName;

  return {
    subject: `Re: your enquiry [${input.reference}]`,
    html: renderLayout({
      preheader: `A response from ${input.responderName} at Neoteric LP.`,
      heading,
      bodyHtml: [
        p(`Dear ${firstName},`),
        ...input.responseBody
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((paragraph) => p(paragraph.trim())),
        p(`— ${input.responderName}, Neoteric LP`),
      ].join(''),
      footnote: `Your reference: ${escapeHtml(input.reference)}`,
    }),
    text: renderPlainText({
      heading,
      lines: [
        `Dear ${firstName},`,
        '',
        input.responseBody,
        '',
        `— ${input.responderName}, Neoteric LP`,
        '',
        `Your reference: ${input.reference}`,
      ],
    }),
  };
}

// ╭───────────────────────────────────────────────────────────────────────────╮
// │ Newsletter                                                                │
// ╰───────────────────────────────────────────────────────────────────────────╯

export function newsletterConfirm(input: { confirmUrl: string; email: string }): RenderedEmail {
  const heading = 'Confirm your subscription';

  return {
    subject: 'Confirm your subscription to Neoteric LP insights',
    html: renderLayout({
      preheader: 'One click to confirm and start receiving our legal updates.',
      heading,
      bodyHtml: [
        p(
          'Please confirm that you would like to receive legal insights and publications ' +
            'from Neoteric LP. We send a short update whenever we publish something new.',
        ),
        p('You can unsubscribe at any time using the link at the foot of any email.'),
      ].join(''),
      cta: { label: 'Confirm subscription', url: input.confirmUrl },
      footnote: `This confirmation was requested for ${escapeHtml(input.email)}. If that was not you, simply ignore this email — no subscription will be created.`,
    }),
    text: renderPlainText({
      heading,
      lines: [
        'Please confirm that you would like to receive legal insights and publications',
        'from Neoteric LP.',
        '',
        'You can unsubscribe at any time.',
        '',
        `Requested for: ${input.email}`,
        'If that was not you, ignore this email and no subscription will be created.',
      ],
      cta: { label: 'Confirm subscription', url: input.confirmUrl },
    }),
  };
}

export function newsletterWelcome(input: { unsubscribeUrl: string }): RenderedEmail {
  const heading = 'You are subscribed';

  return {
    subject: 'Welcome to Neoteric LP insights',
    html: renderLayout({
      preheader: 'Thank you for subscribing to our legal updates.',
      heading,
      bodyHtml: [
        p('Your subscription is confirmed. Thank you for your interest in our work.'),
        p(
          'You will receive an email whenever we publish a new article — practical ' +
            'commentary on Nigerian corporate, commercial, property, technology and ' +
            'public law. We write when we have something useful to say, not on a schedule.',
        ),
        rawP(
          `In the meantime, our published work is at ${link(`${env.SITE_URL}/publications`, 'News & Publications')}.`,
        ),
      ].join(''),
      cta: { label: 'Browse our publications', url: `${env.SITE_URL}/publications` },
      unsubscribeUrl: input.unsubscribeUrl,
    }),
    text: renderPlainText({
      heading,
      lines: [
        'Your subscription is confirmed. Thank you for your interest in our work.',
        '',
        'You will receive an email whenever we publish a new article.',
      ],
      cta: { label: 'Browse our publications', url: `${env.SITE_URL}/publications` },
      unsubscribeUrl: input.unsubscribeUrl,
    }),
  };
}

/** Announces a newly published article to the mailing list. */
export function newsletterPublication(input: {
  title: string;
  excerpt: string | null;
  slug: string;
  coverImageUrl: string | null;
  categoryName: string | null;
  readingMinutes: number;
  unsubscribeUrl: string;
}): RenderedEmail {
  const articleUrl = `${env.SITE_URL}/publications/${input.slug}`;
  const heading = input.title;

  const cover = input.coverImageUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;">
         <tr><td>
           <a href="${articleUrl}">
             <img src="${escapeHtml(input.coverImageUrl)}" alt="" width="536"
                  style="width:100%;max-width:536px;height:auto;display:block;
                         border-radius:6px;border:1px solid ${BRAND.border};">
           </a>
         </td></tr>
       </table>`
    : '';

  const meta = [input.categoryName, `${input.readingMinutes} min read`]
    .filter(Boolean)
    .join(' · ');

  return {
    subject: `New publication: ${input.title}`,
    html: renderLayout({
      preheader: input.excerpt ?? 'A new publication from Neoteric LP.',
      heading: 'New from Neoteric LP',
      bodyHtml: [
        cover,
        `<p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND.secondary};font-weight:600;">${escapeHtml(meta)}</p>`,
        `<h2 style="margin:0 0 14px;font-size:20px;line-height:1.35;font-weight:600;color:${BRAND.ink};">${escapeHtml(heading)}</h2>`,
        input.excerpt ? p(input.excerpt) : '',
      ].join(''),
      cta: { label: 'Read the full article', url: articleUrl },
      unsubscribeUrl: input.unsubscribeUrl,
    }),
    text: renderPlainText({
      heading: 'New from Neoteric LP',
      lines: [input.title, '', input.excerpt ?? '', '', meta],
      cta: { label: 'Read the full article', url: articleUrl },
      unsubscribeUrl: input.unsubscribeUrl,
    }),
  };
}

/** A free-form campaign composed in the dashboard. */
export function newsletterCampaign(input: {
  subject: string;
  preheader: string | null;
  bodyHtml: string;
  unsubscribeUrl: string;
}): RenderedEmail {
  return {
    subject: input.subject,
    html: renderLayout({
      preheader: input.preheader ?? input.subject,
      heading: input.subject,
      // Already sanitised by the campaign service before it reaches here.
      bodyHtml: input.bodyHtml,
      unsubscribeUrl: input.unsubscribeUrl,
    }),
    text: renderPlainText({
      heading: input.subject,
      lines: [input.bodyHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()],
      unsubscribeUrl: input.unsubscribeUrl,
    }),
  };
}

export function newsletterUnsubscribed(input: { email: string }): RenderedEmail {
  const heading = 'You have been unsubscribed';

  return {
    subject: 'You have been unsubscribed from Neoteric LP insights',
    html: renderLayout({
      preheader: 'You will no longer receive our publication updates.',
      heading,
      bodyHtml: [
        p(
          `${input.email} has been removed from our mailing list. You will not receive ` +
            'further publication updates from us.',
        ),
        rawP(
          `Our published work remains freely available at ${link(`${env.SITE_URL}/publications`, 'News & Publications')}.`,
        ),
        p('If this was a mistake, you are welcome to subscribe again at any time.'),
      ].join(''),
      footnote: 'Thank you for having read our work.',
    }),
    text: renderPlainText({
      heading,
      lines: [
        `${input.email} has been removed from our mailing list.`,
        '',
        `Our published work remains available at ${env.SITE_URL}/publications`,
        '',
        'If this was a mistake, you can subscribe again at any time.',
      ],
    }),
  };
}
