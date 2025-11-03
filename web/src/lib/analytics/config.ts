/**
 * Analytics & Tracking Configuration
 * 
 * Centralized configuration for all tracking tools:
 * - Google Tag Manager (GTM)
 * - Klaviyo
 * - Google Analytics 4
 * - Google Ads
 * - Facebook Pixel
 * - Hyros
 * - Stape Server-side GTM
 */

export const analyticsConfig = {
  // Google Tag Manager
  gtm: {
    id: process.env.NEXT_PUBLIC_GTM_ID || 'GTM-5L34BNRM',
    enabled: true,
  },

  // Klaviyo (Direct SDK)
  klaviyo: {
    apiKey: process.env.NEXT_PUBLIC_KLAVIYO_API_KEY || 'VGLBJh',
    enabled: true,
  },

  // Google Analytics 4
  ga4: {
    measurementId: process.env.NEXT_PUBLIC_GA4_ID || 'G-6F1X8M9HMM',
    enabled: true,
  },

  // Google Ads
  googleAds: {
    conversionId: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || 'AW-10810888717',
    enabled: true,
  },

  // Facebook Pixel (Direct SDK)
  facebookPixel: {
    id: process.env.NEXT_PUBLIC_FB_PIXEL_ID || '834004417164714',
    enabled: true,
  },

  // Hyros Universal Script (Advanced Attribution & Call Tracking)
  hyros: {
    domain: process.env.NEXT_PUBLIC_HYROS_DOMAIN || 'https://t.wasgeurtje.nl',
    hash: process.env.NEXT_PUBLIC_HYROS_HASH || 'c71df4899b60bb4b9591ca9f1309eb7580a846ad57c32ef014c54d8b4cec064b',
    tag: process.env.NEXT_PUBLIC_HYROS_TAG || '!clicked',
    enabled: true,
  },

  // Stape Server-side GTM
  stape: {
    serverUrl: process.env.NEXT_PUBLIC_STAPE_SERVER_URL || 'https://sst.wasgeurtje.nl',
    enabled: true,
  },

  // Cookiebot Consent
  cookiebot: {
    id: process.env.NEXT_PUBLIC_COOKIEBOT_ID || '05849a3a-55b7-475b-9a00-cb8a5fa321ab',
    enabled: true,
  },

  // HotJar
  hotjar: {
    id: process.env.NEXT_PUBLIC_HOTJAR_ID || '2437960',
    enabled: true,
  },

  // Convert Experiments
  convertExperiments: {
    projectId: process.env.NEXT_PUBLIC_CONVERT_PROJECT_ID || '10007840',
    enabled: true,
  },

  // Debug mode (alleen in development)
  debug: process.env.NODE_ENV === 'development',
};

/**
 * Check if tracking is enabled (based on environment)
 */
export function isTrackingEnabled(): boolean {
  // Disable tracking in development unless explicitly enabled
  if (typeof window === 'undefined') return false;
  
  return process.env.NODE_ENV === 'production' || 
         process.env.NEXT_PUBLIC_ENABLE_TRACKING === 'true';
}

/**
 * Get current environment
 */
export function getEnvironment(): 'development' | 'production' | 'test' {
  return process.env.NODE_ENV as 'development' | 'production' | 'test';
}

