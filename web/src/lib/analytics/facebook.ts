import { analyticsConfig, isTrackingEnabled } from './config';
import type { AnalyticsItem } from './types';
import { generateEventId } from './eventIdGenerator';

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
  // Generate standardized event ID for deduplication
  const eventId = generateEventId('AddToCart', item.item_id);
  
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
    currency: 'EUR',
  }, {
    eventID: eventId
  });
};

/**
 * Track View Content event (product page view)
 * ✅ WITH EVENT ID for deduplication
 */
export const trackFacebookViewContent = (item: AnalyticsItem) => {
  // Generate standardized event ID for deduplication
  const eventId = generateEventId('ViewContent', item.item_id);
  
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
    currency: 'EUR',
  }, {
    eventID: eventId
  });
};

/**
 * Track Initiate Checkout event
 * ✅ WITH EVENT ID for deduplication
 */
export const trackFacebookCheckout = (items: AnalyticsItem[], value: number) => {
  // Generate standardized event ID for deduplication
  const eventId = generateEventId('InitiateCheckout');
  
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
  // ✅ FACEBOOK FIX: Ensure value is never 0 (prevents Facebook Purchase errors)
  const safeValue = value && value > 0 
    ? value 
    : items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  if (safeValue <= 0) {
    console.warn('[FB Pixel] ⚠️ Purchase value is 0 or negative, skipping event:', {
      orderId,
      originalValue: value,
      calculatedValue: safeValue,
      itemsCount: items.length
    });
    return;
  }
  
  // Use standardized Purchase event ID (orderId-based for deduplication)
  const eventId = generateEventId('Purchase', orderId);
  
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
    value: safeValue,
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

