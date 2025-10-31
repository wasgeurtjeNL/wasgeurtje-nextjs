import dynamic from 'next/dynamic';
import HeroSection from "@/components/sections/HeroSection";
import USPs from "@/components/sections/USPs";
import Categories from "@/components/sections/Categories";
import PersonalizedRecommendations from "@/components/sections/PersonalizedRecommendations";
import RunningUSPStrip from "@/components/sections/RunningUSPStrip";
import type { Metadata } from "next";
import { fetchWpBySlug, yoastToNextMetadata } from "@/utils/wordpress-yoastseo";

// Lazy load below-the-fold components for better LCP
const Testimonials = dynamic(() => import('@/components/sections/Testimonials'));
const HowItWorks = dynamic(() => import('@/components/sections/HowItWorks'));
const PerfumeFinder = dynamic(() => import('@/components/sections/PerfumeFinder'));
const Sustainability = dynamic(() => import('@/components/sections/Sustainability'));
const TrialPackFeature = dynamic(() => import('@/components/sections/TrialPackFeature'));
const RewardProgram = dynamic(() => import('@/components/sections/RewardProgram'));
const OurStory = dynamic(() => import('@/components/sections/OurStory'));

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
