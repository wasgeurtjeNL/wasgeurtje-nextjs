"use client";

/**
 * 🎯 OPTIMIZATION 8: Engagement Tracker
 * Tracks time on page and scroll depth for high-intent user identification
 * 
 * Sends engagement data to Intelligence system when:
 * - User spends >30 seconds on page, OR
 * - User scrolls >50% of page
 */

import { useEffect, useRef } from 'react';
import { trackEngagement } from '@/hooks/useCustomerTracking';

export default function EngagementTracker() {
  const startTimeRef = useRef<number>(Date.now());
  const maxScrollDepthRef = useRef<number>(0);
  const hasTrackedRef = useRef<boolean>(false);

  useEffect(() => {
    let scrollCheckInterval: NodeJS.Timeout;

    // Calculate scroll depth
    const calculateScrollDepth = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      
      const scrollDepth = Math.round(
        ((scrollTop + windowHeight) / documentHeight) * 100
      );
      
      // Update max scroll depth
      if (scrollDepth > maxScrollDepthRef.current) {
        maxScrollDepthRef.current = Math.min(scrollDepth, 100);
      }
    };

    // Check engagement criteria
    const checkAndTrackEngagement = () => {
      if (hasTrackedRef.current) return;

      const timeOnPage = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const scrollDepth = maxScrollDepthRef.current;

      // Track if user is engaged (>30s or >50% scroll)
      if (timeOnPage > 30 || scrollDepth > 50) {
        trackEngagement(timeOnPage, scrollDepth);
        hasTrackedRef.current = true;
        
        console.log(`[Engagement] ✅ Tracked: ${timeOnPage}s, ${scrollDepth}% scroll`);
      }
    };

    // Set up scroll listener
    const handleScroll = () => {
      calculateScrollDepth();
      checkAndTrackEngagement();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Check engagement every 10 seconds
    scrollCheckInterval = setInterval(() => {
      calculateScrollDepth();
      checkAndTrackEngagement();
    }, 10000);

    // Track on page unload (if not already tracked)
    const handleBeforeUnload = () => {
      if (!hasTrackedRef.current) {
        const timeOnPage = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const scrollDepth = maxScrollDepthRef.current;
        
        if (timeOnPage > 30 || scrollDepth > 50) {
          // Use sendBeacon for reliable tracking on page unload
          navigator.sendBeacon(
            '/api/intelligence/track-customer',
            JSON.stringify({
              event_type: 'engaged_session',
              time_on_page: timeOnPage,
              scroll_depth: scrollDepth,
            })
          );
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(scrollCheckInterval);
    };
  }, []);

  // This component doesn't render anything
  return null;
}

