import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { NewsletterForm } from '@/components/forms/NewsletterForm';
import type { SiteSettings } from '@/lib/types';

const SOCIAL_ICONS: Record<string, string> = {
  facebook: 'public',
  twitter: 'alternate_email',
  instagram: 'photo_camera',
  linkedin: 'work',
};

export function Footer({ settings }: { settings: SiteSettings }) {
  const contact = settings.contact ?? {};
  const social = settings.social ?? {};
  const year = new Date().getFullYear();

  const socialLinks = Object.entries(social)
    .filter(([, url]) => typeof url === 'string' && url.length > 0)
    .map(([key, url]) => ({ key, url: url as string }));

  return (
    <footer className="relative bg-primary-950 text-white overflow-hidden">
      <div className="absolute inset-0 bg-grid" aria-hidden="true" />
      {/* A soft bloom behind the newsletter block, so the dark panel has a
          focal point rather than reading as a flat slab of ink. */}
      <div
        className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #3a9291, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="shell relative py-16 md:py-24">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <Link href="/" className="inline-block mb-6">
              <Logo variant="light" className="h-8 w-auto" />
            </Link>

            <p className="text-primary-200 max-w-sm text-pretty">
              {typeof settings.site?.tagline === 'string'
                ? settings.site.tagline
                : 'Legal Practitioners & Consultants in Nigeria'}
            </p>

            <div className="mt-8">
              <p className="eyebrow mb-3">Publications in your inbox</p>
              <NewsletterForm variant="dark" />
            </div>
          </div>

          <div className="lg:col-span-3 lg:col-start-7">
            <h2 className="eyebrow mb-6">Explore</h2>
            <ul className="space-y-3">
              {[
                { label: 'What we do', href: '/#aboutUs' },
                { label: 'Achievements', href: '/#achievements' },
                { label: 'Practice areas', href: '/#practiceAreas' },
                { label: 'Our Vision & Mission', href: '/#visionMission' },
                { label: 'Our Team', href: '/#ourTeam' },
                { label: 'News & Publications', href: '/publications' },
                { label: 'Contact us', href: '/#contactUs' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-primary-200 hover:text-white transition-colors duration-200 inline-flex items-center gap-2 group"
                  >
                    <span className="h-px w-0 bg-secondary transition-all duration-300 group-hover:w-3" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h2 className="eyebrow mb-6">Find us</h2>

            <address className="not-italic space-y-4 text-primary-200">
              <p className="flex gap-3">
                <Icon name="location_on" size="sm" className="mt-0.5 text-secondary shrink-0" />
                <span>
                  {contact.street}
                  {contact.area ? <>, {contact.area}</> : null}
                  <br />
                  {contact.city}, {contact.state}
                  <br />
                  {contact.country}
                </span>
              </p>

              {contact.phone && (
                <p className="flex gap-3">
                  <Icon name="call" size="sm" className="mt-0.5 text-secondary shrink-0" />
                  <a
                    href={`tel:${String(contact.phone).replace(/[^+\d]/g, '')}`}
                    className="mono hover:text-white transition-colors"
                  >
                    {contact.phone}
                  </a>
                </p>
              )}

              {contact.email && (
                <p className="flex gap-3">
                  <Icon name="mail" size="sm" className="mt-0.5 text-secondary shrink-0" />
                  <a
                    href={`mailto:${contact.email}`}
                    className="hover:text-white transition-colors break-all"
                  >
                    {contact.email}
                  </a>
                </p>
              )}
            </address>

            {socialLinks.length > 0 && (
              <div className="mt-8 flex gap-3">
                {socialLinks.map(({ key, url }) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 text-white transition-all duration-300 ease-physical hover:bg-secondary hover:text-primary-950 hover:-translate-y-1"
                    aria-label={key}
                  >
                    <Icon name={SOCIAL_ICONS[key] ?? 'link'} size="sm" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-16 border-t border-white/10 pt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-small text-primary-300">
            © {year} Neoteric LP. All rights reserved.
          </p>
          <p className="text-caption text-primary-400 max-w-md text-pretty">
            Nothing on this site constitutes legal advice or creates a solicitor–client
            relationship.
          </p>
        </div>
      </div>
    </footer>
  );
}
