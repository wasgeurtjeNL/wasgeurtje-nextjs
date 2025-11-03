import { analyticsConfig, isTrackingEnabled } from './config';
import type { AnalyticsItem } from './types';

/**
 * Facebook Conversions API (Server-Side Tracking) Utilities
 * 
 * These functions send events to our Next.js API route,
 * which then forwards them to Facebook's Conversions API.
 * 
 * This provides server-side tracking that bypasses ad blockers and iOS 14+ restrictions.
 */

/**
 * Get Facebook Click ID (fbclid) from URL
 */
function getFacebookClickId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('fbclid') || undefined;
}

/**
 * Get Facebook Browser ID (fbp) from cookie
 */
function getFacebookBrowserId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  
  const cookies = document.cookie.split(';');
  const fbpCookie = cookies.find(c => c.trim().startsWith('_fbp='));
  
  if (fbpCookie) {
    return fbpCookie.split('=')[1];
  }
  
  return undefined;
}

/**
 * Send event to server-side tracking API
 */
async function sendServerEvent(
  eventName: string,
  customData: Record<string, any> = {},
  userData: Record<string, any> = {},
  eventId?: string
) {
  if (!isTrackingEnabled()) {
    if (analyticsConfig.debug) {
      console.log('[FB Server] Tracking disabled, skipping:', eventName);
    }
    return;
  }

  try {
    // Get Facebook tracking identifiers
    const fbclid = getFacebookClickId();
    const fbp = getFacebookBrowserId();

    // Build user data with Facebook identifiers
    const fullUserData = {
      ...userData,
      fbc: fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined,
      fbp: fbp,
    };

    // Get test event code from environment variable (for testing in Facebook Events Manager)
    // This is set in the environment variables for testing purposes
    const testEventCode = process.env.NEXT_PUBLIC_FB_TEST_EVENT_CODE || undefined;

    const payload = {
      eventName,
      eventData: {
        eventId: eventId || `${eventName}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        eventSourceUrl: window.location.href,
      },
      customData,
      userData: fullUserData,
      testEventCode,
    };

    const response = await fetch('/api/tracking/facebook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[FB Server] Failed to send event:', error);
      return;
    }

    const result = await response.json();

    if (analyticsConfig.debug) {
      console.log('[FB Server] Event sent successfully:', {
        eventName,
        eventId: result.eventId,
        events_received: result.events_received,
      });
    }

  } catch (error) {
    console.error('[FB Server] Error sending event:', error);
  }
}

/**
 * Track View Content event (server-side)
 */
export const trackServerViewContent = (item: AnalyticsItem) => {
  sendServerEvent('ViewContent', {
    content_ids: [String(item.item_id)],
    content_name: item.item_name,
    content_type: 'product',
    value: item.price * item.quantity,
    currency: item.currency || 'EUR',
  });
};

/**
 * Track Add to Cart event (server-side)
 */
export const trackServerAddToCart = (item: AnalyticsItem, quantity: number = 1) => {
  sendServerEvent('AddToCart', {
    content_ids: [String(item.item_id)],
    content_name: item.item_name,
    content_type: 'product',
    value: item.price * quantity,
    currency: item.currency || 'EUR',
  });
};

/**
 * Track Initiate Checkout event (server-side)
 */
export const trackServerInitiateCheckout = (items: AnalyticsItem[], totalValue: number, userEmail?: string) => {
  const userData: Record<string, any> = {};
  
  if (userEmail) {
    userData.email = userEmail;
  }

  sendServerEvent(
    'InitiateCheckout',
    {
      content_ids: items.map(item => String(item.item_id)),
      contents: items.map(item => ({
        id: String(item.item_id),
        quantity: item.quantity,
      })),
      num_items: items.reduce((sum, item) => sum + item.quantity, 0),
      value: totalValue,
      currency: items[0]?.currency || 'EUR',
    },
    userData
  );
};

/**
 * Track Add Payment Info event (server-side)
 */
export const trackServerAddPaymentInfo = (items: AnalyticsItem[], totalValue: number, userEmail?: string) => {
  const userData: Record<string, any> = {};
  
  if (userEmail) {
    userData.email = userEmail;
  }

  sendServerEvent(
    'AddPaymentInfo',
    {
      content_ids: items.map(item => String(item.item_id)),
      value: totalValue,
      currency: items[0]?.currency || 'EUR',
    },
    userData
  );
};

/**
 * Track Purchase event (server-side)
 */
export const trackServerPurchase = (
  orderId: string,
  items: AnalyticsItem[],
  totalValue: number,
  options?: {
    userEmail?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  }
) => {
  const userData: Record<string, any> = {};
  
  if (options?.userEmail) userData.email = options.userEmail;
  if (options?.firstName) userData.firstName = options.firstName;
  if (options?.lastName) userData.lastName = options.lastName;
  if (options?.phone) userData.phone = options.phone;
  if (options?.city) userData.city = options.city;
  if (options?.state) userData.state = options.state;
  if (options?.zipCode) userData.zipCode = options.zipCode;
  if (options?.country) userData.country = options.country || 'nl'; // Default Netherlands

  sendServerEvent(
    'Purchase',
    {
      content_ids: items.map(item => String(item.item_id)),
      contents: items.map(item => ({
        id: String(item.item_id),
        quantity: item.quantity,
      })),
      num_items: items.reduce((sum, item) => sum + item.quantity, 0),
      value: totalValue,
      currency: items[0]?.currency || 'EUR',
    },
    userData,
    `purchase_${orderId}` // Use orderId for deduplication between client and server
  );
};

