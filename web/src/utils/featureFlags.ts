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
} as const;

