"use client";

/**
 * Unified Tracking Hook
 * 
 * Single interface for tracking events to both GTM (dataLayer) and Klaviyo
 * Ensures consistent tracking across all platforms
 */

import { useCallback } from 'react';
import type { AnalyticsItem, UserData } from '@/lib/analytics/types';

// GTM DataLayer functions
import {
  trackViewItem as gtmViewItem,
  trackAddToCart as gtmAddToCart,
  trackRemoveFromCart as gtmRemoveFromCart,
  trackViewCart as gtmViewCart,
  trackBeginCheckout as gtmBeginCheckout,
  trackAddPaymentInfo as gtmAddPaymentInfo,
  trackPurchase as gtmPurchase,
  trackPageView as gtmPageView,
  trackCustomEvent as gtmCustomEvent,
} from '@/lib/analytics/dataLayer';

// Klaviyo functions
import {
  identifyKlaviyoProfile,
  trackKlaviyoViewedProduct,
  trackKlaviyoAddedToCart,
  trackKlaviyoStartedCheckout,
  trackKlaviyoPlacedOrder,
  trackKlaviyoEvent,
} from '@/lib/analytics/klaviyo';

export function useTracking() {
  /**
   * Identify user/customer
   */
  const identifyUser = useCallback((userData: UserData) => {
    // Klaviyo identification
    identifyKlaviyoProfile(userData);
    
    // GTM user properties (via custom event)
    gtmCustomEvent('user_identified', {
      user_id: userData.customer_id,
      user_email_hash: userData.email ? btoa(userData.email) : undefined,
    });
  }, []);

  /**
   * Track page view
   */
  const trackPageView = useCallback((path: string, title?: string) => {
    gtmPageView(path, title);
    
    // Klaviyo doesn't need explicit page views (tracked automatically)
  }, []);

  /**
   * Track product view
   */
  const trackProductView = useCallback((item: AnalyticsItem) => {
    // GTM
    gtmViewItem([item], item.price * item.quantity);
    
    // Klaviyo
    trackKlaviyoViewedProduct(item);
  }, []);

  /**
   * Track add to cart
   */
  const trackAddToCart = useCallback((items: AnalyticsItem[], totalValue?: number) => {
    const value = totalValue || items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // GTM
    gtmAddToCart(items, value);
    
    // Klaviyo
    trackKlaviyoAddedToCart(items, value);
  }, []);

  /**
   * Track remove from cart
   */
  const trackRemoveFromCart = useCallback((items: AnalyticsItem[], totalValue?: number) => {
    const value = totalValue || items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // GTM
    gtmRemoveFromCart(items, value);
    
    // Klaviyo (optional - not a standard Klaviyo event)
    trackKlaviyoEvent('Removed from Cart', {
      $value: value,
      ItemNames: items.map(i => i.item_name),
    });
  }, []);

  /**
   * Track view cart
   */
  const trackViewCart = useCallback((items: AnalyticsItem[], totalValue: number) => {
    // GTM
    gtmViewCart(items, totalValue);
    
    // Klaviyo (implicit - happens via page view)
  }, []);

  /**
   * Track checkout started
   */
  const trackCheckoutStarted = useCallback((
    items: AnalyticsItem[], 
    totalValue: number, 
    coupon?: string,
    userEmail?: string
  ) => {
    // Identify user if email provided
    if (userEmail) {
      identifyKlaviyoProfile({ email: userEmail });
    }
    
    // GTM
    gtmBeginCheckout(items, totalValue, coupon);
    
    // Klaviyo
    trackKlaviyoStartedCheckout(items, totalValue);
  }, []);

  /**
   * Track payment info added
   */
  const trackPaymentInfoAdded = useCallback((
    items: AnalyticsItem[], 
    totalValue: number, 
    paymentType?: string
  ) => {
    // GTM
    gtmAddPaymentInfo(items, totalValue, paymentType);
    
    // Klaviyo (optional event)
    trackKlaviyoEvent('Added Payment Info', {
      $value: totalValue,
      PaymentType: paymentType,
    });
  }, []);

  /**
   * Track purchase/order completed
   */
  const trackPurchase = useCallback((
    orderId: string,
    items: AnalyticsItem[],
    totalValue: number,
    options?: {
      tax?: number;
      shipping?: number;
      coupon?: string;
      billingAddress?: any;
      shippingAddress?: any;
      discountValue?: number;
    }
  ) => {
    // GTM
    gtmPurchase(orderId, items, totalValue, {
      tax: options?.tax,
      shipping: options?.shipping,
      coupon: options?.coupon,
    });
    
    // Klaviyo
    trackKlaviyoPlacedOrder(orderId, items, totalValue, {
      billingAddress: options?.billingAddress,
      shippingAddress: options?.shippingAddress,
      discountCode: options?.coupon,
      discountValue: options?.discountValue,
    });
  }, []);

  /**
   * Track custom event
   */
  const trackCustomEvent = useCallback((
    eventName: string, 
    properties?: Record<string, any>
  ) => {
    // GTM
    gtmCustomEvent(eventName, properties);
    
    // Klaviyo (optional, only for relevant events)
    if (eventName.startsWith('klaviyo_')) {
      trackKlaviyoEvent(eventName.replace('klaviyo_', ''), properties);
    }
  }, []);

  return {
    identifyUser,
    trackPageView,
    trackProductView,
    trackAddToCart,
    trackRemoveFromCart,
    trackViewCart,
    trackCheckoutStarted,
    trackPaymentInfoAdded,
    trackPurchase,
    trackCustomEvent,
  };
}

