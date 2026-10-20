import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';
import { ContactForm } from '@/components/forms/ContactForm';
import type { PracticeArea, SiteSettings } from '@/lib/types';

export function ContactSection({
  settings,
  practiceAreas,
}: {
  settings: SiteSettings;
  practiceAreas: PracticeArea[];
}) {
  const contact = settings.contact ?? {};

  const details = [
    {
      icon: 'location_on',
      label: 'Office',
      value: [contact.street, contact.area, contact.city, contact.state, contact.country]
        .filter(Boolean)
        .join(', '),
      href: null,
    },
    {
      icon: 'call',
      label: 'Telephone',
      value: contact.phone as string | undefined,
      href: contact.phone ? `tel:${String(contact.phone).replace(/[^+\d]/g, '')}` : null,
      mono: true,
    },
    {
      icon: 'mail',
      label: 'Email',
      value: contact.email as string | undefined,
      href: contact.email ? `mailto:${contact.email}` : null,
    },
  ].filter((item) => item.value);

  return (
    <section id="contact" className="bg-surface-sunken py-section scroll-mt-24">
      <div className="shell">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="eyebrow mb-4">Contact us</p>
              <h2 className="text-balance">Tell us about your matter</h2>
              <p className="mt-6 text-lead text-ink-muted text-pretty">
                Send us a note and a member of our team will respond, usually within one
                working day. Every enquiry gets a reference you can quote.
              </p>
            </Reveal>

            <div className="mt-10 space-y-4">
              {details.map((detail, index) => (
                <Reveal key={detail.label} delay={0.08 * index}>
                  <div className="card p-5 flex gap-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary">
                      <Icon name={detail.icon} size="sm" />
                    </span>
                    <div className="min-w-0">
                      <p className="eyebrow mb-1">{detail.label}</p>
                      {detail.href ? (
                        <a
                          href={detail.href}
                          className={`text-ink hover:text-primary transition-colors break-words ${detail.mono ? 'mono' : ''}`}
                        >
                          {detail.value}
                        </a>
                      ) : (
                        <p className="text-ink text-pretty">{detail.value}</p>
                      )}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7">
            <Reveal delay={0.1}>
              <ContactForm practiceAreas={practiceAreas} />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
