import Image from 'next/image';
import { cn } from '@/lib/cn';

/**
 * The firm's logo.
 *
 * `neoteric.svg` is the horizontal wordmark as supplied — a `#2c2c2c`
 * wordmark with a `#c19766` bronze accent. It is rendered as an image rather
 * than inlined so the artwork stays byte-identical to the file the firm owns;
 * hand-converting it to JSX would mean every future revision needs
 * re-converting, and a mark that drifts from the brand asset is worse than an
 * extra request.
 *
 * On dark grounds the wordmark would disappear, so `variant="light"` inverts
 * it with a filter. That keeps the bronze accent readable while lifting the
 * charcoal to near-white, which a simple `brightness(0) invert(1)` would
 * flatten away.
 */
export function Logo({
  variant = 'dark',
  className,
  priority = false,
}: {
  /** `dark` for light backgrounds, `light` for the teal ground. */
  variant?: 'dark' | 'light';
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/images/neoteric.svg"
      alt="Neoteric LP"
      width={230}
      height={60}
      priority={priority}
      /*
       * `unoptimized` keeps the SVG a vector all the way to the browser.
       * Routed through the image optimiser it is rasterised at a fixed width
       * and then scaled, which is what made the wordmark look soft.
       */
      unoptimized
      className={cn(
        'h-auto w-auto transition-[filter] duration-500',
        // Lifts the charcoal wordmark to white and keeps the bronze warm.
        variant === 'light' && 'brightness-0 invert',
        className,
      )}
    />
  );
}

/**
 * The bronze mark on its own, without the wordmark.
 *
 * For square contexts — the dashboard rail, a favicon-sized slot, the footer
 * badge — where the full horizontal logo would be illegibly small.
 */
export function LogoMark({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/images/neoteric-icon.svg"
      alt=""
      width={40}
      height={40}
      priority={priority}
      unoptimized
      aria-hidden="true"
      className={cn('h-auto w-auto', className)}
    />
  );
}
