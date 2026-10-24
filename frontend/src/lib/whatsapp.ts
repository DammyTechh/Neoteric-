import type { SiteSettings } from './types';

/**
 * Where the "Speak to us" buttons go.
 *
 * The number is a site setting, so the firm changes it from the dashboard
 * without a deploy. It is stored the way a person reads it — `+234 701 576
 * 2269` — because that is what someone editing it expects to see, and the
 * digits are extracted here.
 *
 * `wa.me` wants the number in full international form with no `+`, no spaces
 * and no leading zero. A Nigerian number written locally as `0701 576 2269`
 * is the same number as `+234 701 576 2269`, so a leading zero is swapped for
 * the country code rather than being sent to WhatsApp as-is, which would
 * produce a dead link.
 */

/** The country code assumed when a number is written in local form. */
const DEFAULT_COUNTRY_CODE = '234';

export function toWhatsAppNumber(
  raw: string | null | undefined,
  countryCode = DEFAULT_COUNTRY_CODE,
): string | null {
  if (!raw) return null;

  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  // `00234…` is the other way of writing `+234…`.
  if (digits.startsWith('00')) digits = digits.slice(2);

  // A local number: `0701…` means `234701…`, not `234` + `0701`.
  if (digits.startsWith('0')) digits = countryCode + digits.slice(1);

  // Written without any country code at all.
  if (!digits.startsWith(countryCode) && digits.length <= 10) {
    digits = countryCode + digits;
  }

  // Too short to be a real number; better no link than a broken one.
  return digits.length >= 10 ? digits : null;
}

/**
 * Builds the full chat link, or null when no usable number is configured.
 *
 * Returning null rather than a fallback is deliberate: a "Speak to us" button
 * that opens an empty WhatsApp, or one belonging to nobody, is worse than a
 * button that quietly falls back to the contact form on the page.
 */
export function whatsAppLink(settings: SiteSettings | undefined): string | null {
  const contact = settings?.contact ?? {};

  const number = toWhatsAppNumber(
    typeof contact.whatsapp === 'string' ? contact.whatsapp : null,
  );
  if (!number) return null;

  const message =
    typeof contact.whatsapp_message === 'string' ? contact.whatsapp_message.trim() : '';

  return message
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${number}`;
}
