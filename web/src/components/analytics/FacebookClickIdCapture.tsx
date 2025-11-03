"use client";

import { useEffect } from 'react';
import { captureFacebookClickId } from '@/utils/facebookTracking';

/**
 * Facebook Click ID Capture Component
 * 
 * Captures fbclid from URL parameter and stores it in _fbc cookie
 * This runs on every page load to ensure proper attribution tracking
 * 
 * ✅ Improves Event Match Quality (EMQ)
 * ✅ Fixes cross-session attribution
 * ✅ Enables accurate Facebook Ads reporting
 */
export default function FacebookClickIdCapture() {
  useEffect(() => {
    // Capture fbclid on mount (every page load)
    captureFacebookClickId();
  }, []);

  // This component doesn't render anything
  return null;
}

