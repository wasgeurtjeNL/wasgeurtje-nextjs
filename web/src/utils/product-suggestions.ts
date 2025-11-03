/**
 * Central utility for smart product suggestions
 * Used by both checkout page and cart sidebar
 */

export interface ProductSuggestion {
  productId: string;
  message: string;
  isFromHistory: boolean; // Whether this is based on purchase history
}

export interface CartItem {
  id: string;
  title?: string;
  quantity?: number;
}

/**
 * Get smart product suggestion based on waterfall logic
 * 
 * Waterfall priority:
 * 1. Product 334999 (proefpakket) - if not purchased and not in cart
 * 2. Product 267628 (tweede proefpakket) - if not purchased and not in cart
 * 3. Product 335060 (wasstrips) - if not purchased and not in cart
 * 4. Favorite from purchase history (if available) - if not in cart
 * 5. No suggestion - don't suggest products already in cart (not logical!)
 * 
 * @param purchasedProductIds - Array of product IDs the customer has purchased before (empty if unknown)
 * @param cartItems - Current items in the cart
 * @param subtotal - Current cart subtotal
 * @param hasMultipleInCart - Whether there are already suggested products in cart (for message variation)
 * @returns ProductSuggestion or null if no suggestion needed
 */
export function getSmartProductSuggestion(
  purchasedProductIds: string[],
  cartItems: CartItem[],
  subtotal: number,
  hasMultipleInCart: boolean = false
): ProductSuggestion | null {
  // Don't suggest if free shipping is reached
  const FREE_SHIPPING_THRESHOLD = 40;
  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    return null;
  }

  // Helper function to check if product is already in cart
  const isInCart = (productId: string) => cartItems.some(item => item.id === productId);
  
  // Never suggest cap products (they should never be visible anywhere)
  const CAP_PRODUCTS = ["348218", "348219"];

  // Define product suggestions in priority order with their messages
const productSuggestions = [
    {
      id: "334999",
      messages: {
        first: "Deze 5 heerlijke geuren heb je nog niet eerder geprobeerd! 🌸",
        additional: "Voeg nog een proefpakket toe voor gratis verzending! 🎁",
        generic: "Probeer onze populaire proefpakket! 🌸",
        genericAdditional: "Voeg een proefpakket toe voor gratis verzending! 🎁"
      }
    },
    {
      id: "267628",
      messages: {
        first: "Deze 5 nieuwe geuren heb je niet eerder geprobeerd! ✨",
        additional: "Probeer dit tweede proefpakket voor gratis verzending! 💫",
        generic: "Ontdek 5 nieuwe geuren! ✨",
        genericAdditional: "Probeer dit tweede proefpakket voor gratis verzending! 💫"
      }
    },
    {
      id: "335060",
      messages: {
        first: "Probeer onze populaire wasstrips! 🧺",
        additional: "Voeg wasstrips toe om gratis verzending te bereiken! 🚚",
        generic: "Probeer onze populaire wasstrips! 🧺",
        genericAdditional: "Voeg wasstrips toe om gratis verzending te bereiken! 🚚"
      }
    }
  ];

  const hasPurchaseHistory = purchasedProductIds.length > 0;

  // Loop through suggestions and find the first one that's not purchased and not in cart
  for (const suggestion of productSuggestions) {
    // Skip cap products entirely
    if (CAP_PRODUCTS.includes(suggestion.id)) {
      continue;
    }
    
    const notPurchased = !purchasedProductIds.includes(suggestion.id);
    const notInCart = !isInCart(suggestion.id);

    if (notInCart) {
      // If we don't have purchase history, always suggest if not in cart
      if (!hasPurchaseHistory) {
        const message = hasMultipleInCart 
          ? suggestion.messages.genericAdditional 
          : suggestion.messages.generic;
        return {
          productId: suggestion.id,
          message,
          isFromHistory: false
        };
      }
      
      // If we have purchase history, only suggest if not purchased
      if (notPurchased) {
        const message = hasMultipleInCart 
          ? suggestion.messages.additional 
          : suggestion.messages.first;
        return {
          productId: suggestion.id,
          message,
          isFromHistory: true
        };
      }
    }
  }

  // If no new products to suggest, suggest a favorite from their past (only if we have history)
  if (hasPurchaseHistory) {
    // Find favorite that's not in cart AND not a cap product
    const favoriteNotInCart = purchasedProductIds.find(id => !isInCart(id) && !CAP_PRODUCTS.includes(id));
    if (favoriteNotInCart) {
      // Different message for wasstrips vs geuren
      const isWasstrips = favoriteNotInCart === "335060";
      let message: string;
      
      if (isWasstrips) {
        message = hasMultipleInCart
          ? "Compleet je wasroutine met wasstrips voor gratis verzending! 🧺"
          : "Upgrade je wasmiddel! Probeer onze wasstrips 🌿";
      } else {
        message = hasMultipleInCart
          ? "Tijd voor een refill van je favoriet + gratis verzending! 🎁"
          : "Mis je favoriete geur nooit meer! Bestel nu 🌸";
      }
      
      return {
        productId: favoriteNotInCart,
        message,
        isFromHistory: true
      };
    }
  }

  // No more suggestions - all standard products are in cart
  // and we have no purchase history to suggest favorites
  // Don't suggest duplicates - that's not logical!
  return null;
}

/**
 * Extract purchased product IDs from order data
 * Compatible with both AuthContext orders and WooCommerce API responses
 */
export function extractPurchasedProductIds(orders: any[]): string[] {
  if (!orders || orders.length === 0) return [];
  
  const productIds = new Set<string>();
  
  orders.forEach(order => {
    const items = order.items || order.line_items || [];
    items.forEach((item: any) => {
      const productId = item.id || item.product_id;
      if (productId) {
        productIds.add(String(productId));
      }
    });
  });
  
  return Array.from(productIds);
}

