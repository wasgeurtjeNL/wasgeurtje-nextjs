"use client";

/**
 * Cart Tracker Component
 * 
 * Monitors cart changes and tracks add/remove events
 * to both GTM (dataLayer) and Klaviyo
 */

import { useEffect, useRef } from 'react';
import { useCart, CartItem } from '@/context/CartContext';
import { useTracking } from '@/hooks/useTracking';
import type { AnalyticsItem } from '@/lib/analytics/types';

/**
 * Convert CartItem to AnalyticsItem
 * Includes WordPress/WooCommerce GTM compatibility properties
 */
function convertCartItemToAnalyticsItem(item: CartItem): AnalyticsItem {
  return {
    item_id: item.id,
    item_name: item.title,
    item_brand: 'Wasgeurtje',
    item_category: 'Wasparfum',
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

/**
 * Deep compare cart items to detect additions/removals
 */
function getCartChanges(oldItems: CartItem[], newItems: CartItem[]): {
  added: CartItem[];
  removed: CartItem[];
} {
  const added: CartItem[] = [];
  const removed: CartItem[] = [];

  // Find added/increased items
  newItems.forEach((newItem) => {
    const oldItem = oldItems.find(
      (i) => i.id === newItem.id && i.variant === newItem.variant
    );

    if (!oldItem) {
      // Completely new item
      added.push(newItem);
    } else if (newItem.quantity > oldItem.quantity) {
      // Quantity increased
      added.push({
        ...newItem,
        quantity: newItem.quantity - oldItem.quantity,
      });
    }
  });

  // Find removed/decreased items
  oldItems.forEach((oldItem) => {
    const newItem = newItems.find(
      (i) => i.id === oldItem.id && i.variant === oldItem.variant
    );

    if (!newItem) {
      // Item completely removed
      removed.push(oldItem);
    } else if (oldItem.quantity > newItem.quantity) {
      // Quantity decreased
      removed.push({
        ...oldItem,
        quantity: oldItem.quantity - newItem.quantity,
      });
    }
  });

  return { added, removed };
}

export default function CartTracker() {
  const { items } = useCart();
  const { trackAddToCart, trackRemoveFromCart } = useTracking();
  
  // Track previous cart items
  const previousItemsRef = useRef<CartItem[]>([]);
  
  // Skip initial mount (don't track cart loaded from localStorage)
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Skip tracking on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousItemsRef.current = items;
      return;
    }

    // Detect changes
    const { added, removed } = getCartChanges(previousItemsRef.current, items);

    // Track additions
    if (added.length > 0) {
      const analyticsItems = added.map(convertCartItemToAnalyticsItem);
      const totalValue = added.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      trackAddToCart(analyticsItems, totalValue);
      
      console.log('[CartTracker] Added to cart:', {
        items: analyticsItems.map(i => i.item_name),
        value: totalValue,
      });
    }

    // Track removals
    if (removed.length > 0) {
      const analyticsItems = removed.map(convertCartItemToAnalyticsItem);
      const totalValue = removed.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      trackRemoveFromCart(analyticsItems, totalValue);
      
      console.log('[CartTracker] Removed from cart:', {
        items: analyticsItems.map(i => i.item_name),
        value: totalValue,
      });
    }

    // Update previous items
    previousItemsRef.current = items;
  }, [items, trackAddToCart, trackRemoveFromCart]);

  // This component doesn't render anything
  return null;
}

