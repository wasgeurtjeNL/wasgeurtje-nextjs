/**
 * Klaviyo Direct SDK Tracking
 * 
 * Direct client-side tracking voor Klaviyo (los van GTM)
 * Gebruikt de Klaviyo JavaScript API voor real-time e-commerce events
 */

import type { AnalyticsItem, UserData } from './types';
import { analyticsConfig, isTrackingEnabled } from './config';

/**
 * Initialize Klaviyo _learnq array if it doesn't exist
 */
export function initializeKlaviyo(): void {
  if (typeof window === 'undefined') return;
  
  window._learnq = window._learnq || [];
  
  if (analyticsConfig.debug) {
    console.log('[Klaviyo] Initialized');
  }
}

/**
 * Check if Klaviyo is loaded
 */
export function isKlaviyoLoaded(): boolean {
  return typeof window !== 'undefined' && 
         (typeof window.klaviyo !== 'undefined' || typeof window._learnq !== 'undefined');
}

/**
 * Push to Klaviyo queue
 */
function pushToKlaviyo(...args: any[]): void {
  if (typeof window === 'undefined') return;
  if (!isTrackingEnabled()) {
    if (analyticsConfig.debug) {
      console.log('[Klaviyo] Tracking disabled, skipping:', args);
    }
    return;
  }

  // Initialize if needed
  if (!window._learnq) {
    initializeKlaviyo();
  }

  // Push to queue
  window._learnq!.push(args);

  if (analyticsConfig.debug) {
    console.log('[Klaviyo] Event pushed:', args);
  }
}

/**
 * Identify customer/profile
 */
export function identifyKlaviyoProfile(data: UserData): void {
  const profileData: Record<string, any> = {};

  if (data.email) profileData.$email = data.email;
  if (data.phone) profileData.$phone_number = data.phone;
  if (data.first_name) profileData.$first_name = data.first_name;
  if (data.last_name) profileData.$last_name = data.last_name;
  if (data.customer_id) profileData.$id = data.customer_id;

  pushToKlaviyo('identify', profileData);
}

/**
 * Track custom Klaviyo event
 */
export function trackKlaviyoEvent(eventName: string, properties?: Record<string, any>): void {
  pushToKlaviyo('track', eventName, properties || {});
}

/**
 * Convert AnalyticsItem to Klaviyo format
 */
function convertToKlaviyoItems(items: AnalyticsItem[]): any[] {
  return items.map(item => ({
    ProductID: item.item_id,
    ProductName: item.item_name,
    SKU: item.item_id,
    ProductURL: typeof window !== 'undefined' ? window.location.origin + '/product/' + item.item_id : '',
    ImageURL: '', // Can be enhanced if you have image URLs
    Categories: [item.item_category, item.item_category2, item.item_category3].filter(Boolean),
    Brand: item.item_brand || 'Wasgeurtje',
    Price: item.price,
    CompareAtPrice: item.price,
    Quantity: item.quantity,
  }));
}

/**
 * Track Viewed Product
 */
export function trackKlaviyoViewedProduct(item: AnalyticsItem): void {
  trackKlaviyoEvent('Viewed Product', {
    ProductID: item.item_id,
    ProductName: item.item_name,
    SKU: item.item_id,
    Categories: [item.item_category, item.item_category2].filter(Boolean),
    Brand: item.item_brand || 'Wasgeurtje',
    Price: item.price,
    CompareAtPrice: item.price,
    ProductURL: typeof window !== 'undefined' ? window.location.href : '',
  });
}

/**
 * Track Added to Cart
 */
export function trackKlaviyoAddedToCart(items: AnalyticsItem[], value: number): void {
  trackKlaviyoEvent('Added to Cart', {
    $value: value,
    AddedItemProductName: items[0]?.item_name,
    AddedItemProductID: items[0]?.item_id,
    AddedItemSKU: items[0]?.item_id,
    AddedItemCategories: [items[0]?.item_category].filter(Boolean),
    AddedItemImageURL: '',
    AddedItemURL: typeof window !== 'undefined' ? window.location.href : '',
    AddedItemPrice: items[0]?.price,
    AddedItemQuantity: items[0]?.quantity,
    ItemNames: items.map(i => i.item_name),
    CheckoutURL: typeof window !== 'undefined' ? window.location.origin + '/checkout' : '',
    Items: convertToKlaviyoItems(items),
  });
}

/**
 * Track Started Checkout
 */
export function trackKlaviyoStartedCheckout(items: AnalyticsItem[], value: number, checkoutUrl?: string): void {
  trackKlaviyoEvent('Started Checkout', {
    $event_id: `checkout_${Date.now()}`,
    $value: value,
    ItemNames: items.map(i => i.item_name),
    CheckoutURL: checkoutUrl || (typeof window !== 'undefined' ? window.location.href : ''),
    Categories: items.map(i => i.item_category).filter(Boolean),
    Items: convertToKlaviyoItems(items),
  });
}

/**
 * Track Placed Order (Purchase)
 */
export function trackKlaviyoPlacedOrder(
  orderId: string,
  items: AnalyticsItem[],
  value: number,
  options?: {
    billingAddress?: any;
    shippingAddress?: any;
    discountCode?: string;
    discountValue?: number;
  }
): void {
  trackKlaviyoEvent('Placed Order', {
    $event_id: orderId,
    $value: value,
    OrderId: orderId,
    Categories: items.map(i => i.item_category).filter(Boolean),
    ItemNames: items.map(i => i.item_name),
    Brands: items.map(i => i.item_brand || 'Wasgeurtje'),
    DiscountCode: options?.discountCode,
    DiscountValue: options?.discountValue || 0,
    Items: convertToKlaviyoItems(items),
    BillingAddress: options?.billingAddress,
    ShippingAddress: options?.shippingAddress,
  });
}

/**
 * Track Ordered Product (individual product in order)
 */
export function trackKlaviyoOrderedProduct(item: AnalyticsItem, orderId: string): void {
  trackKlaviyoEvent('Ordered Product', {
    $event_id: `${orderId}_${item.item_id}`,
    OrderId: orderId,
    ProductID: item.item_id,
    ProductName: item.item_name,
    SKU: item.item_id,
    ProductURL: typeof window !== 'undefined' ? window.location.origin + '/product/' + item.item_id : '',
    Categories: [item.item_category].filter(Boolean),
    Brand: item.item_brand || 'Wasgeurtje',
    Price: item.price,
    Quantity: item.quantity,
  });
}

/**
 * Subscribe to newsletter/email list
 */
export function subscribeKlaviyoNewsletter(email: string, listId?: string): void {
  pushToKlaviyo('identify', {
    $email: email,
    $consent: ['email'],
  });

  // Track subscription event
  trackKlaviyoEvent('Subscribed to Newsletter', {
    $email: email,
    ListId: listId,
  });
}

/**
 * Track custom product interaction
 */
export function trackKlaviyoProductInteraction(
  eventName: string,
  item: AnalyticsItem,
  additionalProps?: Record<string, any>
): void {
  trackKlaviyoEvent(eventName, {
    ProductID: item.item_id,
    ProductName: item.item_name,
    Price: item.price,
    ...additionalProps,
  });
}

