"use client";

import Script from 'next/script';
import { analyticsConfig, isTrackingEnabled } from '@/lib/analytics/config';

/**
 * Hyros Universal Script Component
 * 
 * Loads Hyros tracking script for advanced attribution and call tracking
 * Custom domain: t.wasgeurtje.nl
 */
export default function HyrosScript() {
  const { hyros, debug } = analyticsConfig;

  if (!hyros.enabled || !hyros.hash || !isTrackingEnabled()) {
    if (debug) {
      console.warn('[Hyros] Not enabled or hash not configured');
    }
    return null;
  }

  const scriptSrc = `${hyros.domain}/v1/lst/universal-script?ph=${hyros.hash}&tag=${hyros.tag}&ref_url=`;

  if (debug) {
    console.log('[Hyros] Loading script from:', scriptSrc);
  }

  return (
    <Script
      id="hyros-universal-script"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            var head = document.head;
            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = "${scriptSrc}" + encodeURI(document.URL);
            head.appendChild(script);
          })();
        `,
      }}
      onLoad={() => debug && console.log('[Hyros] Script loaded successfully')}
      onError={(e) => debug && console.error('[Hyros] Script failed to load:', e)}
    />
  );
}

