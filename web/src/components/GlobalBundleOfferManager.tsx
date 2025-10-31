"use client";

/**
 * Global Bundle Offer Manager
 * 
 * Shows bundle offers based on IP recognition
 * - Checks if user's IP is known in database
 * - Fetches customer profile automatically
 * - Shows bundle offer popup if eligible
 * - EXCLUDED from checkout page (data collection only)
 */

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import BundleOfferPopup from './BundleOfferPopup';

export default function GlobalBundleOfferManager() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [showOffer, setShowOffer] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // Don't show on checkout or payment pages
  const isExcludedPage = pathname?.startsWith('/checkout') || 
                         pathname?.startsWith('/payment') ||
                         pathname?.startsWith('/cart');

  useEffect(() => {
    if (isExcludedPage || hasChecked) return;

    const checkForBundleOffer = async () => {
      try {
        // Step 1: Try to identify customer by IP + Fingerprint
        console.log('[Bundle] Checking for IP-based recognition...');
        
        // Get fingerprint from localStorage (same key as getStoredFingerprint uses)
        const fingerprint = localStorage.getItem('wg_device_fp');
        
        console.log('[Bundle] Sending fingerprint:', fingerprint ? 'Yes' : 'No');
        
        const ipCheckResponse = await fetch('/api/intelligence/track-customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // No event_type - just device tracking update, no event logging
            fingerprint: fingerprint
          })
        });

        const ipCheckData = await ipCheckResponse.json();
        console.log('[Bundle] Track response:', ipCheckData);
        
        // Try multiple paths to get the email
        const email = ipCheckData.tracked?.customer_email || 
                      ipCheckData.profile?.customer_email ||
                      ipCheckData.profile?.email;
        
        if (ipCheckData.success && email) {
          console.log('[Bundle] IP/Fingerprint recognized! Customer:', email);
          
          // Step 2: Check if bundle offer available
          const bundleResponse = await fetch(
            `/api/intelligence/bundle?customer_email=${encodeURIComponent(email)}`
          );
          const bundleData = await bundleResponse.json();
          
          if (bundleData.success && bundleData.bundle) {
            console.log('[Bundle] Offer available! Showing popup...');
            setCustomerEmail(email);
            
            // Show popup after 5 seconds (give user time to browse)
            setTimeout(() => {
              setShowOffer(true);
            }, 5000);
          } else {
            console.log('[Bundle] No offer available for this customer');
          }
        } else {
          console.log('[Bundle] IP/Fingerprint not recognized or no customer email found');
        }
        
        setHasChecked(true);
      } catch (error) {
        console.error('[Bundle] Error checking for offer:', error);
        setHasChecked(true);
      }
    };

    // Check for logged-in user first
    if (user?.email) {
      console.log('[Bundle] User logged in, checking for offer...');
      setCustomerEmail(user.email);
      
      fetch(`/api/intelligence/bundle?customer_email=${encodeURIComponent(user.email)}`)
        .then(r => r.json())
        .then(data => {
          if (data.success && data.bundle) {
            setTimeout(() => setShowOffer(true), 5000);
          }
        });
      
      setHasChecked(true);
    } else {
      // Check by IP for anonymous users
      const timer = setTimeout(checkForBundleOffer, 2000);
      return () => clearTimeout(timer);
    }
  }, [isExcludedPage, hasChecked, user?.email]);

  // Reset when changing pages
  useEffect(() => {
    setHasChecked(false);
  }, [pathname]);

  if (isExcludedPage || !showOffer || !customerEmail) {
    return null;
  }

  return (
    <BundleOfferPopup
      customerEmail={customerEmail}
      onAccept={() => {
        console.log('✅ Bundle offer accepted by user');
        setShowOffer(false);
        // TODO: Add products to cart
      }}
      onReject={() => {
        console.log('❌ Bundle offer rejected by user');
        setShowOffer(false);
      }}
      onClose={() => {
        console.log('ℹ️ Bundle offer popup closed');
        setShowOffer(false);
      }}
    />
  );
}

