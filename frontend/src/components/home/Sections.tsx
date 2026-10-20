import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';
import { TiltCard } from '@/components/ui/Card';
import { PublicationCard } from '@/components/publications/PublicationCard';
import { cn } from '@/lib/cn';
import type {
  Achievement,
  PracticeArea,
  Publication,
  SiteSettings,
  TeamMember,
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
    <section className="shell -mt-12 relative z-10" aria-label="Our record">
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

// ── About ───────────────────────────────────────────────────────────────────

export function AboutSection({ settings }: { settings: SiteSettings }) {
  const about = settings.about ?? {};
  const body = typeof about.body === 'string' ? about.body : '';
  const paragraphs = body.split(/\n{2,}/).filter(Boolean);

  return (
    <section id="about" className="shell py-section scroll-mt-24">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16 items-start">
        <div className="lg:col-span-5">
          <Reveal>
            <SectionHead
              eyebrow="What we do"
              title={typeof about.heading === 'string' ? about.heading : 'What we do'}
            />
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-10 relative">
              <TiltCard intensity={1.5}>
                <div className="relative aspect-[4/5] overflow-hidden rounded-panel shadow-lift">
                  <Image
                    src="/images/about/img4.jpg"
                    alt="Neoteric LP at work"
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover"
                  />
                </div>
              </TiltCard>

              {/* A small card breaking the image edge — the depth cue that
                  makes the composition read as layered rather than flat. */}
              <div className="absolute -bottom-6 -right-4 sm:-right-8 w-48 rounded-card bg-primary-950 p-5 shadow-deep">
                <Icon name="balance" className="text-secondary mb-2" />
                <p className="text-small text-white text-pretty">
                  Technology-led practice, traditional professional standards.
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="lg:col-span-6 lg:col-start-7 lg:pt-8">
          {paragraphs.map((paragraph, index) => (
            <Reveal key={index} delay={index * 0.08}>
              <p className="text-lead text-ink-muted text-pretty mb-6">{paragraph}</p>
            </Reveal>
          ))}

          <Reveal delay={0.2}>
            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              {[
                { icon: 'speed', label: 'Responsive', text: 'Flexible, cost-effective handling of legal workloads.' },
                { icon: 'verified', label: 'Current', text: 'Grounded in Nigerian law, informed by international practice.' },
              ].map((item) => (
                <div key={item.label} className="card p-5">
                  <Icon name={item.icon} className="text-primary mb-3" />
                  <p className="font-medium text-ink">{item.label}</p>
                  <p className="mt-1 text-small text-ink-muted text-pretty">{item.text}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ── Practice areas ──────────────────────────────────────────────────────────

const PRACTICE_ICONS: Record<string, string> = {
  'corporate-and-commercial-law': 'corporate_fare',
  'entertainment-law': 'theater_comedy',
  'legal-consulting': 'support_agent',
  'property-law': 'home_work',
  'energy-oil-and-gas-law': 'bolt',
  'space-law': 'rocket_launch',
  'technology-law': 'memory',
  'sports-law': 'sports_soccer',
  'maritime-law': 'sailing',
  'public-and-political-law': 'account_balance',
  'dispute-resolution': 'gavel',
  'mergers-and-acquisitions': 'handshake',
  'medical-law': 'medical_services',
};

export function PracticeAreasSection({ practiceAreas }: { practiceAreas: PracticeArea[] }) {
  if (practiceAreas.length === 0) return null;

  return (
    <section id="practice-areas" className="bg-surface-sunken py-section scroll-mt-24">
      <div className="shell">
        <Reveal>
          <SectionHead
            eyebrow="Practice areas"
            title="The law we practise"
            description="Thirteen areas of practice, from corporate and commercial work through to space and sports law."
          />
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {practiceAreas.map((area, index) => (
            <Reveal key={area.id} delay={Math.min(index * 0.04, 0.3)}>
              <TiltCard className="h-full" intensity={2.5}>
                <article className="card-interactive group h-full p-6 flex flex-col">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary-50 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-white">
                    <Icon name={PRACTICE_ICONS[area.slug] ?? 'gavel'} />
                  </span>

                  <h3 className="mt-5 text-h6 text-balance group-hover:text-primary transition-colors">
                    {area.name}
                  </h3>

                  {area.summary && (
                    <p className="mt-2 text-small text-ink-muted line-clamp-3 text-pretty">
                      {area.summary}
                    </p>
                  )}
                </article>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Vision & mission ────────────────────────────────────────────────────────

export function VisionMissionSection({ settings }: { settings: SiteSettings }) {
  const vision = typeof settings.vision?.body === 'string' ? settings.vision.body : '';
  const mission = typeof settings.mission?.body === 'string' ? settings.mission.body : '';

  if (!vision && !mission) return null;

  return (
    <section id="vision" className="shell py-section scroll-mt-24">
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

// ── Team ────────────────────────────────────────────────────────────────────

export function TeamSection({ team }: { team: TeamMember[] }) {
  if (team.length === 0) return null;

  const legal = team.filter((member) => member.teamGroup === 'legal');
  const support = team.filter((member) => member.teamGroup !== 'legal');

  const renderMember = (member: TeamMember, index: number) => (
    <Reveal key={member.id} delay={Math.min(index * 0.05, 0.3)}>
      <TiltCard intensity={2}>
        <article className="card-interactive group overflow-hidden">
          <div className="relative aspect-[4/5] overflow-hidden bg-primary-950">
            {member.imageUrl ? (
              <Image
                src={member.imageUrl}
                alt={member.fullName}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 20vw"
                className="object-cover object-top transition-transform duration-700 ease-physical group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center">
                <span className="mono text-h2 text-primary-400">
                  {member.fullName
                    .split(' ')
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join('')}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-primary-950/80 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 p-4">
              <h3 className="text-h6 text-white text-balance">{member.fullName}</h3>
              <p className="mt-1 text-caption uppercase tracking-[0.12em] text-secondary-300">
                {member.roleTitle}
              </p>
            </div>
          </div>
        </article>
      </TiltCard>
    </Reveal>
  );

  return (
    <section id="team" className="bg-surface-sunken py-section scroll-mt-24">
      <div className="shell">
        <Reveal>
          <SectionHead
            eyebrow="Our team"
            title="The people behind the practice"
            description="Lawyers and professionals who work closely with clients rather than at a distance from them."
          />
        </Reveal>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-5">
          {legal.map(renderMember)}
        </div>

        {support.length > 0 && (
          <>
            <Reveal>
              <p className="eyebrow mt-16 mb-6">Business & operations</p>
            </Reveal>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-5">
              {support.map(renderMember)}
            </div>
          </>
        )}
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
