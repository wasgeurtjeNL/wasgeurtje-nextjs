"use client";

import Script from 'next/script';
import { useEffect } from 'react';
import { analyticsConfig, isTrackingEnabled } from '@/lib/analytics/config';
import { hashEmail, hashNormalizedPhone, hashPersonalData } from '@/lib/analytics/dataHasher';

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
      // ✅ ADVANCED MATCHING: Get user data from localStorage (if available)
      const getUserData = () => {
        const email = localStorage.getItem('user_email');
        const phone = localStorage.getItem('user_phone');
        const firstName = localStorage.getItem('user_first_name');
        const lastName = localStorage.getItem('user_last_name');
        const city = localStorage.getItem('user_city');
        const state = localStorage.getItem('user_state');
        const zipCode = localStorage.getItem('user_zip');
        const country = localStorage.getItem('user_country') || 'nl';
        
        const userData: any = {};
        
        // ✅ FIXED: Hash PII data to match server-side (prevents 58% email duplication)
        if (email) userData.em = hashEmail(email);
        if (phone) userData.ph = hashNormalizedPhone(phone, '31');
        if (firstName) userData.fn = hashPersonalData(firstName);
        if (lastName) userData.ln = hashPersonalData(lastName);
        if (city) userData.ct = hashPersonalData(city);
        if (state) userData.st = hashPersonalData(state);
        if (zipCode) userData.zp = hashPersonalData(zipCode);
        if (country) userData.country = hashPersonalData(country);
        
        return Object.keys(userData).length > 0 ? userData : undefined;
      };
      
      const advancedMatchData = getUserData();
      
      // Initialize Facebook Pixel with or without Advanced Matching
      if (advancedMatchData) {
        window.fbq('init', facebookPixel.id, advancedMatchData);
        if (debug) {
          console.log('[FB Pixel] ✅ Initialized WITH Advanced Matching:', Object.keys(advancedMatchData).join(', '));
        }
      } else {
        window.fbq('init', facebookPixel.id);
        if (debug) {
          console.log('[FB Pixel] ⚠️ Initialized WITHOUT Advanced Matching (no user data available)');
        }
      }
      
      // Track PageView
      window.fbq('track', 'PageView');
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

