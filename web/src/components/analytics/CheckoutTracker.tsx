"use client";

/**
 * Checkout Tracker Component
 * 
 * Tracks checkout events for both GTM and Klaviyo
 * - Checkout started (on page load)
 * - Checkout email entered
 * - Payment info added
 */

import { useEffect, useRef } from 'react';
import { useCart, CartItem } from '@/context/CartContext';
import { useTracking } from '@/hooks/useTracking';
import type { AnalyticsItem } from '@/lib/analytics/types';

interface CheckoutTrackerProps {
  email?: string;
  step?: 'details' | 'payment';
}

/**
 * Convert CartItem to AnalyticsItem
 * Includes WordPress/WooCommerce GTM compatibility properties
 */
function convertCartItemToAnalyticsItem(item: CartItem): AnalyticsItem {
  return {
    item_id: item.id,
    item_name: item.title,
    item_brand: 'Wasgeurtje',
    item_category: 'Wasparfum', // Default category
    price: item.price,
    quantity: item.quantity,
    currency: 'EUR',
    item_variant: item.variant,
    
    // WordPress/WooCommerce GTM compatibility properties
    sku: `WSG-WP-${item.id}`,            // Generate SKU from product ID
    id: `gla_${item.id}`,                 // GLA prefixed ID for Google Ads
    stockstatus: 'instock',               // Default to in stock (can be dynamic)
    stocklevel: null,                     // Not tracked currently
    google_business_vertical: 'retail',   // Google Shopping classification
  };
}

export default function CheckoutTracker({ email, step = 'details' }: CheckoutTrackerProps) {
  const { items, subtotal } = useCart();
  const { trackCheckoutStarted, identifyUser } = useTracking();
  
  // Track if we've already tracked checkout started
  const hasTrackedCheckoutStartRef = useRef(false);
  const lastTrackedEmailRef = useRef<string | null>(null);

  // Track checkout started (once per session)
  useEffect(() => {
    if (!hasTrackedCheckoutStartRef.current && items.length > 0) {
      const analyticsItems = items.map(convertCartItemToAnalyticsItem);
      
      trackCheckoutStarted(
        analyticsItems,
        subtotal,
        undefined, // coupon
        email
      );
      
      hasTrackedCheckoutStartRef.current = true;
      
      console.log('[CheckoutTracker] Checkout started tracked:', {
        items: analyticsItems.length,
        value: subtotal,
        email: email || 'not provided',
      });
    }
  }, [items, subtotal, email, trackCheckoutStarted]);

  // Track email identification
  useEffect(() => {
    if (email && email !== lastTrackedEmailRef.current) {
      identifyUser({ email });
      lastTrackedEmailRef.current = email;
      
      console.log('[CheckoutTracker] User identified:', email);
    }
  }, [email, identifyUser]);

  // This component doesn't render anything
  return null;
}

