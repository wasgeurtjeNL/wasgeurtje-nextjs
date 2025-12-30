"use client";

import { useEffect, useState } from "react";

interface WordPressOptions {
  checkout_version?: 'A' | 'B' | 'RANDOM';
  cart_sidebar_version?: 'A' | 'B' | 'RANDOM';
  [key: string]: any;
}

/**
 * Hook to fetch WordPress theme options (ACF Options Page)
 * This hook fetches options including checkout_version and cart_sidebar_version
 */
export function useWordPressOptions() {
  const [options, setOptions] = useState<WordPressOptions>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      console.log('[useWordPressOptions] Starting fetch...');
      try {
        // Client-side fetch - don't use 'next' option (only works server-side)
        // Use 'no-store' to always get fresh data from WordPress
        const apiUrl = '/api/wordpress/options';
        console.log('[useWordPressOptions] Fetching from:', apiUrl);
        
        const response = await fetch(apiUrl, {
          cache: 'no-store',
        });

        console.log('[useWordPressOptions] Response status:', response.status, response.statusText);

        if (!response.ok) {
          throw new Error(`Failed to fetch options: ${response.status}`);
        }

        const data = await response.json();
        console.log('[useWordPressOptions] Fetched data:', data);
        console.log('[useWordPressOptions] checkout_version:', data.checkout_version);
        console.log('[useWordPressOptions] cart_sidebar_version:', data.cart_sidebar_version);
        
        setOptions(data);
        setError(null);
        console.log('[useWordPressOptions] Options state updated');
      } catch (err) {
        console.error('[useWordPressOptions] Error fetching WordPress options:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Return empty object on error - will fall back to defaults
        setOptions({});
      } finally {
        setLoading(false);
        console.log('[useWordPressOptions] Loading set to false');
      }
    };

    fetchOptions();
  }, []);

  return { options, loading, error };
}

/**
 * Get checkout version from WordPress options or fallback to default
 */
export function getCheckoutVersion(options: WordPressOptions, defaultValue: 'A' | 'B' | 'RANDOM' = 'A'): 'A' | 'B' | 'RANDOM' {
  return options.checkout_version || defaultValue;
}

/**
 * Get cart sidebar version from WordPress options or fallback to default
 */
export function getCartSidebarVersion(options: WordPressOptions, defaultValue: 'A' | 'B' | 'RANDOM' = 'A'): 'A' | 'B' | 'RANDOM' {
  return options.cart_sidebar_version || defaultValue;
}

