import Image from 'next/image';
import { Reveal } from '@/components/ui/Reveal';
import { TiltCard } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import type { TeamMember } from '@/lib/types';

/**
 * Our Team.
 *
 * v1's card is a tall 3:4 portrait on black with a thick bronze underline,
 * desaturated until hover, the name in bronze over a gradient. All of that is
 * kept — it is a good card, and it is the firm's.
 *
 * What is fixed is the layout. My first version shrank these to five per row,
 * which turned a partner's portrait into a thumbnail. They are back to v1's
 * four-up on desktop, two-up on phones, so faces are large enough to read,
 * and the grid is a real grid rather than a flex-wrap that leaves the last
 * row centred and ragged.
 */
export function TeamSection({ team }: { team: TeamMember[] }) {
  if (team.length === 0) return null;

  const legal = team.filter((m) => m.teamGroup === 'legal');
  const support = team.filter((m) => m.teamGroup !== 'legal');

  return (
    <section id="ourTeam" className="bg-surface-sunken py-section scroll-mt-24" aria-labelledby="team-heading">
      <div className="shell">
        <Reveal>
          <div className="text-center">
            <h2 id="team-heading" className="text-balance">Our Team</h2>
            <div className="rule-bronze mx-auto mt-6" />
            <p className="mx-auto mt-6 max-w-2xl text-lead text-ink-muted text-pretty">
              Lawyers and professionals who work closely with clients rather than at a
              distance from them.
            </p>
          </div>
        </Reveal>

        <TeamGrid members={legal} startDelay={0} />

        {support.length > 0 && (
          <>
            <Reveal>
              <p className="eyebrow mt-20 mb-8 text-center">Business &amp; operations</p>
            </Reveal>
            <TeamGrid members={support} startDelay={0.05} />
          </>
        )}
      </div>
    </section>
  );
}

function TeamGrid({ members, startDelay }: { members: TeamMember[]; startDelay: number }) {
  return (
    /*
     * Flex rather than grid, specifically so a short last row centres.
     * CSS grid pins every item to a column track, which left the final two
     * portraits hanging off to the left. Flex with `justify-center` and an
     * explicit basis gives the same 2 / 3 / 4 columns and centres whatever
     * is left over.
     */
    <div className="mt-12 flex flex-wrap justify-center gap-5 md:gap-6">
      {members.map((member, index) => (
        <Reveal
          key={member.id}
          delay={startDelay + Math.min(index * 0.06, 0.36)}
          className="basis-[calc(50%-0.625rem)] md:basis-[calc(33.333%-1rem)] lg:basis-[calc(25%-1.125rem)]"
        >
          <TiltCard intensity={2} className="h-full">
            <article
              className={cn(
                'group relative h-full overflow-hidden rounded-card bg-primary-950',
                // v1's bronze underline, which is what ties the row together.
                'border-b-[6px] border-secondary',
                'shadow-float transition-shadow duration-500 ease-physical hover:shadow-deep',
              )}
            >
              <div className="relative aspect-[3/4] w-full">
                {member.imageUrl ? (
                  <Image
                    src={member.imageUrl}
                    alt={member.fullName}
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className={cn(
                      'object-cover object-top',
                      // Desaturated at rest, full colour on hover — v1's
                      // `saturate-0 group-hover:saturate-100`.
                      'saturate-0 transition-[filter,transform] duration-700 ease-physical',
                      'group-hover:saturate-100 group-hover:scale-[1.04]',
                    )}
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="mono text-h2 text-primary-400">
                      {member.fullName
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')}
                    </span>
                  </div>
                )}

                {/* The gradient the name sits on, so it stays legible over
                    whatever the photograph happens to be doing down there. */}
                <div className="absolute inset-0 bg-gradient-to-t from-primary-950 via-primary-950/55 to-transparent" />
              </div>

              <div className="absolute inset-x-0 bottom-0 p-5">
                <h3 className="text-h6 text-secondary text-balance">{member.fullName}</h3>
                <p className="mt-1 text-small text-primary-100">{member.roleTitle}</p>
              </div>
            </article>
          </TiltCard>
        </Reveal>
      ))}
    </div>
  );
}
