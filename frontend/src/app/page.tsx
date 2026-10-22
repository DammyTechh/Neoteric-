import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { WhoWeAreSection } from '@/components/home/WhoWeAre';
import { PracticeAreasSection } from '@/components/home/PracticeAreas';
import { TeamSection } from '@/components/home/Team';
import {
  AchievementsBand,
  PublicationsSection,
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
   * Section order and anchors follow the live v1 site, so the navigation
   * means the same thing it always did:
   *
   *   hero (industries carousel) → #achievements → #aboutUs ("Who We Are")
   *   → #practiceAreas → #ourTeam → #visionMission → #news → #contactUs
   *
   * Industries have no section of their own: the hero carousel is the
   * industries showcase, exactly as in v1.
   */
  return (
    <>
      <Header />

      <main id="main">
        <HeroCarousel industries={data.industries} settings={data.settings} />
        <AchievementsBand achievements={data.achievements} />
        <WhoWeAreSection settings={data.settings} />
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
