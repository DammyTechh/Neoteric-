'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger, in seconds, for items revealed as a group. */
  delay?: number;
  /** How far the element travels as it arrives. */
  distance?: number;
}

/**
 * Fades and lifts an element into view as it enters the viewport.
 *
 * `IntersectionObserver` rather than a scroll listener: the browser does the
 * work off the main thread, and nothing fires while the element is nowhere
 * near the fold. The observer disconnects after the first intersection — this
 * is an entrance, not a state that should flip back when the reader scrolls up.
 */
export function Reveal({ children, className, delay = 0, distance = 20 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // No motion preference: show it immediately rather than animating.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // Fire slightly before the element reaches the fold, so the animation
      // has finished by the time the reader is actually looking at it.
      { threshold: 0.1, rootMargin: '0px 0px -8% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn('transition-all duration-700 ease-physical', className)}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : `translateY(${distance}px)`,
        transitionDelay: `${delay}s`,
      }}
    >
      {children}
    </div>
  );
}
