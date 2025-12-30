"use client";

import { useEffect, useState } from "react";
import { FeatureFlags } from "@/utils/featureFlags";
import CartSidebar from "./CartSidebar";
import CartSidebarV2 from "./CartSidebarV2";
import { useWordPressOptions, getCartSidebarVersion } from "@/contexts/WordPressOptionsContext";

/**
 * CartSidebarWrapper
 * 
 * This component handles A/B testing between CartSidebar (version A) and CartSidebarV2 (version B).
 * 
 * When CART_SIDEBAR_VERSION is set to 'RANDOM', it uses a cookie to maintain consistency
 * per user, ensuring they always see the same version during their session.
 * 
 * The version is determined by WordPress ACF options (cart_sidebar_version field) or falls back to FeatureFlags.
 */
export default function CartSidebarWrapper() {
  const [version, setVersion] = useState<'A' | 'B'>('A');
  const { options, loading } = useWordPressOptions();

  useEffect(() => {
    // Don't run if still loading
    if (loading) {
      return;
    }
    
    // Get version from WordPress options or fallback to FeatureFlags
    const wpVersion = getCartSidebarVersion(options, FeatureFlags.CART_SIDEBAR_VERSION);
    const flagValue = wpVersion;
    const cookieName = 'wg-cart-sidebar-version';

    if (flagValue === 'A') {
      // Explicitly set to A: clear cookie and force version A
      deleteCookie(cookieName);
      setVersion('A');
    } else if (flagValue === 'B') {
      // Explicitly set to B: clear cookie and force version B
      deleteCookie(cookieName);
      setVersion('B');
    } else if (flagValue === 'RANDOM') {
      // Check if user already has a version assigned
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

  // Render the appropriate version (fallback to version A while loading)
  return version === 'A' ? <CartSidebar /> : <CartSidebarV2 />;
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

/**
 * Helper function to delete cookie
 */
function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

