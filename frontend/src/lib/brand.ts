/**
 * ╔═════════════════════════════════════════════════════════════════════════╗
 * ║  NEOTERIC LP — BRAND TOKENS · SINGLE SOURCE OF TRUTH                    ║
 * ╚═════════════════════════════════════════════════════════════════════════╝
 *
 * Every colour in v2 comes from here, on both sides of the stack. The same
 * values are mirrored in `backend/src/application/mail/templates/brand.ts`,
 * so an email and a web page cannot drift apart — which is exactly what had
 * happened before this file existed.
 *
 * Provenance of each value, so nothing here is a matter of taste:
 *
 *   primary / secondary  — copied verbatim from v1's `tailwind.config.ts`.
 *                          All 24 ramp values byte-identical. Not adjusted.
 *
 *   ink (#2c2c2c)        — taken from the wordmark in `neoteric.svg`. The
 *                          logo is the authoritative statement of the firm's
 *                          text colour, so the site's body text matches it
 *                          rather than using an invented near-black.
 *
 *   neutrals             — Tailwind's `zinc`, which is what v1 used in
 *                          practice (`text-zinc-500`, `border-zinc-200`,
 *                          `bg-zinc-900`). Kept rather than replaced with a
 *                          warm grey of our own.
 */

/** Deep teal. The firm's primary colour. From v1. */
export const PRIMARY = {
  DEFAULT: '#255859',
  50: '#f3faf9',
  100: '#d7f0ed',
  200: '#afe0dc',
  300: '#7fc9c5',
  400: '#54adab',
  500: '#3a9291',
  600: '#2d7374',
  700: '#255859',
  800: '#234b4c',
  900: '#213f40',
  950: '#0e2425',
} as const;

/** Bronze. The firm's accent, and the accent inside the logo. From v1. */
export const SECONDARY = {
  DEFAULT: '#c19766',
  50: '#f8f4ee',
  100: '#eee4d3',
  200: '#dec9aa',
  300: '#caa87a',
  400: '#c19766',
  500: '#ab7947',
  600: '#935f3b',
  700: '#764832',
  800: '#643d2f',
  900: '#56352d',
  950: '#311b17',
} as const;

/**
 * Neutrals — Tailwind `zinc`, as v1 used.
 *
 * `ink` is the exception: it is the logo's own `#2c2c2c` rather than
 * `zinc-900`, because the wordmark defines the brand's text colour.
 */
export const NEUTRAL = {
  /** The logo wordmark colour. Body text and headings. */
  ink: '#2c2c2c',
  /** zinc-500 — secondary text, exactly as v1's `text-zinc-500`. */
  muted: '#71717a',
  /** zinc-400 — metadata, captions. */
  soft: '#a1a1aa',
  /** zinc-200 — hairline borders, as v1's `border-zinc-200`. */
  line: '#e4e4e7',
  /** zinc-100 — sunken panels. */
  sunken: '#f4f4f5',
  white: '#ffffff',
} as const;

/** Flat map for email templates, which cannot use Tailwind classes. */
export const BRAND = {
  primary: PRIMARY.DEFAULT,
  primaryDark: PRIMARY[950],
  primaryLight: PRIMARY[100],
  secondary: SECONDARY.DEFAULT,
  secondaryLight: SECONDARY[50],
  ink: NEUTRAL.ink,
  body: NEUTRAL.muted,
  muted: NEUTRAL.soft,
  border: NEUTRAL.line,
  surface: NEUTRAL.white,
  canvas: NEUTRAL.sunken,
} as const;

/** The spacing scale. Every gap in the design is one of these. */
export const SPACING = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const;
