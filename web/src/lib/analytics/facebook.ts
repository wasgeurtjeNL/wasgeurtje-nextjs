import { analyticsConfig, isTrackingEnabled } from './config';
import type { AnalyticsItem } from './types';

/**
 * Facebook Pixel Direct Tracking Utilities
 * 
 * These functions send events directly to Facebook Pixel (without GTM)
 * This provides more reliable tracking and better iOS 14+ compatibility
 */

/**
 * Track a custom Facebook Pixel event
 * ✅ WITH EVENT ID for deduplication with server-side events
 */
export const trackFacebookEvent = (
  eventName: string,
  parameters?: Record<string, any>,
  options?: { eventID?: string }
) => {
  if (typeof window !== 'undefined' && window.fbq && isTrackingEnabled()) {
    // Track with eventID for deduplication
    window.fbq('track', eventName, parameters, options);
    
    if (analyticsConfig.debug) {
      console.log('[FB Pixel] Tracked:', eventName, parameters, options?.eventID ? `[EventID: ${options.eventID}]` : '');
    }
  } else if (analyticsConfig.debug) {
    console.log('[FB Pixel] Tracking disabled or fbq not loaded, skipping:', eventName);
  }
};

/**
 * Track Add to Cart event
 * ✅ WITH EVENT ID for deduplication
 */
export const trackFacebookAddToCart = (item: AnalyticsItem, quantity: number) => {
  // Generate unique event ID for deduplication
  const eventId = `add_to_cart_${item.item_id}_${Date.now()}`;
  
  // Store for server-side deduplication
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('fb_last_event_id', eventId);
    sessionStorage.setItem('fb_last_event_name', 'AddToCart');
  }
  
  trackFacebookEvent('AddToCart', {
    content_ids: [String(item.item_id)],
    content_name: item.item_name,
    content_type: 'product',
    value: item.price * quantity,
    currency: item.currency || 'EUR',
  }, {
    eventID: eventId
  });
};

/**
 * Track View Content event (product page view)
 * ✅ WITH EVENT ID for deduplication
 */
export const trackFacebookViewContent = (item: AnalyticsItem) => {
  // Generate unique event ID for deduplication
  const eventId = `view_content_${item.item_id}_${Date.now()}`;
  
  // Store for server-side deduplication
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('fb_last_event_id', eventId);
    sessionStorage.setItem('fb_last_event_name', 'ViewContent');
  }
  
  trackFacebookEvent('ViewContent', {
    content_ids: [String(item.item_id)],
    content_name: item.item_name,
    content_type: 'product',
    value: item.price,
    currency: item.currency || 'EUR',
  }, {
    eventID: eventId
  });
};

/**
 * Track Initiate Checkout event
 * ✅ WITH EVENT ID for deduplication
 */
export const trackFacebookCheckout = (items: AnalyticsItem[], value: number) => {
  // Generate unique event ID for deduplication
  const eventId = `initiate_checkout_${Date.now()}`;
  
  // Store for server-side deduplication
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('fb_last_event_id', eventId);
    sessionStorage.setItem('fb_last_event_name', 'InitiateCheckout');
  }
  
  trackFacebookEvent('InitiateCheckout', {
    content_ids: items.map(i => String(i.item_id)),
    contents: items.map(i => ({
      id: String(i.item_id),
      quantity: i.quantity,
    })),
    value: value,
    currency: 'EUR',
    num_items: items.length,
  }, {
    eventID: eventId
  });
};

/**
 * Track Purchase event
 * ✅ WITH EVENT ID for deduplication (using orderId)
 */
export const trackFacebookPurchase = (
  orderId: string,
  items: AnalyticsItem[],
  value: number
) => {
  // Use orderId for deduplication (same as server-side)
  const eventId = `purchase_${orderId}`;
  
  // Store for server-side deduplication
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('fb_last_event_id', eventId);
    sessionStorage.setItem('fb_last_event_name', 'Purchase');
  }
  
  trackFacebookEvent('Purchase', {
    content_ids: items.map(i => String(i.item_id)),
    contents: items.map(i => ({
      id: String(i.item_id),
      quantity: i.quantity,
    })),
    value: value,
    currency: 'EUR',
    num_items: items.length,
  }, {
    eventID: eventId
  });
};

/**
 * Track Lead event (email capture, form submission)
 */
export const trackFacebookLead = (email?: string) => {
  trackFacebookEvent('Lead', email ? { email } : undefined);
};

