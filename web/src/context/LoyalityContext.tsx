"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useRef,
} from "react";

export interface LoyaltyCoupon {
  id: number;
  code: string;
  discount_amount: number;
  discount_type: string;
  usage_count: number;
  usage_limit: number;
  date_expires: string | null;
  date_created: string;
  redemption_date: string;
  description: string;
  is_used: boolean;
  is_expired: boolean;
  days_until_expiry: number | null;
}

type LoyalityContextType = {
  showRedemptionPopup: boolean;
  openRedemptionPopup: () => void;
  closeRedemptionPopup: () => void;
  toggleRedemptionPopup: (value?: boolean) => void;
  
  // 🌐 Global coupon cache (shared across all component instances)
  coupons: LoyaltyCoupon[];
  isLoadingCoupons: boolean;
  fetchCoupons: (email: string, forceRefresh?: boolean) => Promise<void>;
  clearCouponsCache: () => void;
};

const LoyalityContext = createContext<LoyalityContextType | null>(null);

export function LoyalityProvider({ children }: { children: ReactNode }) {
  const [showRedemptionPopup, setShowRedemptionPopup] = useState(false);
  
  // 🌐 Global coupon state (shared across all instances)
  // Initialize from sessionStorage to persist across renders
  const [coupons, setCoupons] = useState<LoyaltyCoupon[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('loyalty-coupons-cache');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  });
  const [isLoadingCoupons, setIsLoadingCoupons] = useState(false);
  const [couponsLastFetched, setCouponsLastFetched] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('loyalty-coupons-timestamp');
      return cached ? parseInt(cached, 10) : null;
    }
    return null;
  });
  const isFetchingRef = useRef(false);

  const openRedemptionPopup = useCallback(
    () => setShowRedemptionPopup(true),
    []
  );
  const closeRedemptionPopup = useCallback(
    () => setShowRedemptionPopup(false),
    []
  );
  const toggleRedemptionPopup = useCallback((value?: boolean) => {
    if (typeof value === "boolean") setShowRedemptionPopup(value);
    else setShowRedemptionPopup((v) => !v);
  }, []);

  // 🌐 Global fetchCoupons - shared across ALL component instances
  const fetchCoupons = useCallback(async (email: string, forceRefresh = false) => {
    if (!email) return;

    // 🔒 CRITICAL: Check ref FIRST to prevent race conditions across ALL instances
    if (isFetchingRef.current) {
      console.log("⚠️ [GLOBAL] Fetch already in progress, skipping duplicate request");
      return;
    }

    // Check cache - if data was fetched in this session, use cached data
    // Cache for entire checkout session (5 minutes) to avoid unnecessary API calls
    const CACHE_DURATION = 300000; // 5 minutes (was 30 seconds)
    if (!forceRefresh && couponsLastFetched && Date.now() - couponsLastFetched < CACHE_DURATION) {
      console.log("✅ [GLOBAL] Using cached coupons data (valid for 5 minutes)");
      return;
    }

    // 🔒 Set ref IMMEDIATELY before any async operations
    isFetchingRef.current = true;
    setIsLoadingCoupons(true);
    
    try {
      console.log(`🔄 [GLOBAL] Fetching coupons for ${email}`);
      const response = await fetch(
        `/api/loyalty/coupons?email=${encodeURIComponent(email)}`
      );
      const result = await response.json();

      if (result.success && result.coupons) {
        setCoupons(result.coupons);
        const timestamp = Date.now();
        setCouponsLastFetched(timestamp);
        
        // Persist to sessionStorage for cross-render persistence
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('loyalty-coupons-cache', JSON.stringify(result.coupons));
          sessionStorage.setItem('loyalty-coupons-timestamp', timestamp.toString());
        }
        
        console.log(`✅ [GLOBAL] Fetched ${result.coupons.length} coupons and cached in session`);
      }
    } catch (error) {
      console.error("[GLOBAL] Error fetching coupons:", error);
    } finally {
      // 🔒 Reset ref after request completes
      isFetchingRef.current = false;
      setIsLoadingCoupons(false);
    }
  }, [couponsLastFetched]);

  // Clear cache (useful after redemption)
  const clearCouponsCache = useCallback(() => {
    setCoupons([]);
    setCouponsLastFetched(null);
    isFetchingRef.current = false;
    
    // Clear sessionStorage cache as well
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('loyalty-coupons-cache');
      sessionStorage.removeItem('loyalty-coupons-timestamp');
    }
  }, []);

  return (
    <LoyalityContext.Provider
      value={{
        showRedemptionPopup,
        openRedemptionPopup,
        closeRedemptionPopup,
        toggleRedemptionPopup,
        coupons,
        isLoadingCoupons,
        fetchCoupons,
        clearCouponsCache,
      }}>
      {children}
    </LoyalityContext.Provider>
  );
}

export function useLoyality() {
  const ctx = useContext(LoyalityContext);
  if (!ctx) {
    console.warn("useLoyality called outside of LoyalityProvider, using defaults");
    // Return default values instead of throwing
    return {
      showRedemptionPopup: false,
      openRedemptionPopup: () => {},
      closeRedemptionPopup: () => {},
      toggleRedemptionPopup: () => {},
      coupons: [],
      isLoadingCoupons: false,
      fetchCoupons: async () => {},
      clearCouponsCache: () => {},
    };
  }
  return ctx;
}
