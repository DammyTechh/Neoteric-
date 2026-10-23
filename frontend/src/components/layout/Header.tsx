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
 *
 * `section` is the element the link scrolls to, used to light the active pill.
 */
const NAV_LINKS = [
  { label: 'What we do', href: '/#aboutUs', section: 'aboutUs' },
  { label: 'Achievements', href: '/#achievements', section: 'achievements' },
  { label: 'Our Vision & Mission', href: '/#visionMission', section: 'visionMission' },
  { label: 'News', href: '/publications', section: null },
  { label: 'Our Team', href: '/#ourTeam', section: 'ourTeam' },
  { label: 'Contact us', href: '/#contactUs', section: 'contactUs' },
] as const;

/**
 * A floating pill header.
 *
 * The bar detaches from the top edge and sits on the page as an object. It is
 * the one piece of chrome here that earns reading that way: it leaves the hero
 * photograph uninterrupted edge to edge, which a full-width bar does not.
 *
 * Two states, both from the brand palette — teal glass over the dark hero,
 * white with a hairline border once the reader has scrolled onto the page.
 *
 * The active link carries its own smaller pill, tracked against whichever
 * section is in view rather than against the URL hash, since the hash does
 * not change as someone scrolls past a section.
 */
export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const pathname = usePathname();

  const onHome = pathname === '/';
  const solid = scrolled || !onHome || menuOpen;

  /**
   * Gets out of the way while the reader is scrolling, and comes back the
   * moment they stop.
   *
   * Not the usual "hide on the way down, show on the way up": the bar simply
   * leaves during motion in either direction and returns on rest, which is
   * what makes it feel like it is yielding the page rather than tracking the
   * reader.
   *
   * One handler drives both this and the solid/glass state, so the two cannot
   * disagree. All of it is in a `requestAnimationFrame` because a scroll
   * handler that reads layout on every event is the classic cause of a janky
   * bar. The 140ms idle delay is the shortest that does not flicker between
   * the discrete scroll events a mouse wheel produces.
   */
  useEffect(() => {
    let frame = 0;
    let idleTimer: ReturnType<typeof setTimeout>;

    const settle = () => {
      const y = window.scrollY;
      setScrolled(y > 24);

      // Never hide at the very top: there is nothing to make room for, and a
      // bar that vanishes on the hero looks broken rather than considerate.
      setHidden(y > 120);

      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setHidden(false), 140);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        settle();
      });
    };

    // Set the initial state without waiting for a scroll.
    setScrolled(window.scrollY > 24);

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(idleTimer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  /**
   * Lights the pill for the section the reader is actually looking at.
   *
   * A band across the middle of the viewport rather than the top edge: a
   * section counts as active once it reaches the middle, which is closer to
   * where attention sits.
   */
  useEffect(() => {
    if (!onHome) {
      setActiveSection(null);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );

    for (const link of NAV_LINKS) {
      if (!link.section) continue;
      const node = document.getElementById(link.section);
      if (node) observer.observe(node);
    }

    return () => observer.disconnect();
  }, [onHome]);

  // A route change should never leave the mobile menu hanging open.
  useEffect(() => setMenuOpen(false), [pathname]);

  // Stop the page scrolling behind the open menu.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const isActive = (link: (typeof NAV_LINKS)[number]) =>
    link.section ? activeSection === link.section : pathname.startsWith('/publications');

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 pt-3 md:pt-5',
          'transition-transform ease-physical',
          /*
            Quick out, quicker back. A 500ms slide means the bar is still
            on screen while the reader is already moving, which defeats the
            point; coming back is faster still, because that is the moment
            they want it.
          */
          hidden && !menuOpen
            ? '-translate-y-[150%] duration-200'
            : 'translate-y-0 duration-300',
        )}
      >
        <div className="shell">
          <nav
            className={cn(
              'mx-auto flex max-w-6xl items-center gap-2 rounded-full',
              'px-3 py-2.5 md:px-4 md:py-3',
              'transition-[background-color,box-shadow,border-color] duration-500 ease-physical',
              'backdrop-blur-xl',
              solid
                ? 'border border-surface-line bg-surface/90 shadow-lift'
                : 'border border-white/15 bg-primary-950/35 shadow-float',
            )}
            aria-label="Main"
          >
            <Link href="/" className="shrink-0 pl-1 md:pl-2" aria-label="Neoteric LP — home">
              <Logo
                variant={solid ? 'dark' : 'light'}
                priority
                className="h-8 w-auto md:h-9"
              />
            </Link>

            {/* ── Links ──────────────────────────────────────────────────── */}
            <div className="ml-auto hidden items-center gap-0.5 lg:flex">
              {NAV_LINKS.map((link) => {
                const active = isActive(link);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'rounded-full px-3.5 py-2 text-small font-medium xl:text-base',
                      'transition-[background-color,color] duration-300',
                      active
                        ? solid
                          ? 'bg-primary-50 text-primary'
                          : 'bg-white/15 text-white'
                        : solid
                          ? 'text-ink-muted hover:bg-surface-sunken hover:text-primary'
                          : 'text-white/75 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* ── Call to action ─────────────────────────────────────────── */}
            <Link
              href="/#contactUs"
              className={cn(
                'ml-auto hidden shrink-0 items-center gap-2 rounded-full px-5 py-2.5 sm:inline-flex lg:ml-2',
                'text-small font-medium xl:text-base',
                'bg-secondary text-white shadow-float',
                'transition-[transform,box-shadow,background-color] duration-300 ease-physical',
                'hover:-translate-y-0.5 hover:bg-secondary-500 hover:shadow-lift',
              )}
            >
              <Icon name="forum" size="sm" />
              Speak to us
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className={cn(
                'ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full lg:hidden',
                'transition-colors duration-300',
                solid
                  ? 'bg-surface-sunken text-ink hover:bg-primary-50 hover:text-primary'
                  : 'bg-white/15 text-white hover:bg-white/25',
              )}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              <Icon name={menuOpen ? 'close' : 'menu'} size="lg" />
            </button>
          </nav>
        </div>
      </header>

      {/*
        Mobile menu: a floating card under the pill rather than a full-screen
        takeover, so the header still reads as one object and the links stay
        thumb-sized.
      */}
      <div
        id="mobile-menu"
        className={cn(
          'fixed inset-x-0 top-[4.75rem] z-40 px-6 md:top-[5.5rem] lg:hidden',
          'transition-all duration-500 ease-physical',
          hidden && !menuOpen && '-translate-y-[150%]',
          menuOpen
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-3 opacity-0',
        )}
      >
        <nav
          className="mx-auto max-w-6xl overflow-hidden rounded-panel border border-surface-line bg-surface/95 shadow-deep backdrop-blur-xl"
          aria-label="Mobile"
        >
          <ul className="flex flex-col p-2">
            {NAV_LINKS.map((link) => {
              const active = isActive(link);

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center justify-between rounded-card px-4 py-3.5 text-base',
                      'transition-colors duration-200',
                      active
                        ? 'bg-primary-50 font-medium text-primary'
                        : 'text-ink hover:bg-surface-sunken hover:text-primary',
                    )}
                  >
                    {link.label}
                    <Icon
                      name="arrow_forward"
                      size="sm"
                      className={active ? 'text-primary' : 'text-ink-soft'}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-surface-line p-3">
            <Link
              href="/#contactUs"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-5 py-3 text-base font-medium text-white shadow-float transition-colors hover:bg-secondary-500"
            >
              <Icon name="forum" size="sm" />
              Speak to our team
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
