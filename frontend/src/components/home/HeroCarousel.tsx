'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { Industry, SiteSettings } from '@/lib/types';

const SLIDE_MS = 6000;

/**
 * The hero: a rotating showcase of the firm's industries.
 *
 * Structurally the same idea as v1 — full-bleed industry photograph, the
 * "Our Industries" eyebrow, the industry name in bronze, its description —
 * and the same carousel library, so the behaviour the firm already knows is
 * preserved.
 *
 * What is new is the handling. v1 cut between static images; this one holds a
 * slow Ken Burns push on the active slide, staggers the copy in beneath it,
 * and runs a progress bar that shows how long is left before the next turn.
 * The numbered rail doubles as navigation, so the carousel can be driven
 * rather than only watched — the single biggest complaint about autoplaying
 * heroes is that they move on before you have finished reading.
 */
export function HeroCarousel({
  industries,
  settings,
}: {
  industries: Industry[];
  settings: SiteSettings;
}) {
  const autoplay = useRef(
    Autoplay({
      delay: SLIDE_MS,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
      playOnInit: true,
    }),
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'center', containScroll: 'keepSnaps', duration: 32 },
    [autoplay.current],
  );

  const [selected, setSelected] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
    setProgress(0);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect).on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect).off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  /**
   * Drives the progress bar.
   *
   * Read from a rAF loop against a timestamp rather than an interval that
   * increments a counter: an interval drifts when the tab is backgrounded and
   * the bar ends up out of step with the slide it is describing.
   */
  useEffect(() => {
    if (paused) return;

    let frame = 0;
    const started = performance.now();

    const tick = (now: number) => {
      setProgress(Math.min((now - started) / SLIDE_MS, 1));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [selected, paused]);

  if (industries.length === 0) return null;

  const hero = settings.hero ?? {};
  const ctaLabel = typeof hero.cta_label === 'string' ? hero.cta_label : 'Speak to our team';

  return (
    <section
      className="relative isolate h-[86vh] min-h-[560px] max-h-[920px] overflow-hidden bg-primary-950 text-white"
      aria-roledescription="carousel"
      aria-label="Industries we serve"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* The page's single h1 lives here, independent of which slide shows. */}
      <h1 className="sr-only">
        Neoteric LP — Legal Practitioners and Consultants in Nigeria
      </h1>

      <div className="h-full overflow-hidden" ref={emblaRef}>
        <div className="flex h-full touch-pan-y">
          {industries.map((industry, index) => {
            const active = index === selected;

            return (
              <div
                key={industry.id}
                className="relative h-full min-w-0 flex-[0_0_100%]"
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${industries.length}: ${industry.name}`}
              >
                {industry.imageUrl && (
                  <Image
                    src={industry.imageUrl}
                    alt=""
                    fill
                    priority={index === 0}
                    sizes="100vw"
                    // A slow push on the active slide only. Scaling every
                    // slide at once would composite eleven layers each frame.
                    className={cn(
                      'object-cover object-center transition-transform ease-linear',
                      active ? 'scale-110 duration-[9000ms]' : 'scale-100 duration-0',
                    )}
                  />
                )}

                {/* Two scrims: one along the reading edge for contrast, one
                    overall to sit the photograph inside the brand palette. */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary-950 via-primary-950/80 to-primary-950/20" />
                <div className="absolute inset-0 bg-primary-950/35 mix-blend-multiply" />

                <div className="relative h-full shell flex items-center">
                  <div className="max-w-xl pb-24 md:pb-20">
                    <p
                      className={cn(
                        'eyebrow mb-5 transition-all duration-700 ease-physical',
                        active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
                      )}
                    >
                      Our industries
                    </p>

                    <p
                      className={cn(
                        'text-h1 font-semibold text-secondary text-balance',
                        'transition-all duration-700 delay-100 ease-physical',
                        active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
                      )}
                    >
                      {industry.name}
                    </p>

                    {industry.description && (
                      <p
                        className={cn(
                          'mt-6 text-lead text-primary-100 text-pretty',
                          'transition-all duration-700 delay-200 ease-physical',
                          active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
                        )}
                      >
                        {industry.description}
                      </p>
                    )}

                    <div
                      className={cn(
                        'mt-10 flex flex-col sm:flex-row gap-4',
                        'transition-all duration-700 delay-300 ease-physical',
                        active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
                      )}
                    >
                      <Link href="/#contact" className="btn-secondary">
                        <Icon name="forum" size="sm" />
                        {ctaLabel}
                      </Link>
                      <Link
                        href="/#practice-areas"
                        className="btn border border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:-translate-y-0.5"
                      >
                        Our practice areas
                        <Icon name="arrow_forward" size="sm" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      {/*
        The achievements band below is pulled up over the hero by -3rem, so the
        controls reserve more than that in bottom padding. Without it the arrows
        sit underneath the first stat card on desktop.
      */}
      <div className="absolute inset-x-0 bottom-0 z-10">
        <div className="shell pb-20 md:pb-24">
          <div className="flex items-end justify-between gap-6">
            {/* The rail: one tick per industry, the active one widened and
                carrying its own progress. Readable at a glance as "4 of 11". */}
            <div className="flex items-end gap-2 overflow-x-auto no-scrollbar py-1">
              {industries.map((industry, index) => {
                const active = index === selected;

                return (
                  <button
                    key={industry.id}
                    type="button"
                    onClick={() => emblaApi?.scrollTo(index)}
                    className="group shrink-0 text-left"
                    aria-label={`Show ${industry.name}`}
                    aria-current={active}
                  >
                    <span
                      className={cn(
                        'block h-1 rounded-full overflow-hidden transition-all duration-500 ease-physical',
                        active ? 'w-16 bg-white/25' : 'w-6 bg-white/25 group-hover:bg-white/45',
                      )}
                    >
                      {active && (
                        <span
                          className="block h-full bg-secondary"
                          style={{ width: `${progress * 100}%` }}
                        />
                      )}
                    </span>

                    <span
                      className={cn(
                        'mt-2 block text-caption uppercase tracking-[0.1em] transition-all duration-500',
                        active
                          ? 'opacity-100 text-white'
                          : 'opacity-0 w-0 overflow-hidden group-hover:opacity-60 group-hover:w-auto text-primary-200',
                      )}
                    >
                      {active ? industry.name : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="hidden shrink-0 items-center gap-3 sm:flex">
              <span className="mono text-caption text-primary-300">
                {String(selected + 1).padStart(2, '0')}
                <span className="mx-1 opacity-50">/</span>
                {String(industries.length).padStart(2, '0')}
              </span>

              <button
                type="button"
                onClick={() => emblaApi?.scrollPrev()}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-white transition-all duration-300 hover:bg-white/15 hover:-translate-y-0.5"
                aria-label="Previous industry"
              >
                <Icon name="arrow_back" size="sm" />
              </button>
              <button
                type="button"
                onClick={() => emblaApi?.scrollNext()}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-white transition-all duration-300 hover:bg-white/15 hover:-translate-y-0.5"
                aria-label="Next industry"
              >
                <Icon name="arrow_forward" size="sm" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
