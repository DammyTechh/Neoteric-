'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { Testimonial } from '@/lib/types';

/**
 * Client testimonials.
 *
 * Renders nothing when there are none — which is the case on a fresh install,
 * because v1's testimonials were five copies of the same lorem-ipsum card and
 * seeding placeholder quotes onto a law firm's site would be worse than an
 * absent section.
 */
export function TestimonialsSection({ testimonials }: { testimonials: Testimonial[] }) {
  const [index, setIndex] = useState(0);

  if (testimonials.length === 0) return null;

  const current = testimonials[index]!;
  const go = (delta: number) =>
    setIndex((value) => (value + delta + testimonials.length) % testimonials.length);

  return (
    <section className="py-section" aria-label="Client testimonials">
      <div className="shell">
        <div className="relative overflow-hidden rounded-panel panel-dark-mark">
          <div className="absolute inset-0 bg-grid" aria-hidden="true" />
          <div
            className="pointer-events-none absolute -left-20 bottom-0 h-80 w-80 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #3a9291, transparent 70%)' }}
            aria-hidden="true"
          />

          <div className="relative grid gap-10 p-8 md:grid-cols-12 md:gap-12 md:p-16">
            <div className="md:col-span-4 flex flex-col">
              <p className="eyebrow mb-4">Testimonials</p>
              <h2 className="text-white text-balance">
                In our clients&rsquo; words
              </h2>

              {testimonials.length > 1 && (
                <div className="mt-8 flex items-center gap-3 md:mt-auto">
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    className="grid h-11 w-11 place-items-center rounded-full border border-white/25 text-white transition-all duration-300 hover:bg-white/15 hover:-translate-y-0.5"
                    aria-label="Previous testimonial"
                  >
                    <Icon name="arrow_back" size="sm" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    className="grid h-11 w-11 place-items-center rounded-full border border-white/25 text-white transition-all duration-300 hover:bg-white/15 hover:-translate-y-0.5"
                    aria-label="Next testimonial"
                  >
                    <Icon name="arrow_forward" size="sm" />
                  </button>

                  <span className="mono text-caption text-primary-300 ml-2">
                    {String(index + 1).padStart(2, '0')} / {String(testimonials.length).padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>

            <div className="md:col-span-8">
              {/* The quote card lifts off the dark panel — the one element in
                  this band that sits nearer the reader. */}
              <figure
                key={current.id}
                className="rounded-panel bg-surface p-8 shadow-deep md:p-10 animate-fade-up"
              >
                <Icon name="format_quote" size="xl" className="text-secondary-300" />

                <blockquote className="mt-4 text-lead text-ink text-pretty">
                  {current.quote}
                </blockquote>

                <figcaption className="mt-8 flex items-center gap-4">
                  {current.authorImageUrl ? (
                    <Image
                      src={current.authorImageUrl}
                      alt=""
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-50 mono text-primary">
                      {current.authorName
                        .split(' ')
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')}
                    </span>
                  )}

                  <div>
                    <p className="font-medium text-ink">{current.authorName}</p>
                    {(current.authorRole || current.authorCompany) && (
                      <p className="text-small text-ink-muted">
                        {[current.authorRole, current.authorCompany].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>

                  {current.rating && (
                    <span className="ml-auto flex gap-0.5" aria-label={`${current.rating} out of 5`}>
                      {Array.from({ length: 5 }, (_, starIndex) => (
                        <Icon
                          key={starIndex}
                          name="star"
                          size="sm"
                          filled={starIndex < current.rating!}
                          className={cn(
                            starIndex < current.rating! ? 'text-secondary' : 'text-surface-line',
                          )}
                        />
                      ))}
                    </span>
                  )}
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
