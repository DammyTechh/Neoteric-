'use client';

import { useRef, type ReactNode, type MouseEvent } from 'react';
import { cn } from '@/lib/cn';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Maximum rotation in degrees. Kept small — this is a law firm. */
  intensity?: number;
  /** Adds a light sheen that tracks the cursor. */
  glare?: boolean;
}

/**
 * A card that tilts toward the cursor.
 *
 * The rotation is driven by pointer position rather than a fixed hover state,
 * which is what makes it read as an object being looked at rather than an
 * animation being played. Two degrees is the ceiling: past about four it stops
 * looking like depth and starts looking like a gimmick, which is the wrong
 * register for legal publications.
 *
 * Transforms are written straight to the node through a ref. Putting pointer
 * coordinates in React state would re-render the subtree on every mousemove.
 */
export function TiltCard({
  children,
  className,
  intensity = 2,
  glare = false,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node) return;

    // Honour the system preference; no motion means no tilt.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    const rotateY = (x - 0.5) * intensity * 2;
    const rotateX = (0.5 - y) * intensity * 2;

    node.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(8px)`;

    if (glare && glareRef.current) {
      glareRef.current.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.22), transparent 55%)`;
    }
  };

  const handleLeave = () => {
    const node = ref.current;
    if (!node) return;
    node.style.transform = '';
    if (glareRef.current) glareRef.current.style.background = '';
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={cn(
        'relative transition-[transform,box-shadow] duration-300 ease-physical',
        'will-change-transform',
        className,
      )}
    >
      {children}
      {glare && (
        <div
          ref={glareRef}
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  as?: 'div' | 'article' | 'li' | 'section';
}

/** The plain surface card: a white panel, a hairline border, a resting shadow. */
export function Card({ children, className, interactive = false, as = 'div' }: CardProps) {
  const Element = as;
  return (
    <Element className={cn(interactive ? 'card-interactive' : 'card', className)}>
      {children}
    </Element>
  );
}

/**
 * A card that floats above the page.
 *
 * Used sparingly — for the one element in a section that should read as
 * nearer to the reader than everything around it. The gentle vertical drift
 * is what separates "floating" from "has a large shadow".
 */
export function FloatingCard({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={cn('animate-float-slow', className)}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}
