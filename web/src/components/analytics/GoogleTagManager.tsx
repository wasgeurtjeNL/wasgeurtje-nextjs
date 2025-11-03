"use client";

/**
 * Google Tag Manager Component
 * 
 * Loads GTM container with Stape server-side configuration
 * Handles FB Pixel, GA4, Google Ads, and other tracking tools via GTM
 */

import Script from 'next/script';
import { useEffect } from 'react';
import { analyticsConfig } from '@/lib/analytics/config';
import { initializeDataLayer } from '@/lib/analytics/dataLayer';

export default function GoogleTagManager() {
  const { gtm, stape } = analyticsConfig;

  useEffect(() => {
    // Initialize dataLayer on mount
    initializeDataLayer();
  }, []);

  if (!gtm.enabled) {
    return null;
  }

  return (
    <>
      {/* GTM Script - Loaded from Google's standard servers */}
      <Script
        id="gtm-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;
            j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
            f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtm.id}');
          `,
        }}
      />

      {/* GTM noscript fallback */}
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${gtm.id}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
        />
      </noscript>

      {/* GA4 Config via Google */}
      <Script
        id="ga4-config"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${analyticsConfig.ga4.measurementId}`}
      />

      {/* Debug logging in development */}
      {analyticsConfig.debug && (
        <Script
          id="gtm-debug"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              console.log('[GTM] Loaded with config:', {
                containerId: '${gtm.id}',
                stapeServer: '${stape.serverUrl}',
                ga4: '${analyticsConfig.ga4.measurementId}',
              });
            `,
          }}
        />
      )}
    </>
  );
}

