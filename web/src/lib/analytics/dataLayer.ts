/**
 * DataLayer Manager
 * 
 * Centralized utility for pushing events to GTM's dataLayer
 * Type-safe event tracking for all GA4, FB Pixel, Google Ads via GTM
 */

import type { DataLayerEvent, AnalyticsItem } from './types';
import { analyticsConfig, isTrackingEnabled } from './config';

/**
 * Initialize dataLayer if it doesn't exist
 */
export function initializeDataLayer(): void {
  if (typeof window === 'undefined') return;
  
  window.dataLayer = window.dataLayer || [];
  
  if (analyticsConfig.debug) {
    console.log('[DataLayer] Initialized');
  }
}

/**
 * Push event to dataLayer
 */
export function pushToDataLayer(event: DataLayerEvent): void {
  if (typeof window === 'undefined') return;
  if (!isTrackingEnabled()) {
    if (analyticsConfig.debug) {
      console.log('[DataLayer] Tracking disabled, skipping:', event);
    }
    return;
  }

  // Initialize dataLayer if needed
  if (!window.dataLayer) {
    initializeDataLayer();
  }

  // Clear previous ecommerce data (GA4 best practice)
  if ('ecommerce' in event) {
    window.dataLayer.push({ ecommerce: null });
  }

  // Push event
  window.dataLayer.push(event);

  if (analyticsConfig.debug) {
    console.log('[DataLayer] Event pushed:', event);
  }
}

/**
 * Track page view
 */
export function trackPageView(path: string, title?: string): void {
  pushToDataLayer({
    event: 'page_view',
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.href,
  });
}

/**
 * Track product view
 */
export function trackViewItem(items: AnalyticsItem[], value?: number): void {
  pushToDataLayer({
    event: 'view_item',
    ecommerce: {
      items,
      currency: 'EUR',
      value: value || items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    },
  });
}

/**
 * Track add to cart
 */
export function trackAddToCart(items: AnalyticsItem[], value?: number): void {
  pushToDataLayer({
    event: 'add_to_cart',
    ecommerce: {
      items,
      currency: 'EUR',
      value: value || items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    },
  });
}

/**
 * Track remove from cart
 */
export function trackRemoveFromCart(items: AnalyticsItem[], value?: number): void {
  pushToDataLayer({
    event: 'remove_from_cart',
    ecommerce: {
      items,
      currency: 'EUR',
      value: value || items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    },
  });
}

/**
 * Track view cart
 */
export function trackViewCart(items: AnalyticsItem[], value: number): void {
  pushToDataLayer({
    event: 'view_cart',
    ecommerce: {
      items,
      currency: 'EUR',
      value,
    },
  });
}

/**
 * Track begin checkout
 */
export function trackBeginCheckout(items: AnalyticsItem[], value: number, coupon?: string): void {
  pushToDataLayer({
    event: 'begin_checkout',
    ecommerce: {
      items,
      currency: 'EUR',
      value,
      coupon,
    },
  });
}

/**
 * Track add payment info
 */
export function trackAddPaymentInfo(items: AnalyticsItem[], value: number, paymentType?: string): void {
  pushToDataLayer({
    event: 'add_payment_info',
    ecommerce: {
      items,
      currency: 'EUR',
      value,
      payment_type: paymentType,
    },
  });
}

/**
 * Track purchase/conversion
 */
export function trackPurchase(
  transactionId: string,
  items: AnalyticsItem[],
  value: number,
  options?: {
    tax?: number;
    shipping?: number;
    coupon?: string;
    affiliation?: string;
  }
): void {
  pushToDataLayer({
    event: 'purchase',
    ecommerce: {
      transaction_id: transactionId,
      affiliation: options?.affiliation || 'Wasgeurtje.nl',
      value,
      tax: options?.tax || 0,
      shipping: options?.shipping || 0,
      currency: 'EUR',
      coupon: options?.coupon,
      items,
    },
  });
}

/**
 * Track custom event
 */
export function trackCustomEvent(eventName: string, parameters?: Record<string, any>): void {
  pushToDataLayer({
    event: eventName,
    ...parameters,
  });
}

