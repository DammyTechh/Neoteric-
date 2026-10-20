/**
 * ╔═════════════════════════════════════════════════════════════════════════╗
 * ║  NEOTERIC LP — BRAND TOKENS (backend mirror)                            ║
 * ╚═════════════════════════════════════════════════════════════════════════╝
 *
 * These values are mirrored from `frontend/src/lib/brand.ts`. They are
 * duplicated rather than imported because the two codebases deploy
 * independently and a shared package would be more machinery than two
 * dozen hex values deserve.
 *
 * **If you change a colour, change it in both files.** The frontend has a
 * check (`npm run brand:check`) that fails when they disagree, so the drift
 * cannot survive a build.
 *
 * Provenance:
 *   primary / secondary — verbatim from v1's `tailwind.config.ts`
 *   ink (#2c2c2c)      — the wordmark colour inside `neoteric.svg`
 *   neutrals           — Tailwind `zinc`, which is what v1 used in practice
 */

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

export const NEUTRAL = {
  /** The logo wordmark colour. */
  ink: '#2c2c2c',
  /** zinc-500 */
  muted: '#71717a',
  /** zinc-400 */
  soft: '#a1a1aa',
  /** zinc-200 */
  line: '#e4e4e7',
  /** zinc-100 */
  sunken: '#f4f4f5',
  white: '#ffffff',
} as const;

/** The flat map the email layout interpolates into inline styles. */
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
