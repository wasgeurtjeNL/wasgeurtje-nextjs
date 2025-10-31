"use client";
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  // Always start with false to match SSR
  // This prevents hydration mismatch
  const [matches, setMatches] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Mark as mounted
    setMounted(true);
    
    // Create media query list
    const media = window.matchMedia(query);
    
    // Set initial state based on current match
    setMatches(media.matches);

    // Define listener for future changes
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    
    // Add listener only once per query change
    media.addEventListener('change', listener);
    
    // Cleanup: remove listener when component unmounts or query changes
    return () => media.removeEventListener('change', listener);
  }, [query]); // Only re-run when query changes, NOT when matches changes

  // Return false during SSR and initial client render to prevent hydration mismatch
  // After mount, return actual matches value
  return mounted ? matches : false;
}

// Predefined breakpoints matching tailwind defaults
export const breakpoints = {
  sm: '(min-width: 640px)',
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
  '2xl': '(min-width: 1536px)',
};

// Custom breakpoints for specific device ranges
export const deviceBreakpoints = {
  smallMobile: '(max-width: 390px)', // iPhone mini, SE, etc.
  mobile: '(max-width: 639px)',
  ipadMini: '(min-width: 640px) and (max-width: 768px)', // iPad Mini specific
  tablet: '(min-width: 640px) and (max-width: 1023px)',
  desktop: '(min-width: 1024px)',
};
