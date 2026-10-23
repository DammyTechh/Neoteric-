import Image from 'next/image';
import { Reveal } from '@/components/ui/Reveal';
import { TiltCard } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { toParagraphs } from '@/lib/paragraphs';
import type { SiteSettings } from '@/lib/types';

/**
 * Used when `about.images` is not set.
 *
 * Chosen by subject, so the picture argues the paragraph beside it: Lady
 * Justice for who the firm is, the gavel and signed agreement for how it
 * works, the team at the table for its advisory practice, and a lawyer with
 * a client for the closing paragraph about being close to them.
 *
 * These are repaired copies of the firm's originals, which were 375–396px on
 * the long edge and flat — `scripts/enhance-about-images.py` recovers the
 * contrast and resamples them, which is as far as the source allows. Better
 * photography uploaded through the media library replaces them with no code
 * change. The blue technology composites in the folder are left out: they
 * read as clipart beside real photographs.
 */
const FALLBACK_IMAGES = [
  '/images/about/about-1.jpg',
  '/images/about/about-2.jpg',
  '/images/about/about-3.jpg',
  '/images/about/about-4.jpg',
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

  /*
   * `about.body` is an array of paragraphs, but it has also been a string with
   * blank lines, and — when a newline was lost between the SQL editor and the
   * database — one unbroken blob. Reading it with `toParagraphs` means the
   * section renders four rows in every one of those cases instead of
   * collapsing the whole thing onto one.
   */
  const paragraphs = toParagraphs(about.body);

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
                {/* Stretch rather than centre: a short paragraph next to a tall
                      photograph leaves the card floating in the middle of the
                      row, which reads as unfinished. Equal heights, with the
                      copy centred inside its own card. */}
                <div className="grid gap-10 md:grid-cols-2 md:items-stretch md:gap-16 lg:gap-20">
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
                  </div>

                  {/* ── Copy ──────────────────────────────────────────────
                      A card that lifts on approach, so the words sit on the
                      page as an object rather than floating loose beside a
                      full-bleed photograph. The depth is restrained on
                      purpose: a wide tint behind it, a hairline border, and a
                      tilt of barely a degree. Enough to read as physical, not
                      enough to turn a law firm's description of itself into a
                      toy. */}
                  <div
                    className={cn(
                      'relative',
                      imageFirst ? 'md:order-2' : 'md:order-1',
                    )}
                  >
                    {/* The plate behind the card, leaning the opposite way to
                        the photograph's so the pair reads as one spread. */}
                    <div
                      className={cn(
                        'absolute inset-0 rounded-panel transition-transform duration-700 ease-physical',
                        index % 2 === 0 ? 'bg-primary/10' : 'bg-secondary/15',
                      )}
                      style={{
                        transform: imageFirst
                          ? 'rotate(1.5deg) translate(10px, 10px)'
                          : 'rotate(-1.5deg) translate(-10px, 10px)',
                      }}
                      aria-hidden="true"
                    />

                    <TiltCard intensity={1.5} className="h-full">
                      <div
                        className={cn(
                          'group/card relative flex h-full flex-col justify-center',
                          'overflow-hidden rounded-panel',
                          'border border-surface-line bg-surface p-8 md:p-10',
                          'shadow-float transition-shadow duration-700 ease-physical',
                          'hover:shadow-deep',
                        )}
                      >
                        {/* A wash that warms as the card is approached. */}
                        <div
                          className={cn(
                            'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700',
                            'group-hover/card:opacity-100',
                            index % 2 === 0
                              ? 'bg-gradient-to-br from-secondary/[0.06] to-transparent'
                              : 'bg-gradient-to-br from-primary/[0.06] to-transparent',
                          )}
                          aria-hidden="true"
                        />

                        {/* The index, set large and light — a numeral the eye
                            can use to count the four without reading them. */}
                        <div className="relative flex items-baseline gap-4">
                          <span
                            className={cn(
                              'mono text-h3 font-light leading-none',
                              index % 2 === 0 ? 'text-secondary/35' : 'text-primary/30',
                            )}
                          >
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span
                            className={cn(
                              'h-px flex-1 origin-left transition-transform duration-700 ease-physical',
                              'scale-x-50 group-hover/card:scale-x-100',
                              index % 2 === 0 ? 'bg-secondary/40' : 'bg-primary/35',
                            )}
                            aria-hidden="true"
                          />
                        </div>

                        <p className="relative mt-6 text-lead leading-relaxed text-ink/85 text-pretty">
                          {paragraph}
                        </p>
                      </div>
                    </TiltCard>
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
