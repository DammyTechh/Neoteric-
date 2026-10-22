import Image from 'next/image';
import { cn } from '@/lib/cn';

/**
 * The palette a generated cover draws from.
 *
 * Four values, all from the teal ramp, with the bronze used only for the
 * lettering. The earlier version cycled six gradients including bronze and
 * mid-teal grounds, which turned an index of legal commentary into a
 * patchwork — the covers competed with each other and with the headlines
 * they were supposed to support.
 *
 * These are deliberately close together. Across a twelve-card grid they read
 * as one considered set rather than as decoration.
 */
const COVER_THEMES = [
  { from: '#0e2425', to: '#061314' },
  { from: '#213f40', to: '#0e2425' },
  { from: '#234b4c', to: '#132829' },
  { from: '#255859', to: '#163334' },
] as const;

/** The bronze is the only accent, and only ever on the lettering. */
const COVER_INK = '#c19766';

/** Stable hash, so one article always gets the same generated cover. */
function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

interface ThumbnailProps {
  src: string | null;
  alt: string | null;
  /** Used to seed the generated cover and to draw the initials. */
  title: string;
  categoryName?: string | null;
  className?: string;
  /** Set on the first few cards above the fold. */
  priority?: boolean;
  sizes?: string;
}

/**
 * The cover image for a publication.
 *
 * Every card on the index carries one. When an article has no uploaded cover —
 * which is true of all 27 pieces carried over from v1 until someone sets one —
 * a cover is generated instead: a brand gradient, the article's initials, and
 * its category.
 *
 * The alternative, an empty grey box or a stock photograph, either makes the
 * index look broken or makes a law firm's publications look like a blog. A
 * generated cover is deterministic, costs no bytes, and looks intentional.
 */
export function Thumbnail({
  src,
  alt,
  title,
  categoryName,
  className,
  priority = false,
  sizes = '(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw',
}: ThumbnailProps) {
  if (src) {
    return (
      <div className={cn('relative overflow-hidden bg-surface-sunken', className)}>
        <Image
          src={src}
          alt={alt ?? ''}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-700 ease-physical group-hover:scale-[1.04]"
        />
        {/* A faint scrim keeps white cover art from blending into the card. */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary-950/20 to-transparent" />
      </div>
    );
  }

  const theme = COVER_THEMES[hashString(title) % COVER_THEMES.length]!;

  const initials = title
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}
      role="img"
      aria-label={alt ?? title}
    >
      {/* Concentric rings, offset to the corner — a quiet motif rather than a
          picture of anything. */}
      <svg
        className="absolute -right-10 -top-10 h-48 w-48 opacity-[0.10]"
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="50" cy="50" r="46" stroke={COVER_INK} strokeWidth="0.6" />
        <circle cx="50" cy="50" r="34" stroke={COVER_INK} strokeWidth="0.6" />
        <circle cx="50" cy="50" r="22" stroke={COVER_INK} strokeWidth="0.6" />
        <circle cx="50" cy="50" r="10" stroke={COVER_INK} strokeWidth="0.6" />
      </svg>

      <div className="absolute inset-0 flex flex-col justify-between p-6">
        <span
          className="mono text-[2.5rem] leading-none font-medium opacity-80"
          style={{ color: COVER_INK }}
        >
          {initials || 'NL'}
        </span>

        {categoryName && (
          <span
            className="text-caption uppercase tracking-[0.14em] font-medium opacity-70"
            style={{ color: COVER_INK }}
          >
            {categoryName}
          </span>
        )}
      </div>
    </div>
  );
}
