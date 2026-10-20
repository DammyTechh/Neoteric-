import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import {
  AboutSection,
  AchievementsBand,
  PracticeAreasSection,
  PublicationsSection,
  TeamSection,
  VisionMissionSection,
} from '@/components/home/Sections';
import { TestimonialsSection } from '@/components/home/Testimonials';
import { ContactSection } from '@/components/home/Contact';
import { apiGetSafe } from '@/lib/api';
import type { HomepagePayload } from '@/lib/types';

export const revalidate = 300;

const EMPTY: HomepagePayload = {
  settings: {},
  practiceAreas: [],
  industries: [],
  team: [],
  testimonials: [],
  achievements: [],
  publications: [],
};

export default async function HomePage() {
  /**
   * One request for the whole page. `apiGetSafe` degrades to empty sections
   * if the API is briefly down — a visitor who wanted to read about the firm
   * should not meet a 500 because the backend was restarting.
   */
  const data = await apiGetSafe<HomepagePayload>('/site/homepage', EMPTY, {
    revalidate: 300,
    tags: ['homepage'],
  });

  /**
   * Section order follows the live v1 site, so returning visitors land
   * somewhere familiar:
   *
   *   hero (industries carousel) → achievements → who we are →
   *   practice areas → our team → vision & mission → news → contact
   *
   * Industries deliberately have no section of their own: the hero carousel
   * is the industries showcase, exactly as in v1, and a grid underneath would
   * repeat the same eleven items a screen later.
   */
  return (
    <>
      <Header />

      <main id="main">
        <HeroCarousel industries={data.industries} settings={data.settings} />
        <AchievementsBand achievements={data.achievements} />
        <AboutSection settings={data.settings} />
        <PracticeAreasSection practiceAreas={data.practiceAreas} />
        <TeamSection team={data.team} />
        <VisionMissionSection settings={data.settings} />
        <TestimonialsSection testimonials={data.testimonials} />
        <PublicationsSection publications={data.publications} />
        <ContactSection settings={data.settings} practiceAreas={data.practiceAreas} />
      </main>

      <Footer settings={data.settings} />
    </>
  );
}
