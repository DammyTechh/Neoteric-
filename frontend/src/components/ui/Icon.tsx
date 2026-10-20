import { cn } from '@/lib/cn';

export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

interface IconProps {
  /** A Material Symbols name, e.g. `arrow_forward`. See fonts.google.com/icons. */
  name: string;
  size?: IconSize;
  filled?: boolean;
  className?: string;
}

const SIZES: Record<IconSize, string> = {
  sm: 'icon-sm',
  md: '',
  lg: 'icon-lg',
  xl: 'icon-xl',
};

/**
 * A Material Symbols icon.
 *
 * The glyph is selected by the ligature in the element's text, which is why
 * the name goes in the body rather than in a prop that maps to an SVG. The
 * icon is marked `aria-hidden` because it is decoration — the accessible name
 * belongs on the control that contains it.
 */
export function Icon({ name, size = 'md', filled = false, className }: IconProps) {
  return (
    <span
      className={cn('icon', SIZES[size], filled && 'icon-filled', className)}
      aria-hidden="true"
      translate="no"
    >
      {name}
    </span>
  );
}
