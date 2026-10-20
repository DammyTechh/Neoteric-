import type { Config } from 'tailwindcss';
import { NEUTRAL, PRIMARY, SECONDARY } from './src/lib/brand';

/**
 * Neoteric LP design tokens.
 *
 * The palette is carried over unchanged from v1 — deep teal `#255859` and
 * bronze `#c19766`, with their full 50–950 ramps. Nothing about the brand
 * changes in v2; what changes is the depth and structure built on top of it.
 *
 * The spacing scale is deliberately short. Every gap in the design is 4, 8,
 * 12, 16, 24, 32, 48, 64 or 96 — Tailwind's 1/2/3/4/6/8/12/16/24. Nothing in
 * between is used, which is most of why a layout reads as deliberate rather
 * than assembled.
 */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        /**
         * Sourced from `src/lib/brand.ts`, which the backend's email
         * templates mirror. Declaring the values in one place is what stops
         * a web page and an email from drifting apart.
         */
        primary: PRIMARY,
        secondary: SECONDARY,

        ink: {
          DEFAULT: NEUTRAL.ink,
          muted: NEUTRAL.muted,
          soft: NEUTRAL.soft,
        },
        surface: {
          DEFAULT: NEUTRAL.white,
          sunken: NEUTRAL.sunken,
          raised: NEUTRAL.white,
          line: NEUTRAL.line,
        },
      },

      fontFamily: {
        sans: ['var(--font-archivo)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        // A modular scale, clamped so it reflows without a media query.
        caption: ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.08em' }],
        small: ['0.8125rem', { lineHeight: '1.55' }],
        base: ['0.9375rem', { lineHeight: '1.65' }],
        lead: ['1.0625rem', { lineHeight: '1.65' }],
        h6: ['1.0625rem', { lineHeight: '1.4', letterSpacing: '-0.01em' }],
        h5: ['clamp(1.125rem, 1rem + 0.5vw, 1.3125rem)', { lineHeight: '1.35' }],
        h4: ['clamp(1.3125rem, 1.1rem + 0.9vw, 1.625rem)', { lineHeight: '1.3' }],
        h3: ['clamp(1.625rem, 1.3rem + 1.4vw, 2.125rem)', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
        h2: ['clamp(2rem, 1.5rem + 2.2vw, 2.875rem)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        h1: ['clamp(2.5rem, 1.8rem + 3.4vw, 4rem)', { lineHeight: '1.06', letterSpacing: '-0.03em' }],
        display: ['clamp(3rem, 2rem + 5vw, 5.5rem)', { lineHeight: '0.98', letterSpacing: '-0.04em' }],
      },

      /**
       * The depth system.
       *
       * Each level is two shadows: a tight contact shadow that anchors the
       * element to the surface, and a wide soft one that lifts it. One shadow
       * alone reads as a drop shadow; two read as an object in a room — which
       * is what makes this feel dimensional without any literal 3D.
       *
       * Tinted with the brand teal rather than pure black, so shadows sit in
       * the palette instead of greying it.
       */
      boxShadow: {
        rest: '0 1px 2px rgba(14, 36, 37, 0.04), 0 2px 8px rgba(14, 36, 37, 0.04)',
        float: '0 2px 4px rgba(14, 36, 37, 0.05), 0 8px 24px rgba(14, 36, 37, 0.07)',
        lift: '0 4px 8px rgba(14, 36, 37, 0.06), 0 16px 40px rgba(14, 36, 37, 0.11)',
        deep: '0 8px 16px rgba(14, 36, 37, 0.08), 0 32px 64px rgba(14, 36, 37, 0.14)',
        /** For panels on the dark teal ground, where a shadow would vanish. */
        inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
        ring: '0 0 0 1px rgba(37, 88, 89, 0.08)',
      },

      borderRadius: {
        card: '0.75rem',
        panel: '1rem',
      },

      spacing: {
        section: 'clamp(4rem, 8vw, 8rem)',
      },

      maxWidth: {
        reading: '68ch',
        shell: '90rem',
      },

      transitionTimingFunction: {
        // A gentle overshoot — enough to feel physical, not enough to bounce.
        physical: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },

      keyframes: {
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },

      animation: {
        'float-slow': 'float-slow 7s ease-in-out infinite',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
