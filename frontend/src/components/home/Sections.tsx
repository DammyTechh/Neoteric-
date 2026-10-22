import { Fragment } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';
import { TiltCard } from '@/components/ui/Card';
import { PublicationCard } from '@/components/publications/PublicationCard';
import { cn } from '@/lib/cn';
import type {
  Achievement,
  Publication,
  SiteSettings,
} from '@/lib/types';

/** A section heading, used by every band so they share one rhythm. */
function SectionHead({
  eyebrow,
  title,
  description,
  align = 'left',
  dark = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  dark?: boolean;
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      <p className="eyebrow mb-4">{eyebrow}</p>
      <h2 className={cn('text-balance', dark && 'text-white')}>{title}</h2>
      {description && (
        <p
          className={cn(
            'mt-6 text-lead text-pretty',
            dark ? 'text-primary-200' : 'text-ink-muted',
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}

// ── Achievements ────────────────────────────────────────────────────────────

export function AchievementsBand({ achievements }: { achievements: Achievement[] }) {
  if (achievements.length === 0) return null;

  /**
   * v1's achievements card, matched.
   *
   * A white panel at 10/12 width, centred, pulled up over the hero, with the
   * figures in light bronze separated by hairline rules. The earlier version
   * made it a full-width four-cell grid, which is a different object.
   *
   * The pull-up is smaller than v1's `-mt-[150px]`: the hero carousel's
   * controls sit where v1 had nothing, and 150px put the card straight
   * through them. It is halved again on a phone, where the hero has less
   * height to give away.
   *
   * `HeroCarousel`'s bottom padding must stay larger than this, or the slide
   * rail ends up behind this card.
   */
  return (
    <section
      id="achievements"
      className="shell relative z-10 -mt-12 scroll-mt-28 px-6 md:-mt-24 md:px-8"
      aria-labelledby="achievements-heading"
    >
      <Reveal>
        <div className="mx-auto w-full bg-surface p-8 shadow-deep md:w-10/12 md:p-12">
          <h2
            id="achievements-heading"
            className="text-caption uppercase tracking-[0.4em] text-ink-muted"
          >
            Achievements
          </h2>

          <div className="mt-8 flex flex-col items-stretch gap-y-6 md:flex-row">
            {achievements.map((achievement, index) => (
              <Fragment key={achievement.id}>
                {index > 0 && (
                  <div
                    className="h-px w-full bg-surface-line md:mx-10 md:h-auto md:w-px"
                    aria-hidden="true"
                  />
                )}

                <div className="flex-1">
                  <p className="text-h1 font-light leading-none text-secondary">
                    {achievement.value}
                    {achievement.suffix && (
                      <span className="text-h3">{achievement.suffix}</span>
                    )}
                  </p>
                  <p className="mt-2 font-semibold text-ink">{achievement.label}</p>
                  {achievement.description && (
                    <p className="mt-1 text-small text-ink-muted">{achievement.description}</p>
                  )}
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ── Vision & mission ────────────────────────────────────────────────────────

export function VisionMissionSection({ settings }: { settings: SiteSettings }) {
  const vision = typeof settings.vision?.body === 'string' ? settings.vision.body : '';
  const mission = typeof settings.mission?.body === 'string' ? settings.mission.body : '';

  if (!vision && !mission) return null;

  const panels = [
    { title: 'Our vision', body: vision, icon: 'visibility', accent: 'primary' as const },
    { title: 'Our mission', body: mission, icon: 'flag', accent: 'secondary' as const },
  ].filter((panel) => panel.body);

  /**
   * Two white cards on a light ground.
   *
   * The previous version put this on the dark panel with the brand mark as a
   * background image. At the width of a full-bleed section that mark scaled up
   * until it ran straight through the mission copy — it works on a narrow
   * column, not here. White cards keep the text the brightest thing on the
   * screen, which is what a statement of intent should be, and the depth comes
   * from the cards themselves rather than from anything behind the words.
   */
  return (
    <section id="visionMission" className="py-section scroll-mt-24" aria-labelledby="vision-heading">
      <div className="shell">
        <Reveal>
          <div className="text-center">
            <h2 id="vision-heading" className="text-balance">Vision &amp; Mission</h2>
            <div className="rule-bronze mx-auto mt-6" />
          </div>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:gap-8">
          {panels.map((panel, index) => (
            <Reveal key={panel.title} delay={index * 0.12}>
              <div className="group relative h-full">
                {/* The offset plate that gives the card its depth. */}
                <div
                  className={cn(
                    'absolute inset-0 rounded-panel transition-transform duration-700 ease-physical',
                    panel.accent === 'primary' ? 'bg-primary/15' : 'bg-secondary/25',
                    'group-hover:translate-x-0 group-hover:translate-y-0',
                  )}
                  style={{
                    transform:
                      index === 0
                        ? 'rotate(-1.5deg) translate(-10px, 12px)'
                        : 'rotate(1.5deg) translate(10px, 12px)',
                  }}
                  aria-hidden="true"
                />

                <TiltCard intensity={1.5} className="h-full">
                  <article className="relative h-full overflow-hidden rounded-panel border border-surface-line bg-surface p-8 shadow-deep md:p-10">
                    {/* A quiet corner arc in the accent, well clear of the text. */}
                    <svg
                      className={cn(
                        'pointer-events-none absolute -right-12 -top-12 h-44 w-44',
                        panel.accent === 'primary' ? 'text-primary' : 'text-secondary',
                      )}
                      viewBox="0 0 100 100"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="0.7" opacity="0.18" />
                      <circle cx="50" cy="50" r="34" stroke="currentColor" strokeWidth="0.7" opacity="0.14" />
                      <circle cx="50" cy="50" r="22" stroke="currentColor" strokeWidth="0.7" opacity="0.10" />
                    </svg>

                    <span
                      className={cn(
                        'relative grid h-14 w-14 place-items-center rounded-card shadow-float',
                        'transition-transform duration-500 ease-physical group-hover:-translate-y-1',
                        panel.accent === 'primary'
                          ? 'bg-primary text-white'
                          : 'bg-secondary text-white',
                      )}
                    >
                      <Icon name={panel.icon} size="lg" />
                    </span>

                    <h3 className="relative mt-7 text-h4 font-semibold text-ink">{panel.title}</h3>

                    <p className="relative mt-4 text-lead text-ink-muted text-pretty">
                      {panel.body}
                    </p>
                  </article>
                </TiltCard>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Latest publications ─────────────────────────────────────────────────────

export function PublicationsSection({ publications }: { publications: Publication[] }) {
  if (publications.length === 0) return null;

  const [lead, ...rest] = publications;

  return (
    <section id="news" className="py-section scroll-mt-24">
      <div className="shell">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHead
              eyebrow="News & publications"
              title="What we are writing about"
              description="Practical commentary on Nigerian corporate, commercial, property, technology and public law."
            />
            <Link href="/publications" className="btn-ghost shrink-0">
              All publications
              <Icon name="arrow_forward" size="sm" />
            </Link>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-12">
          {lead && (
            <Reveal className="lg:col-span-7">
              <PublicationCard publication={lead} variant="feature" priority />
            </Reveal>
          )}

          <div className="lg:col-span-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-1 lg:content-start">
            {rest.slice(0, 3).map((publication, index) => (
              <Reveal key={publication.id} delay={0.08 * (index + 1)}>
                <PublicationCard publication={publication} variant="compact" />
              </Reveal>
            ))}
          </div>
        </div>

        {rest.length > 3 && (
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {rest.slice(3, 7).map((publication, index) => (
              <Reveal key={publication.id} delay={Math.min(index * 0.06, 0.24)}>
                <PublicationCard publication={publication} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
