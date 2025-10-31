import type { Metadata, Viewport } from "next";
import { EB_Garamond } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import "./product-typography.css";
import "./blog/blog-styling.css";
// Slick carousel CSS is now lazy-loaded only on product pages
// import FigmaHeader from "@/components/sections/FigmaHeader";
// import ResponsiveInit from "@/components/ResponsiveInit";
// import { CartProvider } from "@/context/CartContext";
// import { AuthProvider } from "@/context/AuthContext";
// import CartSidebar from "@/components/CartSidebar";
// import Footer from "@/components/sections/Footer";
import FigmaHeader from "@/components/sections/FigmaHeader";
import ResponsiveInit from "@/components/ResponsiveInit";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import CartSidebar from "@/components/CartSidebar";
import FooterLayer from "@/components/sections/FooterLayer";
import { LoyalityProvider } from "@/context/LoyalityContext";
import CustomerIntelligenceTracker from "@/components/CustomerIntelligenceTracker";
import GlobalBundleOfferManager from "@/components/GlobalBundleOfferManager";

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
        <AuthProvider>
          <CartProvider>
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
