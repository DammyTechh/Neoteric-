'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/cn';

/**
 * The navigation, with v1's exact labels and order.
 *
 * Taken from the live site rather than paraphrased: returning visitors look
 * for "Our Vision & Mission", not "Vision". "News" points at the publications
 * page, which is the one thing v2 moved off the homepage.
 */
const NAV_LINKS = [
  { label: 'What we do', href: '/#aboutUs' },
  { label: 'Achievements', href: '/#achievements' },
  { label: 'Our Vision & Mission', href: '/#visionMission' },
  { label: 'News', href: '/publications' },
  { label: 'Our Team', href: '/#ourTeam' },
  { label: 'Contact us', href: '/#contactUs' },
] as const;

/**
 * The site header.
 *
 * Transparent over the hero and solid once the reader has scrolled past it,
 * which keeps the hero uninterrupted without losing the navigation. The
 * threshold is deliberately low — the switch should happen as soon as content
 * would otherwise slide under glass, not halfway down the page.
 */
export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Only the homepage has a hero to sit over; everywhere else starts solid.
  const overHero = pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // A route change should never leave the mobile menu hanging open.
  useEffect(() => setMenuOpen(false), [pathname]);

  // Stop the page scrolling behind the open menu.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const solid = scrolled || !overHero || menuOpen;

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-physical',
          solid
            ? 'bg-surface/85 backdrop-blur-xl shadow-float border-b border-surface-line'
            : 'bg-transparent',
        )}
      >
        <div className="shell flex h-20 md:h-24 items-center justify-between gap-6">
          <Link
            href="/"
            className="shrink-0"
            aria-label="Neoteric LP — home"
          >
            <Logo
              variant={solid ? 'dark' : 'light'}
              priority
              className="h-10 md:h-12 w-auto"
            />
          </Link>

          <nav className="hidden lg:flex items-center gap-7 xl:gap-9" aria-label="Main">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  // Sized to match body copy rather than UI chrome. At 13px
                  // the navigation read as a toolbar; at 15px it reads as part
                  // of the page, which is what a firm's masthead should do.
                  'text-base font-medium transition-colors duration-300 relative group',
                  solid ? 'text-ink-muted hover:text-primary' : 'text-white/80 hover:text-white',
                )}
              >
                {link.label}
                <span
                  className={cn(
                    'absolute -bottom-1 left-0 h-px w-0 transition-all duration-300 ease-physical',
                    'group-hover:w-full',
                    solid ? 'bg-primary' : 'bg-secondary',
                  )}
                />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/#contact"
              className={cn(
                'hidden sm:inline-flex btn text-base px-5 py-2.5',
                solid
                  ? 'bg-primary text-white shadow-float hover:shadow-lift hover:-translate-y-0.5'
                  : 'bg-white/15 text-white backdrop-blur-sm border border-white/25 hover:bg-white/25',
              )}
            >
              Contact us
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className={cn(
                'lg:hidden grid h-10 w-10 place-items-center rounded-lg transition-colors',
                solid ? 'text-ink hover:bg-surface-sunken' : 'text-white hover:bg-white/15',
              )}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              <Icon name={menuOpen ? 'close' : 'menu'} size="lg" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu. A full panel rather than a dropdown, so the links are
          thumb-sized on a phone instead of a cramped list. */}
      <div
        id="mobile-menu"
        className={cn(
          'fixed inset-x-0 top-20 md:top-24 z-40 lg:hidden transition-all duration-400 ease-physical',
          menuOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-4 pointer-events-none',
        )}
      >
        <nav
          className="shell pb-6 pt-4 bg-surface/95 backdrop-blur-xl border-b border-surface-line shadow-lift"
          aria-label="Mobile"
        >
          <ul className="flex flex-col">
            {NAV_LINKS.map((link, index) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center justify-between py-4 text-h6 text-ink border-b border-surface-line/70 hover:text-primary transition-colors"
                  style={{ transitionDelay: menuOpen ? `${index * 40}ms` : '0ms' }}
                >
                  {link.label}
                  <Icon name="arrow_forward" size="sm" className="text-ink-soft" />
                </Link>
              </li>
            ))}
          </ul>

          <Link href="/#contact" className="btn-primary w-full mt-6">
            Contact us
          </Link>
        </nav>
      </div>
    </>
  );
}
