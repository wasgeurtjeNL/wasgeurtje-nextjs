// Site configuration for absolute URLs (required for proper SEO)
// Update this when moving to production domain

export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://wasgeurtje.nl";

export const SITE_NAME = "Wasgeurtje.nl";

export const SITE_CONFIG = {
  name: SITE_NAME,
  url: BASE_URL,
  description: "Luxe wasparfums met Italiaans geïnspireerde geuren gemaakt met premium essentiële oliën.",
  locale: "nl-NL",
} as const;

