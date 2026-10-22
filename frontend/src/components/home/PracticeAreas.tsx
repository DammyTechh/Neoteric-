'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { PracticeArea } from '@/lib/types';

/**
 * Practice Areas — the dark band with circular portraits, as on the live site.
 *
 * v1's version is a deep teal panel carrying a slider of circular images with
 * white rings. That composition is kept exactly; what changes is how it moves.
 * The discs now sit on a shared perspective, so the active one lifts toward
 * the reader while its neighbours sit back — which is the 3D float asked for,
 * built from the slider that already existed rather than bolted beside it.
 */
export function PracticeAreasSection({ practiceAreas }: { practiceAreas: PracticeArea[] }) {
  const autoplay = useRef(
    Autoplay({ delay: 3200, stopOnInteraction: false, stopOnMouseEnter: true }),
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: 'start',
      containScroll: 'trimSnaps',
      dragFree: true,
      duration: 26,
    },
    [autoplay.current],
  );

  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (emblaApi) setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect).on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect).off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  if (practiceAreas.length === 0) return null;

  return (
    <section
      id="practiceAreas"
      className="relative overflow-hidden bg-primary-950 py-section text-white scroll-mt-24"
      aria-labelledby="practice-areas-heading"
    >
      <div className="absolute inset-0 bg-grid" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -right-24 top-10 h-96 w-96 rounded-full opacity-[0.18] blur-3xl"
        style={{ background: 'radial-gradient(circle, #c19766, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative">
        <div className="shell">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 id="practice-areas-heading" className="text-white text-balance">
                Practice Areas
              </h2>
              <p className="mt-4 max-w-xl text-primary-200 text-pretty">
                Thirteen areas of practice, from corporate and commercial work through
                to space and sports law.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="mono text-caption text-primary-300">
                {String(selected + 1).padStart(2, '0')}
                <span className="mx-1 opacity-50">/</span>
                {String(practiceAreas.length).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={() => emblaApi?.scrollPrev()}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/25 text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/15"
                aria-label="Previous practice areas"
              >
                <Icon name="arrow_back" size="sm" />
              </button>
              <button
                type="button"
                onClick={() => emblaApi?.scrollNext()}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/25 text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/15"
                aria-label="Next practice areas"
              >
                <Icon name="arrow_forward" size="sm" />
              </button>
            </div>
          </div>
        </div>

        {/* Full-bleed track: the discs run to the edge of the viewport, so the
            band reads as continuing past the fold rather than stopping dead. */}
        <div className="mt-12 overflow-hidden px-6 md:px-8" ref={emblaRef}>
          <div
            className="flex touch-pan-y gap-6 md:gap-10"
            style={{ perspective: '1400px' }}
          >
            {practiceAreas.map((area, index) => {
              const active = index === selected;

              return (
                <article
                  key={area.id}
                  className="group min-w-0 flex-[0_0_9.5rem] text-center md:flex-[0_0_14rem]"
                >
                  <div
                    className={cn(
                      'mx-auto aspect-square w-[7rem] md:w-[9rem]',
                      'overflow-hidden rounded-full border-4 border-white bg-primary-50',
                      'transition-[transform,box-shadow,border-color] duration-500 ease-physical',
                      'will-change-transform',
                      active
                        ? 'shadow-deep'
                        : 'shadow-float opacity-80 group-hover:opacity-100',
                    )}
                    style={{
                      // The active disc floats forward; the rest sit back and
                      // tilt very slightly away, which is what reads as depth.
                      transform: active
                        ? 'translateZ(60px) translateY(-10px)'
                        : 'translateZ(0) rotateY(-6deg)',
                    }}
                  >
                    {area.imageUrl && (
                      <Image
                        src={area.imageUrl}
                        alt={area.name}
                        width={400}
                        height={400}
                        sizes="(max-width: 768px) 112px, 144px"
                        className={cn(
                          'h-full w-full object-cover object-center',
                          'transition-[transform,filter] duration-700 ease-physical',
                          active ? 'scale-105 saturate-100' : 'saturate-[0.55]',
                          'group-hover:scale-105 group-hover:saturate-100',
                        )}
                      />
                    )}
                  </div>

                  <h3
                    className={cn(
                      'mt-5 text-h6 text-balance transition-colors duration-500',
                      active ? 'text-white' : 'text-primary-200',
                    )}
                  >
                    {area.name}
                  </h3>
                </article>
              );
            })}
          </div>
        </div>

        {/* A progress rail rather than dots: thirteen dots is clutter. */}
        <div className="shell mt-10">
          <div className="h-px w-full bg-white/15">
            <div
              className="h-px bg-secondary transition-[width] duration-500 ease-physical"
              style={{ width: `${((selected + 1) / practiceAreas.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
