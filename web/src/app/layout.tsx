import type { Metadata, Viewport } from "next";
import { EB_Garamond } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import dynamic from "next/dynamic";
import "./globals.css";
import "./product-typography.css";

// Direct imports for providers and essential components
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { LoyalityProvider } from "@/context/LoyalityContext";
import FigmaHeader from "@/components/sections/FigmaHeader";
import FooterLayer from "@/components/sections/FooterLayer";

// Lazy load client-only components (these are already 'use client' components)
// Next.js 15 handles code-splitting automatically for client components
const ResponsiveInit = dynamic(() => import("@/components/ResponsiveInit"), {
  loading: () => null,
});
const CartSidebar = dynamic(() => import("@/components/CartSidebar"), {
  loading: () => null,
});
const CustomerIntelligenceTracker = dynamic(
  () => import("@/components/CustomerIntelligenceTracker"),
  { loading: () => null }
);
const GlobalBundleOfferManager = dynamic(
  () => import("@/components/GlobalBundleOfferManager"),
  { loading: () => null }
);

// Analytics & Tracking Components (client-side only, already marked as "use client")
const GoogleTagManager = dynamic(
  () => import("@/components/analytics/GoogleTagManager"),
  { loading: () => null }
);
const KlaviyoSDK = dynamic(
  () => import("@/components/analytics/KlaviyoSDK"),
  { loading: () => null }
);
const FacebookPixel = dynamic(
  () => import("@/components/analytics/FacebookPixel"),
  { loading: () => null }
);
const GoogleAnalytics = dynamic(
  () => import("@/components/analytics/GoogleAnalytics"),
  { loading: () => null }
);
const HyrosScript = dynamic(
  () => import("@/components/analytics/HyrosScript"),
  { loading: () => null }
);
const CartTracker = dynamic(
  () => import("@/components/analytics/CartTracker"),
  { loading: () => null }
);

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  display: "optional", // Use 'optional' instead of 'swap' to prevent CLS
  weight: ["400", "500", "600", "700"],
  variable: "--font-eb-garamond",
  preload: true, // Ensure font is preloaded for critical text
});

export const metadata: Metadata = {
  title: "Wasgeurtje.nl — Luxe Wasparfums",
  description:
    "Luxe wasparfums met Italiaans geïnspireerde geuren gemaakt met premium essentiële oliën.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" className={`${ebGaramond.variable}`}>
      <head>
        {/* Preconnect to important domains for faster resource loading */}
        <link rel="preconnect" href="https://wasgeurtje-nextjs.vercel.app" />
        <link rel="dns-prefetch" href="https://wasgeurtje-nextjs.vercel.app" />
        
        {/* Preconnect to TrustIndex for faster reviews loading */}
        <link rel="preconnect" href="https://cdn.trustindex.io" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.trustindex.io" />
        
        {/* Preconnect to tracking domains for faster analytics loading */}
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://static.klaviyo.com" />
        <link rel="preconnect" href="https://connect.facebook.net" />
        <link rel="preconnect" href="https://t.wasgeurtje.nl" />
        <link rel="dns-prefetch" href="https://sst.wasgeurtje.nl" />
        
        {/* Preload critical font for LCP improvement */}
        <link
          rel="preload"
          href="/_next/static/media/23081e227a96aa1a-s.p.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased overflow-x-hidden">
        {/* Analytics & Tracking - Loaded first for accurate tracking */}
        <GoogleTagManager />
        <KlaviyoSDK />
        <FacebookPixel />
        <GoogleAnalytics />
        <HyrosScript />
        
        <AuthProvider>
          <CartProvider>
            {/* Cart Tracker - Must be inside CartProvider to access cart context */}
            <CartTracker />
            
            <LoyalityProvider>
              <ResponsiveInit />
              <CustomerIntelligenceTracker />
              <GlobalBundleOfferManager />
              <FigmaHeader />
              {children}
              <FooterLayer />
              <CartSidebar />
            </LoyalityProvider>
          </CartProvider>
        </AuthProvider>
        {/* Vercel Speed Insights - Real User Monitoring for Core Web Vitals */}
        <SpeedInsights />
      </body>
    </html>
  );
}
