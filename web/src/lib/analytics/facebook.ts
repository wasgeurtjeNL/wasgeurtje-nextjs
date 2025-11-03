import { analyticsConfig, isTrackingEnabled } from './config';
import type { AnalyticsItem } from './types';

/**
 * Facebook Pixel Direct Tracking Utilities
 * 
 * These functions send events directly to Facebook Pixel (without GTM)
 * This provides more reliable tracking and better iOS 14+ compatibility
 */

declare global {
  interface Window {
    fbq: any;
  }
}

/**
 * Track a custom Facebook Pixel event
 */
export const trackFacebookEvent = (
  eventName: string,
  parameters?: Record<string, any>
) => {
  if (typeof window !== 'undefined' && window.fbq && isTrackingEnabled()) {
    window.fbq('track', eventName, parameters);
    
    if (analyticsConfig.debug) {
      console.log('[FB Pixel] Tracked:', eventName, parameters);
    }
  } else if (analyticsConfig.debug) {
    console.log('[FB Pixel] Tracking disabled or fbq not loaded, skipping:', eventName);
  }
};

/**
 * Track Add to Cart event
 */
export const trackFacebookAddToCart = (item: AnalyticsItem, quantity: number) => {
  trackFacebookEvent('AddToCart', {
    content_ids: [String(item.item_id)],
    content_name: item.item_name,
    content_type: 'product',
    value: item.price * quantity,
    currency: item.currency || 'EUR',
  });
};

/**
 * Track View Content event (product page view)
 */
export const trackFacebookViewContent = (item: AnalyticsItem) => {
  trackFacebookEvent('ViewContent', {
    content_ids: [String(item.item_id)],
    content_name: item.item_name,
    content_type: 'product',
    value: item.price,
    currency: item.currency || 'EUR',
  });
};

/**
 * Track Initiate Checkout event
 */
export const trackFacebookCheckout = (items: AnalyticsItem[], value: number) => {
  trackFacebookEvent('InitiateCheckout', {
    content_ids: items.map(i => String(i.item_id)),
    contents: items.map(i => ({
      id: String(i.item_id),
      quantity: i.quantity,
    })),
    value: value,
    currency: 'EUR',
    num_items: items.length,
  });
};

/**
 * Track Purchase event
 */
export const trackFacebookPurchase = (
  orderId: string,
  items: AnalyticsItem[],
  value: number
) => {
  trackFacebookEvent('Purchase', {
    content_ids: items.map(i => String(i.item_id)),
    contents: items.map(i => ({
      id: String(i.item_id),
      quantity: i.quantity,
    })),
    value: value,
    currency: 'EUR',
    num_items: items.length,
  });
};

/**
 * Track Lead event (email capture, form submission)
 */
export const trackFacebookLead = (email?: string) => {
  trackFacebookEvent('Lead', email ? { email } : undefined);
};

