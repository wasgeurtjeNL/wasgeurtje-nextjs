/**
 * Customer Intelligence Tracking Hook
 * 
 * Automatically tracks customer sessions and triggers profile recalculation
 * 
 * Usage:
 * - Add to layout.tsx for global tracking
 * - Manually call trackCustomer() when email is entered in checkout
 * - Automatically tracks on login via AuthContext
 */

import { useEffect, useCallback, useRef } from 'react';
import { getStoredFingerprint } from '@/utils/fingerprint';

interface TrackingOptions {
  /** Customer email (if known) */
  email?: string;
  /** Customer ID (if logged in) */
  customerId?: number;
  /** Event type */
  eventType?: string;
  /** Only track once per session */
  oncePerSession?: boolean;
}

export function useCustomerTracking(options: TrackingOptions = {}) {
  const hasTracked = useRef(false);
  const { email, customerId, eventType, oncePerSession = true } = options; // ✅ No default event type

  const trackCustomer = useCallback(async (trackEmail?: string, trackCustomerId?: number) => {
    // Prevent duplicate tracking in same session
    if (oncePerSession && hasTracked.current) {
      return;
    }

    const finalEmail = trackEmail || email;
    const finalCustomerId = trackCustomerId || customerId;

    try {
      // Get browser fingerprint
      const fingerprint = await getStoredFingerprint();
      
      // Get Facebook tracking IDs (fbp and fbc cookies)
      const fbp = document.cookie.split('; ').find(row => row.startsWith('_fbp='))?.split('=')[1];
      const fbc = document.cookie.split('; ').find(row => row.startsWith('_fbc='))?.split('=')[1];

      console.log('[Tracking] Tracking customer:', { 
        email: finalEmail || 'anonymous', 
        customerId: finalCustomerId || 'none',
        fbp: fbp ? 'yes' : 'no',
        fbc: fbc ? 'yes' : 'no'
      });

      const response = await fetch('/api/intelligence/track-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: finalEmail,
          customer_id: finalCustomerId,
          event_type: eventType,
          fingerprint: fingerprint,
          fbp: fbp,
          fbc: fbc
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('[Tracking] ✅ Customer tracked successfully', data);
        hasTracked.current = true;
      } else {
        console.warn('[Tracking] ⚠️ Tracking failed:', data.message);
      }

    } catch (error) {
      console.error('[Tracking] ❌ Error:', error);
    }
  }, [email, customerId, eventType, oncePerSession]);

  // Auto-track on mount (always, even for anonymous visitors)
  // This enables Facebook retargeting even without email
  useEffect(() => {
    trackCustomer();
  }, [email, customerId, trackCustomer]);

  return {
    trackCustomer,
    hasTracked: hasTracked.current
  };
}

/**
 * Track checkout email entry
 */
export async function trackCheckoutEmail(email: string) {
  try {
    const fingerprint = await getStoredFingerprint();
    
    // Get Facebook tracking IDs
    const fbp = document.cookie.split('; ').find(row => row.startsWith('_fbp='))?.split('=')[1];
    const fbc = document.cookie.split('; ').find(row => row.startsWith('_fbc='))?.split('=')[1];

    await fetch('/api/intelligence/track-customer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        event_type: 'checkout_email_entered',
        fingerprint: fingerprint,
        fbp: fbp,
        fbc: fbc
      })
    });

    console.log('[Tracking] ✅ Checkout email tracked:', email);
  } catch (error) {
    console.error('[Tracking] ❌ Checkout tracking error:', error);
  }
}

/**
 * Track user login
 * Note: No event_type - just device update, no event logging
 */
export async function trackUserLogin(email: string, customerId: number) {
  try {
    const fingerprint = await getStoredFingerprint();
    
    // Get Facebook tracking IDs
    const fbp = document.cookie.split('; ').find(row => row.startsWith('_fbp='))?.split('=')[1];
    const fbc = document.cookie.split('; ').find(row => row.startsWith('_fbc='))?.split('=')[1];

    await fetch('/api/intelligence/track-customer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        customer_id: customerId,
        // No event_type - just update device tracking
        fingerprint: fingerprint,
        fbp: fbp,
        fbc: fbc
      })
    });

    console.log('[Tracking] ✅ User login tracked (device update only):', email);
  } catch (error) {
    console.error('[Tracking] ❌ Login tracking error:', error);
  }
}

/**
 * Track product view
 * Sends ViewContent event to Facebook CAPI via Intelligence system
 */
export async function trackProductView(productId: string, productName?: string, productPrice?: number) {
  try {
    const fingerprint = await getStoredFingerprint();
    
    // Get Facebook tracking IDs
    const fbp = document.cookie.split('; ').find(row => row.startsWith('_fbp='))?.split('=')[1];
    const fbc = document.cookie.split('; ').find(row => row.startsWith('_fbc='))?.split('=')[1];

    await fetch('/api/intelligence/track-customer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'product_viewed',
        product_id: productId,
        product_name: productName,
        product_price: productPrice,
        fingerprint: fingerprint,
        fbp: fbp,
        fbc: fbc
      })
    });

    console.log('[Tracking] ✅ Product view tracked:', productId);
  } catch (error) {
    console.error('[Tracking] ❌ Product view tracking error:', error);
  }
}

/**
 * Track search event
 */
export async function trackSearch(searchQuery: string) {
  try {
    const fingerprint = await getStoredFingerprint();
    
    // Get Facebook tracking IDs
    const fbp = document.cookie.split('; ').find(row => row.startsWith('_fbp='))?.split('=')[1];
    const fbc = document.cookie.split('; ').find(row => row.startsWith('_fbc='))?.split('=')[1];

    await fetch('/api/intelligence/track-customer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'search',
        search_query: searchQuery,
        fingerprint: fingerprint,
        fbp: fbp,
        fbc: fbc
      })
    });

    console.log('[Tracking] ✅ Search tracked:', searchQuery);
  } catch (error) {
    console.error('[Tracking] ❌ Search tracking error:', error);
  }
}

/**
 * Track engagement (time on page + scroll depth)
 */
export async function trackEngagement(timeOnPage: number, scrollDepth: number) {
  // Only track engaged users (>30s or >50% scroll)
  if (timeOnPage < 30 && scrollDepth < 50) return;
  
  try {
    const fingerprint = await getStoredFingerprint();
    
    // Get Facebook tracking IDs
    const fbp = document.cookie.split('; ').find(row => row.startsWith('_fbp='))?.split('=')[1];
    const fbc = document.cookie.split('; ').find(row => row.startsWith('_fbc='))?.split('=')[1];

    await fetch('/api/intelligence/track-customer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'engaged_session',
        time_on_page: timeOnPage,
        scroll_depth: scrollDepth,
        fingerprint: fingerprint,
        fbp: fbp,
        fbc: fbc
      })
    });

    console.log('[Tracking] ✅ Engagement tracked:', { timeOnPage, scrollDepth });
  } catch (error) {
    console.error('[Tracking] ❌ Engagement tracking error:', error);
  }
}

