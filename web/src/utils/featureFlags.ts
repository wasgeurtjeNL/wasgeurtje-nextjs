/**
 * Feature Flags Configuration
 * 
 * This file contains feature flags that can be toggled to enable/disable features.
 * Set a flag to `true` to enable the feature, or `false` to disable it.
 */

export const FeatureFlags = {
  /**
   * Volume Discount Feature
   * When enabled, customers get 10% discount when subtotal is €75 or more
   * @default false (disabled)
   */
  ENABLE_VOLUME_DISCOUNT: false,
  
  /**
   * Cart Sidebar Version
   * Options: 'A' | 'B' | 'RANDOM'
   * - 'A': Always use version A (current implementation)
   * - 'B': Always use version B (new implementation based on wasgeurtje.nl)
   * - 'RANDOM': 50/50 split for A/B testing (uses cookie to maintain consistency per user)
   * @default 'A'
   */
  CART_SIDEBAR_VERSION: 'A' as 'A' | 'B' | 'RANDOM',
  
  /**
   * Checkout Page Version
   * Options: 'A' | 'B' | 'RANDOM'
   * - 'A': Always use version A (current implementation)
   * - 'B': Always use version B (new implementation based on wasgeurtje.nl)
   * - 'RANDOM': 50/50 split for A/B testing (uses cookie to maintain consistency per user)
   * @default 'A'
   */
  CHECKOUT_VERSION: 'A' as 'A' | 'B' | 'RANDOM',
} as const;

