/**
 * Type definitions for analytics events
 * Based on Google Analytics 4 Enhanced Ecommerce spec
 */

// Product/Item interface
export interface AnalyticsItem {
  item_id: string | number;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  item_category2?: string;
  item_category3?: string;
  item_variant?: string;
  price: number;
  quantity: number;
  currency?: string;
  discount?: number;
  coupon?: string;
  affiliation?: string;
  item_list_name?: string;
  item_list_id?: string;
  index?: number;
  
  // WordPress/WooCommerce GTM compatibility properties
  sku?: string;                        // Product SKU for inventory tracking
  id?: string;                         // GLA prefixed ID for Google Ads (e.g. "gla_1425")
  stockstatus?: 'instock' | 'outofstock' | 'onbackorder'; // Stock availability
  stocklevel?: number | null;          // Stock quantity (null if not tracked)
  google_business_vertical?: string;   // Google Shopping classification (usually "retail")
}

// E-commerce events
export interface ViewItemEvent {
  event: 'view_item';
  ecommerce: {
    items: AnalyticsItem[];
    currency?: string;
    value?: number;
  };
}

export interface AddToCartEvent {
  event: 'add_to_cart';
  ecommerce: {
    items: AnalyticsItem[];
    currency?: string;
    value?: number;
  };
}

export interface RemoveFromCartEvent {
  event: 'remove_from_cart';
  ecommerce: {
    items: AnalyticsItem[];
    currency?: string;
    value?: number;
  };
}

export interface ViewCartEvent {
  event: 'view_cart';
  ecommerce: {
    items: AnalyticsItem[];
    currency?: string;
    value?: number;
  };
}

export interface BeginCheckoutEvent {
  event: 'begin_checkout';
  ecommerce: {
    items: AnalyticsItem[];
    currency?: string;
    value?: number;
    coupon?: string;
  };
}

export interface AddPaymentInfoEvent {
  event: 'add_payment_info';
  ecommerce: {
    items: AnalyticsItem[];
    currency?: string;
    value?: number;
    payment_type?: string;
  };
}

export interface PurchaseEvent {
  event: 'purchase';
  ecommerce: {
    transaction_id: string;
    affiliation?: string;
    value: number;
    tax?: number;
    shipping?: number;
    currency?: string;
    coupon?: string;
    items: AnalyticsItem[];
  };
}

// User/Customer data
export interface UserData {
  email?: string;
  phone?: string;
  customer_id?: number;
  first_name?: string;
  last_name?: string;
}

// DataLayer type
export type DataLayerEvent = 
  | ViewItemEvent
  | AddToCartEvent
  | RemoveFromCartEvent
  | ViewCartEvent
  | BeginCheckoutEvent
  | AddPaymentInfoEvent
  | PurchaseEvent
  | { event: string; [key: string]: any };

// Window dataLayer augmentation
declare global {
  interface Window {
    dataLayer: DataLayerEvent[];
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
    _learnq?: any[];
    klaviyo?: any;
  }
}

