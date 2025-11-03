"use client";

/**
 * Klaviyo SDK Component
 * 
 * Loads Klaviyo JavaScript SDK for direct client-side tracking
 * Independent from GTM for maximum reliability and real-time tracking
 */

import Script from 'next/script';
import { useEffect } from 'react';
import { analyticsConfig } from '@/lib/analytics/config';
import { initializeKlaviyo } from '@/lib/analytics/klaviyo';

export default function KlaviyoSDK() {
  const { klaviyo } = analyticsConfig;

  useEffect(() => {
    // Initialize Klaviyo queue on mount
    initializeKlaviyo();
  }, []);

  if (!klaviyo.enabled) {
    return null;
  }

  return (
    <>
      {/* Klaviyo Async Snippet - Official implementation */}
      <Script
        id="klaviyo-async"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(){if(!window.klaviyo){window._klOnsite=window._klOnsite||[];
            try{window.klaviyo=new Proxy({},{get:function(n,i){return"push"===i?function(){var n;
            (n=window._klOnsite).push.apply(n,arguments)}:function(){for(var n=arguments.length,o=new Array(n),w=0;w<n;w++)
            o[w]=arguments[w];var t="function"==typeof o[o.length-1]?o.pop():void 0,e=new Promise((function(n){window._klOnsite.push([i].concat(o,[function(i){t&&t(i),n(i)}]))}));return e}}})}catch(n){window.klaviyo=window.klaviyo||[],
            window.klaviyo.push=function(){var n;(n=window._klOnsite).push.apply(n,arguments)}}}}();
          `,
        }}
      />

      {/* Klaviyo Main Script */}
      <Script
        id="klaviyo-sdk"
        strategy="afterInteractive"
        src={`https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=${klaviyo.apiKey}`}
        onLoad={() => {
          if (analyticsConfig.debug) {
            console.log('[Klaviyo] SDK loaded successfully', {
              companyId: klaviyo.apiKey,
              _learnq: typeof window._learnq,
              klaviyo: typeof window.klaviyo,
            });
          }
        }}
        onError={(e) => {
          console.error('[Klaviyo] Failed to load SDK:', e);
        }}
      />

      {/* Debug logging */}
      {analyticsConfig.debug && (
        <Script
          id="klaviyo-debug"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              console.log('[Klaviyo] Initialized with config:', {
                companyId: '${klaviyo.apiKey}',
                sdkUrl: 'https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=${klaviyo.apiKey}',
              });
            `,
          }}
        />
      )}
    </>
  );
}

