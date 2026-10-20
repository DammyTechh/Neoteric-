/**
 * Joins class names, dropping anything falsy.
 *
 * Deliberately not `clsx` + `tailwind-merge`: conflicting Tailwind classes are
 * a sign a component is being overridden rather than composed, and silently
 * merging them hides that. Two small dependencies avoided for a four-line
 * function.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
