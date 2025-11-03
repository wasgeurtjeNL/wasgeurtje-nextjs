import { analyticsConfig, isTrackingEnabled } from './config';
import type { AnalyticsItem } from './types';

/**
 * Google Analytics 4 Direct Tracking Utilities
 * 
 * These functions send events directly to GA4 gtag.js (without GTM)
 * This provides faster loading and more reliable tracking
 */

declare global {
  interface Window {
    gtag: any;
  }
}

/**
 * Track a custom GA4 event
 */
export const trackGA4Event = (
  eventName: string,
  parameters?: Record<string, any>
) => {
  if (typeof window !== 'undefined' && window.gtag && isTrackingEnabled()) {
    window.gtag('event', eventName, parameters);
    
    if (analyticsConfig.debug) {
      console.log('[GA4] Tracked:', eventName, parameters);
    }
  } else if (analyticsConfig.debug) {
    console.log('[GA4] Tracking disabled or gtag not loaded, skipping:', eventName);
  }
};

/**
 * Track Add to Cart event
 */
export const trackGA4AddToCart = (item: AnalyticsItem, quantity: number) => {
  trackGA4Event('add_to_cart', {
    currency: item.currency || 'EUR',
    value: item.price * quantity,
    items: [{
      item_id: String(item.item_id),
      item_name: item.item_name,
      item_brand: item.item_brand,
      item_category: item.item_category,
      price: item.price,
      quantity: quantity,
    }],
  });
};

/**
 * Track View Item event (product page view)
 */
export const trackGA4ViewItem = (item: AnalyticsItem) => {
  trackGA4Event('view_item', {
    currency: item.currency || 'EUR',
    value: item.price,
    items: [{
      item_id: String(item.item_id),
      item_name: item.item_name,
      item_brand: item.item_brand,
      item_category: item.item_category,
      price: item.price,
      quantity: 1,
    }],
  });
};

/**
 * Track Begin Checkout event
 */
export const trackGA4Checkout = (items: AnalyticsItem[], value: number) => {
  trackGA4Event('begin_checkout', {
    currency: 'EUR',
    value: value,
    items: items.map(item => ({
      item_id: String(item.item_id),
      item_name: item.item_name,
      item_brand: item.item_brand,
      item_category: item.item_category,
      price: item.price,
      quantity: item.quantity,
    })),
  });
};

/**
 * Track Purchase event
 */
export const trackGA4Purchase = (
  orderId: string,
  items: AnalyticsItem[],
  value: number,
  tax: number = 0,
  shipping: number = 0
) => {
  trackGA4Event('purchase', {
    transaction_id: orderId,
    value: value,
    tax: tax,
    shipping: shipping,
    currency: 'EUR',
    items: items.map(item => ({
      item_id: String(item.item_id),
      item_name: item.item_name,
      item_brand: item.item_brand,
      item_category: item.item_category,
      price: item.price,
      quantity: item.quantity,
    })),
  });
};

/**
 * Track Generate Lead event (email capture, form submission)
 */
export const trackGA4GenerateLead = (value?: number) => {
  trackGA4Event('generate_lead', value ? { value, currency: 'EUR' } : undefined);
};

