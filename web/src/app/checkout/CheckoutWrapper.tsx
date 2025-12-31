"use client";

import { useEffect, useState } from "react";
import { FeatureFlags } from "@/utils/featureFlags";
import { CheckoutPage } from "./CheckoutPage";
import CheckoutPageV2 from "./CheckoutPageV2";
import { useWordPressOptions, getCheckoutVersion } from "@/contexts/WordPressOptionsContext";

/**
 * CheckoutWrapper
 * 
 * This component handles A/B testing between CheckoutPage (version A) and CheckoutPageV2 (version B).
 * 
 * When CHECKOUT_VERSION is set to 'RANDOM', it uses a cookie to maintain consistency
 * per user, ensuring they always see the same version during their session.
 * 
 * The version is determined by WordPress ACF options (checkout_version field) or falls back to FeatureFlags.
 */
export default function CheckoutWrapper() {
  const [version, setVersion] = useState<'A' | 'B'>('A');
  const { options, loading } = useWordPressOptions();

  useEffect(() => {
    // Don't run if still loading
    if (loading) {
      return;
    }
    
    // Get version from WordPress options or fallback to FeatureFlags
    const wpVersion = getCheckoutVersion(options, FeatureFlags.CHECKOUT_VERSION);
    const flagValue = wpVersion;

    if (flagValue === 'A') {
      setVersion('A');
    } else if (flagValue === 'B') {
      setVersion('B');
    } else if (flagValue === 'RANDOM') {
      // Check if user already has a version assigned
      const cookieName = 'wg-checkout-version';
      const existingVersion = getCookie(cookieName);

      if (existingVersion === 'A' || existingVersion === 'B') {
        setVersion(existingVersion);
      } else {
        // Randomly assign version (50/50 split)
        const randomVersion = Math.random() < 0.5 ? 'A' : 'B';
        setVersion(randomVersion);
        // Store in cookie for 30 days
        setCookie(cookieName, randomVersion, 30);
      }
    }
  }, [options, loading]);

  // Show loading state or render the appropriate version
  if (loading) {
    // Fallback to version A while loading
    return <CheckoutPage />;
  }

  // Render the appropriate version
  return version === 'A' ? <CheckoutPage /> : <CheckoutPageV2 />;
}

/**
 * Helper function to get cookie value
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

/**
 * Helper function to set cookie
 */
function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/`;
}

