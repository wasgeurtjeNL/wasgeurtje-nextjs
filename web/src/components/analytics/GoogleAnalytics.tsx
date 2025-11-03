"use client";

import Script from 'next/script';
import { analyticsConfig, isTrackingEnabled } from '@/lib/analytics/config';

/**
 * Google Analytics 4 Component
 * 
 * Loads GA4 gtag.js directly (without GTM)
 * This provides faster loading and more reliable tracking
 */
export default function GoogleAnalytics() {
  const { ga4, debug } = analyticsConfig;

  if (!ga4.measurementId || !isTrackingEnabled()) {
    if (debug) {
      console.warn('[GA4] Not enabled or Measurement ID not set');
    }
    return null;
  }

  return (
    <>
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${ga4.measurementId}`}
        onLoad={() => debug && console.log('[GA4] Script loaded')}
        onError={(e) => debug && console.error('[GA4] Script failed to load:', e)}
      />
      <Script
        id="google-analytics-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${ga4.measurementId}', {
              page_path: window.location.pathname,
              send_page_view: true
            });
            ${debug ? "console.log('[GA4] Initialized with ID: ${ga4.measurementId}');" : ''}
          `,
        }}
      />
    </>
  );
}

