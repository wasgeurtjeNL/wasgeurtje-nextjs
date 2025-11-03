import dynamic from 'next/dynamic';
import HeroSection from "@/components/sections/HeroSection";
import USPs from "@/components/sections/USPs";
import Categories from "@/components/sections/Categories";
import type { Metadata } from "next";
import { fetchWpBySlug, yoastToNextMetadata } from "@/utils/wordpress-yoastseo";

// Skeleton loader components to prevent CLS
const SectionSkeleton = ({ height = '400px', bgColor = 'rgba(245,245,245,0.8)' }: { height?: string; bgColor?: string }) => (
  <div style={{ minHeight: height, backgroundColor: bgColor }} className="w-full" />
);

// Lazy load components that are below-the-fold or do heavy API calls
// These will be loaded after the initial page render for better FCP/LCP
const PersonalizedRecommendations = dynamic(() => import('@/components/sections/PersonalizedRecommendations'), {
  loading: () => <SectionSkeleton height="300px" />
});
const RunningUSPStrip = dynamic(() => import('@/components/sections/RunningUSPStrip'), {
  loading: () => <SectionSkeleton height="60px" bgColor="rgba(214,173,97,0.3)" />
});
const Testimonials = dynamic(() => import('@/components/sections/Testimonials'), {
  loading: () => <SectionSkeleton height="400px" bgColor="rgba(252,206,78,0.3)" />
});
const HowItWorks = dynamic(() => import('@/components/sections/HowItWorks'), {
  loading: () => <SectionSkeleton height="600px" />
});
const PerfumeFinder = dynamic(() => import('@/components/sections/PerfumeFinder'), {
  loading: () => <SectionSkeleton height="500px" bgColor="rgba(255,255,255,1)" />
});
const Sustainability = dynamic(() => import('@/components/sections/Sustainability'), {
  loading: () => <SectionSkeleton height="500px" />
});
const TrialPackFeature = dynamic(() => import('@/components/sections/TrialPackFeature'), {
  loading: () => <SectionSkeleton height="450px" bgColor="rgba(248,248,248,1)" />
});
const RewardProgram = dynamic(() => import('@/components/sections/RewardProgram'), {
  loading: () => <SectionSkeleton height="500px" />
});
const OurStory = dynamic(() => import('@/components/sections/OurStory'), {
  loading: () => <SectionSkeleton height="700px" bgColor="rgba(252,252,252,1)" />
});

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
