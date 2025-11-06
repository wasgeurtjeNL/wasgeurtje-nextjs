"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useCart } from "./CartContext";

interface LoyaltyCoupon {
  code: string;
  amount: number;
  type: "fixed" | "percentage";
}

interface RemovedLoyaltyCoupon extends LoyaltyCoupon {
  removedAt: number;
}

interface LoyaltyCouponValidationContextType {
  // State - ALLEEN voor loyaliteitscoupons
  activeLoyaltyCoupons: LoyaltyCoupon[];
  temporarilyRemovedLoyaltyCoupons: RemovedLoyaltyCoupon[];
  loyaltyValidationMessage: string | null;
  
  // Actions - ALLEEN voor loyaliteitscoupons
  addLoyaltyCoupon: (coupon: LoyaltyCoupon) => boolean;
  removeLoyaltyCoupon: (code: string) => void;
  isLoyaltyCoupon: (code: string) => boolean;
  getLoyaltyDiscountTotal: () => number;
  clearLoyaltyValidationMessage: () => void;
  getMaxAllowedLoyaltyCoupons: () => number;
  getProductCount: () => number;
}

const LoyaltyCouponValidationContext = createContext<LoyaltyCouponValidationContextType | null>(null);

export function LoyaltyCouponValidationProvider({ children }: { children: ReactNode }) {
  const { items } = useCart();
  const [activeLoyaltyCoupons, setActiveLoyaltyCoupons] = useState<LoyaltyCoupon[]>([]);
  const [temporarilyRemovedLoyaltyCoupons, setTemporarilyRemovedLoyaltyCoupons] = useState<RemovedLoyaltyCoupon[]>([]);
  const [loyaltyValidationMessage, setLoyaltyValidationMessage] = useState<string | null>(null);

  // Herken loyaliteitscoupons
  const isLoyaltyCoupon = useCallback((code: string) => {
    return code.startsWith('LOYALTY-') || 
           code.toLowerCase().includes('loyalty') || 
           code.toLowerCase().includes('points');
  }, []);

  // Bereken aantal producten (exclusief dopjes)
  const getProductCount = useCallback(() => {
    return items
      .filter(item => !item.isHiddenProduct)
      .reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  // Bereken maximum toegestane LOYALITEITS-coupons
  const getMaxAllowedLoyaltyCoupons = useCallback(() => {
    const productCount = getProductCount();
    return Math.floor(productCount / 2);
  }, [getProductCount]);

  // Valideer ALLEEN loyaliteitscoupons - IMPROVED MESSAGES
  const validateLoyaltyCoupons = useCallback(() => {
    const productCount = getProductCount();
    const maxAllowed = getMaxAllowedLoyaltyCoupons();
    const currentLoyaltyCount = activeLoyaltyCoupons.length;

    if (productCount < 2 && currentLoyaltyCount > 0) {
      return {
        valid: false,
        message: `Je hebt ${productCount} product${productCount !== 1 ? 'en' : ''}, maar loyaliteitskortingen zijn pas geldig vanaf 2 producten. Voeg nog ${2 - productCount} product${2 - productCount !== 1 ? 'en' : ''} toe om je loyaliteitspunten te kunnen gebruiken! 🛒`
      };
    }

    if (currentLoyaltyCount > maxAllowed) {
      const excess = currentLoyaltyCount - maxAllowed;
      return {
        valid: false,
        message: `Je hebt ${currentLoyaltyCount} loyaliteitskortingen toegepast, maar met ${productCount} producten kun je maximaal ${maxAllowed} korting${maxAllowed !== 1 ? 'en' : ''} gebruiken. ${excess} korting${excess !== 1 ? 'en zijn' : ' is'} tijdelijk verwijderd.`
      };
    }

    return { valid: true };
  }, [getProductCount, getMaxAllowedLoyaltyCoupons, activeLoyaltyCoupons]);

  // Herstel loyaliteitscoupons
  const restoreLoyaltyCouponsIfPossible = useCallback(() => {
    if (temporarilyRemovedLoyaltyCoupons.length === 0) return;
    
    const maxAllowed = getMaxAllowedLoyaltyCoupons();
    const currentCount = activeLoyaltyCoupons.length;
    const canRestore = Math.min(
      maxAllowed - currentCount,
      temporarilyRemovedLoyaltyCoupons.length
    );
    
    if (canRestore > 0) {
      const sortedRemoved = [...temporarilyRemovedLoyaltyCoupons].sort((a, b) => a.removedAt - b.removedAt);
      const toRestore = sortedRemoved.slice(0, canRestore);
      const remaining = sortedRemoved.slice(canRestore);
      
      setActiveLoyaltyCoupons(prev => [...prev, ...toRestore.map(({code, amount, type}) => ({code, amount, type}))]);
      setTemporarilyRemovedLoyaltyCoupons(remaining);
      
      if (remaining.length === 0) {
        setLoyaltyValidationMessage(`✅ Super! Je ${toRestore.length > 1 ? `${toRestore.length} loyaliteitskortingen zijn` : 'loyaliteitskorting is'} opnieuw toegepast. Je bespaart nu €${toRestore.reduce((sum, c) => sum + c.amount, 0).toFixed(2)}! 🎉`);
        setTimeout(() => setLoyaltyValidationMessage(null), 6000);
      }
    }
  }, [temporarilyRemovedLoyaltyCoupons, activeLoyaltyCoupons, getMaxAllowedLoyaltyCoupons]);

  // Auto-validatie bij cart wijzigingen - ALLEEN voor loyaliteitscoupons
  useEffect(() => {
    if (activeLoyaltyCoupons.length === 0) return; // Skip als geen loyalty coupons

    const validation = validateLoyaltyCoupons();
    const productCount = getProductCount();
    const maxAllowed = getMaxAllowedLoyaltyCoupons();
    
    if (!validation.valid) {
      if (productCount < 2) {
        // Verwijder alle loyaliteitscoupons (maar laat reguliere kortingscodes intact)
        const removed = activeLoyaltyCoupons.map(coupon => ({
          ...coupon,
          removedAt: Date.now()
        }));
        setTemporarilyRemovedLoyaltyCoupons(prev => [...prev, ...removed]);
        setActiveLoyaltyCoupons([]);
        setLoyaltyValidationMessage(validation.message!);
      } else if (activeLoyaltyCoupons.length > maxAllowed) {
        // Verwijder overtollige loyaliteitscoupons
        const toKeep = activeLoyaltyCoupons.slice(0, maxAllowed);
        const toRemove = activeLoyaltyCoupons.slice(maxAllowed).map(coupon => ({
          ...coupon,
          removedAt: Date.now()
        }));
        
        setActiveLoyaltyCoupons(toKeep);
        setTemporarilyRemovedLoyaltyCoupons(prev => [...prev, ...toRemove]);
        
        const productsNeeded = (toRemove.length * 2);
        setLoyaltyValidationMessage(
          `${validation.message} 💡 Tip: Voeg nog ${productsNeeded} product${productsNeeded > 1 ? 'en' : ''} toe om ${toRemove.length > 1 ? 'deze kortingen' : 'deze korting'} weer te activeren!`
        );
      }
    } else {
      // Probeer loyaliteitscoupons te herstellen
      restoreLoyaltyCouponsIfPossible();
    }
  }, [items, activeLoyaltyCoupons.length, validateLoyaltyCoupons, restoreLoyaltyCouponsIfPossible]);

  // Voeg loyaliteitscoupon toe
  const addLoyaltyCoupon = useCallback((coupon: LoyaltyCoupon) => {
    // Check if it's actually a loyalty coupon
    if (!isLoyaltyCoupon(coupon.code)) {
      console.warn('Trying to add non-loyalty coupon to loyalty system:', coupon.code);
      return false;
    }

    const maxAllowed = getMaxAllowedLoyaltyCoupons();
    if (activeLoyaltyCoupons.length >= maxAllowed) {
      const productsNeeded = 2;
      setLoyaltyValidationMessage(
        `💡 Voeg nog ${productsNeeded} product${productsNeeded > 1 ? 'en' : ''} toe om uw volgende loyaliteitspunt te gebruiken.`
      );
      return false;
    }
    
    if (activeLoyaltyCoupons.some(c => c.code === coupon.code)) {
      setLoyaltyValidationMessage("Deze loyaliteitskorting is al toegepast! Je kunt elke code maar één keer gebruiken.");
      return false;
    }
    
    setActiveLoyaltyCoupons(prev => [...prev, coupon]);
    setLoyaltyValidationMessage(null);
    return true;
  }, [activeLoyaltyCoupons, isLoyaltyCoupon, getMaxAllowedLoyaltyCoupons]);

  // Bereken totale loyaliteitskorting
  const getLoyaltyDiscountTotal = useCallback(() => {
    return activeLoyaltyCoupons.reduce((total, coupon) => {
      if (coupon.type === "percentage") {
        // Voor percentage kortingen zouden we het subtotaal nodig hebben
        // Voor nu gaan we ervan uit dat loyalty coupons altijd fixed amounts zijn
        console.warn('Percentage loyalty coupons not fully supported yet');
        return total;
      }
      return total + coupon.amount;
    }, 0);
  }, [activeLoyaltyCoupons]);

  const removeLoyaltyCoupon = useCallback((code: string) => {
    setActiveLoyaltyCoupons(prev => prev.filter(c => c.code !== code));
    setTemporarilyRemovedLoyaltyCoupons(prev => prev.filter(c => c.code !== code));
  }, []);

  const clearLoyaltyValidationMessage = useCallback(() => {
    setLoyaltyValidationMessage(null);
  }, []);

  return (
    <LoyaltyCouponValidationContext.Provider value={{
      activeLoyaltyCoupons,
      temporarilyRemovedLoyaltyCoupons,
      loyaltyValidationMessage,
      addLoyaltyCoupon,
      removeLoyaltyCoupon,
      isLoyaltyCoupon,
      getLoyaltyDiscountTotal,
      clearLoyaltyValidationMessage,
      getMaxAllowedLoyaltyCoupons,
      getProductCount
    }}>
      {children}
    </LoyaltyCouponValidationContext.Provider>
  );
}

export function useLoyaltyCouponValidation() {
  const context = useContext(LoyaltyCouponValidationContext);
  if (!context) {
    throw new Error('useLoyaltyCouponValidation must be used within LoyaltyCouponValidationProvider');
  }
  return context;
}
