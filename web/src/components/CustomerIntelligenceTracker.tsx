"use client";

/**
 * Customer Intelligence Tracker
 * 
 * Automatically tracks:
 * - Page views for all visitors
 * - Logged-in users
 * - IP address changes
 * - Browser fingerprinting
 */

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCustomerTracking } from '@/hooks/useCustomerTracking';

export default function CustomerIntelligenceTracker() {
  const { user } = useAuth();
  const { trackCustomer } = useCustomerTracking({
    oncePerSession: true
  });

  useEffect(() => {
    // Track page view for logged-in users
    if (user?.email) {
      trackCustomer(user.email, user.id ? parseInt(String(user.id)) : undefined);
    }
    // For anonymous users, fingerprinting happens automatically in the hook
  }, [user?.email, user?.id, trackCustomer]);

  // This component doesn't render anything
  return null;
}

