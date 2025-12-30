"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface WordPressOptions {
  checkout_version?: 'A' | 'B' | 'RANDOM';
  cart_sidebar_version?: 'A' | 'B' | 'RANDOM';
  [key: string]: any;
}

interface WordPressOptionsContextType {
  options: WordPressOptions;
  loading: boolean;
  error: string | null;
}

const WordPressOptionsContext = createContext<WordPressOptionsContextType | undefined>(undefined);

/**
 * Provider component that fetches WordPress options once and shares them with all children
 */
export function WordPressOptionsProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<WordPressOptions>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      console.log('[WordPressOptionsProvider] Starting fetch...');
      try {
        const apiUrl = '/api/wordpress/options';
        console.log('[WordPressOptionsProvider] Fetching from:', apiUrl);
        
        const response = await fetch(apiUrl, {
          cache: 'no-store',
        });

        console.log('[WordPressOptionsProvider] Response status:', response.status);

        if (!response.ok) {
          throw new Error(`Failed to fetch options: ${response.status}`);
        }

        const data = await response.json();
        console.log('[WordPressOptionsProvider] Fetched data:', data);
        
        setOptions(data);
        setError(null);
      } catch (err) {
        console.error('[WordPressOptionsProvider] Error fetching WordPress options:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setOptions({});
      } finally {
        setLoading(false);
        console.log('[WordPressOptionsProvider] Loading complete');
      }
    };

    fetchOptions();
  }, []); // Only fetch once on mount

  return (
    <WordPressOptionsContext.Provider value={{ options, loading, error }}>
      {children}
    </WordPressOptionsContext.Provider>
  );
}

/**
 * Hook to access WordPress options from any component
 */
export function useWordPressOptions() {
  const context = useContext(WordPressOptionsContext);
  if (context === undefined) {
    throw new Error('useWordPressOptions must be used within a WordPressOptionsProvider');
  }
  return context;
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





