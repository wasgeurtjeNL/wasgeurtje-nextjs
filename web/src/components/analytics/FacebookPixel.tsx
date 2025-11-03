"use client";

import Script from 'next/script';
import { useEffect } from 'react';
import { analyticsConfig, isTrackingEnabled } from '@/lib/analytics/config';

/**
 * Facebook Pixel Component
 * 
 * Loads Facebook Pixel SDK directly (without GTM)
 * This provides more reliable tracking and better iOS 14+ compatibility
 */
export default function FacebookPixel() {
  const { facebookPixel, debug } = analyticsConfig;

  useEffect(() => {
    if (typeof window !== 'undefined' && window.fbq && isTrackingEnabled()) {
      // Initialize Facebook Pixel
      window.fbq('init', facebookPixel.id);
      
      // Track PageView
      window.fbq('track', 'PageView');
      
      if (debug) {
        console.log('[FB Pixel] Initialized with ID:', facebookPixel.id);
      }
    }
  }, [facebookPixel.id, debug]);

  if (!facebookPixel.id || !isTrackingEnabled()) {
    if (debug) {
      console.warn('[FB Pixel] Not enabled or Pixel ID not set');
    }
    return null;
  }

  return (
    <>
      <Script
        id="facebook-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
          `,
        }}
        onLoad={() => debug && console.log('[FB Pixel] Script loaded')}
        onError={(e) => debug && console.error('[FB Pixel] Script failed to load:', e)}
      />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${facebookPixel.id}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}

