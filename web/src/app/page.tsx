import HeroSection from "@/components/sections/HeroSection";
import USPs from "@/components/sections/USPs";
import Categories from "@/components/sections/Categories";
import PersonalizedRecommendations from "@/components/sections/PersonalizedRecommendations";
import RunningUSPStrip from "@/components/sections/RunningUSPStrip";
import Testimonials from "@/components/sections/Testimonials";
import HowItWorks from "@/components/sections/HowItWorks";
import PerfumeFinder from "@/components/sections/PerfumeFinder";
import Sustainability from "@/components/sections/Sustainability";
import TrialPackFeature from "@/components/sections/TrialPackFeature";
import RewardProgram from "@/components/sections/RewardProgram";
import OurStory from "@/components/sections/OurStory";
import type { Metadata } from "next";
import { fetchWpBySlug, yoastToNextMetadata } from "@/utils/wordpress-yoastseo";

export async function generateMetadata(): Promise<Metadata> {
  try {
    // Fetch WP front page: commonly slug "home" or set via WP front page settings.
    // Adjust slug if your homepage uses a different slug in WordPress.
    const page = await fetchWpBySlug("pages", "home");
    return yoastToNextMetadata(page?.yoast_head_json);
  } catch {
    return {
      title: "Wasgeurtje",
      description: "Premium wasparfum en wasstrips voor een langdurige geur.",
    };
  }
}

export default function Home() {
  return (
    <>
      <main>
        <HeroSection />
        <USPs />
        <Categories />
        <PersonalizedRecommendations />
        <RunningUSPStrip />
        <Testimonials />
        <HowItWorks />
        <PerfumeFinder />
        <Sustainability />
        <TrialPackFeature />
        <RewardProgram />
        <OurStory />
      </main>
    </>
  );
}
