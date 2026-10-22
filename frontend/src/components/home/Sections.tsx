import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';
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

  return (
    <section id="achievements" className="shell -mt-12 relative z-10 scroll-mt-24" aria-label="Our record">
      <Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-panel bg-surface-line shadow-lift">
          {achievements.map((achievement) => (
            <div
              key={achievement.id}
              className="group bg-surface p-6 md:p-8 transition-colors duration-300 hover:bg-primary-50"
            >
              <p className="mono text-h2 font-medium leading-none text-secondary">
                {achievement.value}
                {achievement.suffix && (
                  <span className="text-h4 text-secondary-400">{achievement.suffix}</span>
                )}
              </p>
              <p className="mt-3 text-small font-medium text-ink">{achievement.label}</p>
              {achievement.description && (
                <p className="mt-2 text-caption text-ink-soft">{achievement.description}</p>
              )}
            </div>
          ))}
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

  return (
    <section id="visionMission" className="shell py-section scroll-mt-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-panel panel-dark-mark">
          <div className="absolute inset-0 bg-grid" aria-hidden="true" />
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-25 blur-3xl"
            style={{ background: 'radial-gradient(circle, #c19766, transparent 70%)' }}
            aria-hidden="true"
          />

          <div className="relative p-8 md:p-16">
            <p className="eyebrow mb-10">Vision & mission</p>

            <div className="grid gap-12 md:grid-cols-2 md:gap-16">
              {[
                { title: 'Our vision', body: vision, icon: 'visibility' },
                { title: 'Our mission', body: mission, icon: 'flag' },
              ]
                .filter((item) => item.body)
                .map((item, index) => (
                  <Reveal key={item.title} delay={index * 0.12}>
                    <div>
                      <span className="grid h-12 w-12 place-items-center rounded-lg bg-white/10 text-secondary mb-6">
                        <Icon name={item.icon} size="lg" />
                      </span>
                      <h3 className="text-h4 text-white mb-4">{item.title}</h3>
                      <p className="text-primary-200 text-pretty">{item.body}</p>
                    </div>
                  </Reveal>
                ))}
            </div>
          </div>
        </div>
      </Reveal>
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
