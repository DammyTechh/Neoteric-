import Image from 'next/image';
import { Reveal } from '@/components/ui/Reveal';
import { TiltCard } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { SiteSettings } from '@/lib/types';

/**
 * Used when `about.images` is not set.
 *
 * Ordered on resolution and subject. `img3` leads because it is the only
 * photograph in the folder at a usable size (736×1104 against 375×250 for
 * most of the rest) and the subject — Lady Justice and a gavel in a library —
 * is the strongest of the set. `img5` and `img6` are excluded: bright-blue
 * technology composites that clash with the teal-and-bronze palette and read
 * as clipart beside the photographs.
 */
const FALLBACK_IMAGES = [
  '/images/about/img3.jpg',
  '/images/about/img2.jpg',
  '/images/about/img1.jpg',
  '/images/about/img4.jpg',
];

/**
 * Who We Are — the alternating stack of large images and copy.
 *
 * v1 runs four rows that alternate image and text across a two-column grid.
 * That rhythm is kept, because it is what the firm's readers already know,
 * and the images stay large — they are the section, not decoration beside it.
 *
 * The depth is in how each row sits: the image tilts toward the cursor on its
 * own perspective, a bronze plate floats behind it offset by a few degrees,
 * and the rows alternate which way they lean. The offset plate is what makes
 * a flat photograph read as a physical object rather than a rectangle with a
 * shadow.
 */
export function WhoWeAreSection({ settings }: { settings: SiteSettings }) {
  const about = settings.about ?? {};

  const heading = typeof about.heading === 'string' ? about.heading : 'Who We Are';
  const body = typeof about.body === 'string' ? about.body : '';
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const images = Array.isArray(about.images)
    ? (about.images as string[])
    : FALLBACK_IMAGES;

  if (paragraphs.length === 0) return null;

  return (
    <section id="aboutUs" className="relative py-section scroll-mt-24" aria-labelledby="about-heading">
      <div className="shell">
        <Reveal>
          <h2 id="about-heading" className="text-primary text-balance">
            {heading}
          </h2>
          <div className="rule-bronze mt-6" />
        </Reveal>

        <div className="mt-16 space-y-20 md:space-y-28">
          {paragraphs.map((paragraph, index) => {
            // Rows alternate: text left on even rows, image left on odd ones.
            const imageFirst = index % 2 === 1;
            const image = images[index % images.length];

            return (
              <Reveal key={index} delay={0.05}>
                <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16 lg:gap-20">
                  {/* ── Image ───────────────────────────────────────────── */}
                  <div
                    className={cn(
                      'relative',
                      imageFirst ? 'md:order-1' : 'md:order-2',
                    )}
                  >
                    {/* The floating plate behind the photograph. Bronze on
                        alternating rows, teal otherwise, so the section has
                        a rhythm rather than one repeated flourish. */}
                    <div
                      className={cn(
                        'absolute inset-0 rounded-panel transition-transform duration-700 ease-physical',
                        index % 2 === 0 ? 'bg-secondary/20' : 'bg-primary/15',
                      )}
                      style={{
                        transform: imageFirst
                          ? 'rotate(-2.5deg) translate(-14px, 14px)'
                          : 'rotate(2.5deg) translate(14px, 14px)',
                      }}
                      aria-hidden="true"
                    />

                    <TiltCard intensity={2.5} glare>
                      {/*
                        A 5:4 frame rather than 4:3, and a column that stops at
                        640px. Several of these photographs are only ~390px
                        wide; given the full half-width of a desktop grid they
                        were being blown up past twice their native size, which
                        is what made them look soft. Constrained like this they
                        render close to 1:1.

                        Swap in higher-resolution photography from the
                        dashboard and this frame simply gets sharper — the
                        layout does not need to change.
                      */}
                      <div className="relative mx-auto aspect-[5/4] w-full max-w-[640px] overflow-hidden rounded-panel shadow-deep">
                        {image && (
                          <Image
                            src={image}
                            alt=""
                            fill
                            sizes="(max-width: 768px) 92vw, (max-width: 1280px) 46vw, 560px"
                            quality={90}
                            priority={index === 0}
                            className="object-cover object-center transition-transform duration-700 ease-physical hover:scale-[1.04]"
                          />
                        )}
                      </div>
                    </TiltCard>

                    {/* A small numeral plate, breaking the image edge. */}
                    <div
                      className={cn(
                        'absolute -bottom-5 grid h-14 w-14 place-items-center rounded-card',
                        'bg-primary-950 shadow-deep',
                        imageFirst ? '-right-3 md:-right-5' : '-left-3 md:-left-5',
                      )}
                      aria-hidden="true"
                    >
                      <span className="mono text-h6 font-medium text-secondary">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                  </div>

                  {/* ── Copy ────────────────────────────────────────────── */}
                  <div className={cn(imageFirst ? 'md:order-2' : 'md:order-1')}>
                    <p className="text-lead text-ink-muted text-pretty">{paragraph}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Two standing points, carried from the firm's own description. */}
        <Reveal delay={0.1}>
          <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:gap-6">
            {[
              {
                icon: 'speed',
                label: 'Flexible by design',
                text: 'An alternative model to the traditional firm — a more flexible, cost-effective way to manage legal workloads.',
              },
              {
                icon: 'verified',
                label: 'Current and grounded',
                text: 'Rooted in Nigerian law and regulation, informed by international resources where a matter needs them.',
              },
            ].map((item) => (
              <TiltCard key={item.label} intensity={1.5}>
                <div className="card h-full p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary-50 text-primary">
                    <Icon name={item.icon} />
                  </span>
                  <p className="mt-4 font-medium text-ink">{item.label}</p>
                  <p className="mt-2 text-small text-ink-muted text-pretty">{item.text}</p>
                </div>
              </TiltCard>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
