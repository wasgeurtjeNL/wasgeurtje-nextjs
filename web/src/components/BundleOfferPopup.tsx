"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { getStoredFingerprint } from '@/utils/fingerprint';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';

interface BundleProduct {
  product_id: number;
  name: string;
  slug: string;
  quantity: number;
  image?: string; // Product image URL
  unit_price?: number | string; // Optional unit price per item
}

interface BundleOffer {
  offer_id: number;
  bundle: BundleProduct[];
  pricing: {
    base_price: string;
    discount_amount: string;
    final_price: string;
  };
  bonus_points: number;
  target_quantity: number;
  message: string;
  customer?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  profile?: {
    total_orders?: number;
    days_since_last_order?: number;
    favorite_products?: Array<{product_id: number; name: string;}>;
  };
}

interface BundleOfferPopupProps {
  customerEmail: string;
  onAccept?: () => void;
  onReject?: () => void;
  onClose?: () => void;
}

// Hook to detect if sidecart/cart is open
const useCartOpen = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  useEffect(() => {
    const checkCart = () => {
      // Check if sidecart overlay exists
      const sidecartOverlay = document.querySelector('[data-sidecart-overlay]');
      setIsCartOpen(!!sidecartOverlay);
    };
    
    // Check initially and on DOM changes
    checkCart();
    const observer = new MutationObserver(checkCart);
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => observer.disconnect();
  }, []);
  
  return isCartOpen;
};

export default function BundleOfferPopup({ 
  customerEmail, 
  onAccept, 
  onReject,
  onClose 
}: BundleOfferPopupProps) {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const pathname = usePathname();
  const isCartOpen = useCartOpen();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false); // Widget state
  const [offer, setOffer] = useState<BundleOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(300); // 5 minutes
  const [viewerCount, setViewerCount] = useState(0); // Simulated social proof
  
  // Notify other components about bundle popup visibility
  useEffect(() => {
    const bundleStatus = {
      isVisible: isOpen,
      isMinimized: isMinimized
    };
    // Dispatch custom event for components to listen to
    window.dispatchEvent(new CustomEvent('bundlePopupStatusChanged', { 
      detail: bundleStatus 
    }));
    // Also store in sessionStorage as fallback
    sessionStorage.setItem('bundlePopupStatus', JSON.stringify(bundleStatus));
  }, [isOpen, isMinimized]);
  
  // Hide widget on checkout/cart pages or when sidecart is open
  const isExcludedPage = pathname?.startsWith('/checkout') || 
                         pathname?.startsWith('/payment') ||
                         pathname?.startsWith('/cart');
  const shouldHideWidget = isExcludedPage || isCartOpen;

  // Initialize from stored data on mount
  useEffect(() => {
    if (!customerEmail) return;

    // First, check if there's a stored offer (for page navigation persistence)
    try {
      const storedOffer = sessionStorage.getItem('wg-bundle-offer');
      if (storedOffer) {
        const { offer: savedOffer, countdown: savedCountdown, isMinimized: savedMinimized, expiresAt } = JSON.parse(storedOffer);
        
        // Check if offer hasn't expired
        if (expiresAt && Date.now() < expiresAt) {
          setOffer(savedOffer);
          setCountdown(savedCountdown);
          setIsMinimized(savedMinimized);
          setIsOpen(!savedMinimized); // Only open if not minimized
          setLoading(false);
          return; // Don't fetch new offer
        } else {
          // Expired, remove from storage
          sessionStorage.removeItem('wg-bundle-offer');
        }
      }
    } catch (err) {
      console.error('Error loading stored offer:', err);
    }

    // Fetch bundle offer if no valid stored offer
    const fetchOffer = async () => {
      try {
        // Get fingerprint for more accurate customer identification
        const fingerprint = await getStoredFingerprint();
        
        const response = await fetch(
          `/api/intelligence/bundle?customer_email=${encodeURIComponent(customerEmail)}&fingerprint=${encodeURIComponent(fingerprint)}`
        );
        const data = await response.json();

        if (data.success && data.bundle) {
          setOffer(data);
          setIsOpen(true);
          
          // Store offer for persistence across page navigation
          const offerData = {
            offer: data,
            countdown: 300, // 5 minutes
            isMinimized: false,
            expiresAt: Date.now() + (300 * 1000) // 5 minutes from now
          };
          sessionStorage.setItem('wg-bundle-offer', JSON.stringify(offerData));
          
          // ✅ Log "viewed" event when popup is shown
          // Using WordPress API endpoint (more reliable than Next.js endpoint during dev)
          fetch('https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              offer_id: data.offer_id,
              status: 'viewed',
              customer_email: customerEmail
            })
          }).catch(err => console.error('Error logging viewed event:', err));
        }
      } catch (error) {
        console.error('Error fetching bundle offer:', error);
      } finally {
        setLoading(false);
      }
    };

    // Delay showing popup by 2 seconds (only for new offers)
    const timer = setTimeout(fetchOffer, 2000);
    return () => clearTimeout(timer);
  }, [customerEmail]);

  // Countdown timer - runs when popup is open OR widget is minimized
  useEffect(() => {
    if ((!isOpen && !isMinimized) || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        const newCount = prev - 1;
        
        // Update stored countdown
        if (offer) {
          try {
            const storedOffer = sessionStorage.getItem('wg-bundle-offer');
            if (storedOffer) {
              const offerData = JSON.parse(storedOffer);
              offerData.countdown = newCount;
              sessionStorage.setItem('wg-bundle-offer', JSON.stringify(offerData));
            }
          } catch (err) {
            console.error('Error updating countdown in storage:', err);
          }
        }
        
        // Auto-close widget when timer expires
        if (newCount <= 0) {
          if (isMinimized) {
            setIsMinimized(false);
          }
          // Clear stored offer when expired
          sessionStorage.removeItem('wg-bundle-offer');
        }
        
        return newCount;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isMinimized, countdown, offer]);

  // Simulated viewer count for social proof (random between 8-24)
  useEffect(() => {
    if (isOpen) {
      const count = Math.floor(Math.random() * 17) + 8; // 8-24
      setViewerCount(count);
      
      // Randomly decrease count occasionally for realism
      const interval = setInterval(() => {
        setViewerCount(prev => Math.max(3, prev - Math.floor(Math.random() * 3)));
      }, 15000);
      
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Helper: parse price strings like "€14,95" or "14.95" into numbers
  const parsePriceToNumber = (price: any): number => {
    if (price == null) return 0;
    if (typeof price === 'number') return price;
    if (typeof price !== 'string') return 0;
    let str = price.trim();
    str = str.replace(/[^0-9,\.]/g, '');
    const commaCount = (str.match(/,/g) || []).length;
    const dotCount = (str.match(/\./g) || []).length;
    if (commaCount > 0 && dotCount === 0) {
      str = str.replace(',', '.');
    } else if (commaCount > 0 && dotCount > 0) {
      if (str.indexOf(',') > str.indexOf('.')) {
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
    }
    const n = parseFloat(str);
    return isNaN(n) ? 0 : n;
  };

  // Add all bundle products to the local cart
  const addBundleToCartLocal = () => {
    if (!offer) return;
    try {
      offer.bundle.forEach((product) => {
        const priceRaw = (product as any).unit_price ?? 0;
        const price = parsePriceToNumber(priceRaw);

        addToCart({
          id: String(product.product_id),
          title: product.name,
          price: isNaN(price) ? 0 : price,
          quantity: product.quantity,
          image: product.image || '/figma/product-flower-rain.png',
        });
      });
    } catch (cartErr) {
      console.error('Error adding bundle products to cart:', cartErr);
    }
  };

  const handleAccept = async () => {
    if (!offer) return;

    // Update offer status
    try {
      await fetch('https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_id: offer.offer_id,
          status: 'added_to_cart', // WordPress uses 'added_to_cart' instead of 'accepted'
          customer_email: customerEmail
        })
      });

      // Add products to cart here (you'll need to implement this)
      addBundleToCartLocal();
      // Persist bundle discount so checkout/cart can apply it
      try {
        const discountRaw = offer.pricing?.discount_amount ?? 0 as any;
        const discountAmount = parsePriceToNumber(discountRaw);
        const savingsPercentage = getSavingsPercentage();
        const couponCode = `popup${savingsPercentage}`; // e.g., popup10, popup11, popup12
        
        const payload = {
          offerId: offer.offer_id,
          code: couponCode,
          amount: discountAmount,
          percentage: savingsPercentage,
          createdAt: Date.now(),
          expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
        };
        localStorage.setItem('wg-bundle-discount', JSON.stringify(payload));
      } catch (persistErr) {
        console.error('Failed to persist bundle discount:', persistErr);
      }
      
      onAccept?.();
      setIsOpen(false);
      
      // Remove from storage when accepted
      sessionStorage.removeItem('wg-bundle-offer');
    } catch (error) {
      console.error('Error accepting offer:', error);
    }
  };

  const handleReject = async () => {
    if (!offer) return;

    try {
      await fetch('https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_id: offer.offer_id,
          status: 'rejected',
          customer_email: customerEmail
        })
      });

      onReject?.();
      // Minimize to widget instead of closing completely
      setIsOpen(false);
      setIsMinimized(true);
      
      // Update stored state to minimized
      try {
        const storedOffer = sessionStorage.getItem('wg-bundle-offer');
        if (storedOffer) {
          const offerData = JSON.parse(storedOffer);
          offerData.isMinimized = true;
          sessionStorage.setItem('wg-bundle-offer', JSON.stringify(offerData));
        }
      } catch (err) {
        console.error('Error updating minimized state:', err);
      }
    } catch (error) {
      console.error('Error rejecting offer:', error);
    }
  };

  const handleClose = () => {
    // Minimize to widget instead of closing completely
    setIsOpen(false);
    setIsMinimized(true);
    
    // Update stored state to minimized
    try {
      const storedOffer = sessionStorage.getItem('wg-bundle-offer');
      if (storedOffer) {
        const offerData = JSON.parse(storedOffer);
        offerData.isMinimized = true;
        sessionStorage.setItem('wg-bundle-offer', JSON.stringify(offerData));
      }
    } catch (err) {
      console.error('Error updating minimized state:', err);
    }
  };

  const handleReopenPopup = () => {
    setIsMinimized(false);
    setIsOpen(true);
    
    // Update stored state to opened
    try {
      const storedOffer = sessionStorage.getItem('wg-bundle-offer');
      if (storedOffer) {
        const offerData = JSON.parse(storedOffer);
        offerData.isMinimized = false;
        sessionStorage.setItem('wg-bundle-offer', JSON.stringify(offerData));
      }
    } catch (err) {
      console.error('Error updating reopened state:', err);
    }
  };

  const handleFinalClose = () => {
    // Completely close both popup and widget
    setIsOpen(false);
    setIsMinimized(false);
    onClose?.();
    
    // Remove from storage when completely closed
    sessionStorage.removeItem('wg-bundle-offer');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Personalized greeting - Priority: API data > Auth context > Fallback
  const getGreeting = () => {
    // 1. First try from bundle API (most accurate, includes guest checkouts)
    if (offer?.customer?.first_name) {
      return offer.customer.first_name;
    }
    
    // 2. Then try from auth context (if logged in)
    if (user?.firstName) {
      return user.firstName;
    }
    
    // 3. Friendly fallback
    return 'daar';
  };

  // Calculate savings percentage
  const getSavingsPercentage = () => {
    if (!offer) return 0;
    const basePrice = parseFloat(offer.pricing.base_price);
    const discount = parseFloat(offer.pricing.discount_amount);
    return Math.round((discount / basePrice) * 100);
  };

  // Personalized message based on profile - uses first name for connection
  const getPersonalizedMessage = () => {
    const name = getGreeting();
    const hasName = name !== 'daar';
    
    if (!offer?.profile) {
      return hasName 
        ? `${name}, deze deal is speciaal voor jou gemaakt!`
        : "Deze deal is speciaal voor jou gemaakt!";
    }
    
    const { total_orders, days_since_last_order } = offer.profile;
    
    if (total_orders && total_orders > 10) {
      return hasName
        ? `${name}, als één van onze meest gewaardeerde klanten, hebben we iets speciaals voor je! 💎`
        : "Als één van onze meest gewaardeerde klanten, hebben we iets speciaals voor je! 💎";
    } else if (days_since_last_order && days_since_last_order > 90) {
      return hasName
        ? `${name}, we hebben je gemist! Welkom terug met deze exclusieve aanbieding 🎉`
        : "We hebben je gemist! Welkom terug met deze exclusieve aanbieding 🎉";
    } else if (total_orders && total_orders > 5) {
      return hasName
        ? `${name}, omdat je zulke goede smaak hebt, hebben we deze deal speciaal samengesteld 😊`
        : "Omdat je zulke goede smaak hebt, hebben we deze deal speciaal samengesteld 😊";
    }
    
    return hasName
      ? `Gebaseerd op jouw favoriete producten, ${name}!`
      : "Gebaseerd op je favoriete producten, speciaal voor jou!";
  };

  if (loading || !offer) return null;

  // Show compact widget icon when minimized (hide on excluded pages/cart)
  if (isMinimized && countdown > 0 && !shouldHideWidget) {
    return (
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 animate-slide-in-left">
        {/* Compact Chat-Widget Style Icon */}
        <div className="relative group">
          {/* Close button (appears on hover) */}
          <button
            onClick={handleFinalClose}
            className="absolute -top-2 -left-2 w-6 h-6 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center hover:bg-red-600 z-10"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Main Widget Button */}
          <button
            onClick={handleReopenPopup}
            className="relative bg-gradient-to-br from-[#d7aa43] to-[#c29635] text-white rounded-l-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden"
            style={{ width: '80px', height: '80px' }}
          >
            {/* Animated pulse ring */}
            <div className="absolute inset-0 rounded-l-2xl animate-ping-slow opacity-20">
              <div className="absolute inset-0 bg-[#d7aa43] rounded-l-2xl"></div>
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center justify-center h-full px-2">
              {/* Icon */}
              <div className="mb-1">
                <svg className="w-6 h-6 animate-bounce-subtle" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                </svg>
              </div>
              
              {/* Timer - Prominent */}
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-0.5 mb-0.5">
                <div className="flex items-center gap-0.5">
                  <svg className="w-3 h-3 text-white animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <span className="text-white font-bold text-xs">
                    {formatTime(countdown)}
                  </span>
                </div>
              </div>

              {/* Discount badge */}
              <div className="text-[10px] font-bold text-white/90 leading-tight">
                -{getSavingsPercentage()}%
              </div>
            </div>

            {/* Shine effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000"></div>
          </button>

          {/* Notification dot (urgency indicator) */}
          <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white shadow-lg"></div>
        </div>
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Popup */}
      <div className="fixed top-[72px] sm:top-20 left-0 right-0 bottom-0 z-50 flex items-start justify-center p-3 sm:p-6 pointer-events-none">
        <div 
          className={`relative bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-full p-3 sm:p-6 pointer-events-auto animate-scale-in overflow-y-auto ${
            countdown <= 90 ? 'animate-urgent-pulse' : ''
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 transition-colors z-10 bg-white rounded-full p-0.5 sm:p-1"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header - Personalized */}
          <div className="text-center mb-2 sm:mb-4">
            <div className="inline-flex items-center justify-center w-9 h-9 sm:w-14 sm:h-14 bg-gradient-to-br from-[#d7aa43] to-[#c29635] rounded-full mb-1.5 sm:mb-3 shadow-lg">
              <span className="text-2xl sm:text-3xl">✨</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
              Hé {getGreeting()}! 👋
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2">
              {getPersonalizedMessage()}
            </p>
            {/* Social Proof */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-full">
              <div className="flex -space-x-1">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 border border-white"></div>
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 border border-white"></div>
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 border border-white"></div>
              </div>
              <span className="text-[10px] sm:text-xs text-green-800 font-medium">
                {viewerCount} anderen bekijken dit nu
              </span>
            </div>
          </div>

          {/* Urgency & Scarcity - Enhanced when < 90 seconds */}
          <div className={`bg-gradient-to-r from-red-50 to-orange-50 border-2 rounded-lg p-1.5 sm:p-2.5 mb-2.5 sm:mb-4 ${
            countdown <= 90 ? 'border-red-600 bg-red-100 animate-border-pulse' : 'border-red-300'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600 ${
                    countdown <= 90 ? 'animate-ping-fast' : 'animate-pulse'
                  }`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className={`text-[10px] sm:text-xs font-bold ${
                  countdown <= 90 ? 'text-red-700 animate-text-pulse' : 'text-red-900'
                }`}>
                  ⚡ Verloopt over {formatTime(countdown)}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs text-red-700 font-semibold px-2 py-0.5 bg-red-100 rounded-full">
                1x per klant
              </span>
            </div>
          </div>

          {/* Offer Details - Your Favorites */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-base sm:text-lg">🛍️</span>
              <h3 className="text-sm sm:text-base font-bold text-gray-900">
                Jouw persoonlijke bundel:
              </h3>
            </div>
            {offer.bundle.map((product, index) => (
              <div key={index} className="flex items-center justify-between mb-2 last:mb-0 bg-white rounded-lg p-2 sm:p-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  {/* Product Image */}
                  {product.image ? (
                    <div className="relative w-6 h-6 sm:w-7 sm:h-7 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        sizes="28px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  
                  {/* Quantity Badge */}
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-[#d7aa43] to-[#c29635] flex items-center justify-center flex-shrink-0">
                    <span className="text-xs sm:text-sm font-bold text-white">{product.quantity}x</span>
                  </div>
                  
                  {/* Product Name */}
                  <span className="text-xs sm:text-sm font-medium text-gray-900">
                    {product.name}
                  </span>
                </div>
                {index === 0 && (
                  <span className="text-[10px] bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                    ❤️ Favoriet
                  </span>
                )}
              </div>
            ))}

            {/* Pricing - Enhanced with Savings Badge */}
            <div className="border-t-2 border-dashed border-gray-300 pt-2.5 sm:pt-3 mt-2.5 sm:mt-3">
              {/* Savings Percentage Badge */}
              <div className="flex justify-center mb-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full shadow-lg">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                  </svg>
                  <span className="text-white text-sm sm:text-base font-bold">
                    Bespaar {getSavingsPercentage()}%!
                  </span>
                </div>
              </div>
              
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">Normale prijs</span>
                  <span className="text-gray-500 line-through">€{offer.pricing.base_price}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-green-600 font-bold">💰 Jouw exclusieve korting</span>
                  <span className="text-green-600 font-bold">-€{offer.pricing.discount_amount}</span>
                </div>
                <div className="flex justify-between items-center text-base sm:text-xl font-bold bg-gradient-to-r from-[#d7aa43]/10 to-[#c29635]/10 -mx-2 px-2 py-2 rounded-lg">
                  <span className="text-gray-900">Jouw VIP prijs</span>
                  <span className="text-[#d7aa43] text-xl sm:text-2xl">€{offer.pricing.final_price}</span>
                </div>
              </div>
            </div>

            {/* Loyalty Bonus - Enhanced */}
            {offer.bonus_points > 0 && (
              <div className="relative bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-[#d7aa43] rounded-lg p-2.5 sm:p-3 mt-2.5 sm:mt-3 overflow-hidden">
                {/* Sparkle effect */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#d7aa43]/20 to-transparent rounded-full blur-2xl"></div>
                <div className="relative flex items-center justify-center gap-2">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#d7aa43] animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-[#d7aa43] -ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-gray-900">
                    🎁 BONUS: +{offer.bonus_points} loyaliteitspunten!
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-center text-gray-600 mt-1">
                  Alleen voor deze aanbieding
                </p>
              </div>
            )}
          </div>

          {/* Emotional Trigger Message */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-blue-900 mb-1">
                  💡 Waarom deze aanbieding perfect voor jou is:
                </p>
                <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
                  {offer.message}
                </p>
              </div>
            </div>
          </div>

          {/* Actions - Enhanced with psychology */}
          <div className="space-y-2.5 sm:space-y-3">
            {/* Primary CTA - Loss Aversion with personalization */}
            <button
              onClick={handleAccept}
              className="relative w-full group overflow-hidden px-4 py-3 sm:py-3.5 bg-gradient-to-r from-[#d7aa43] to-[#c29635] text-white rounded-xl text-sm sm:text-base font-bold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-95"
            >
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000"></div>
              <span className="relative flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {getGreeting()}, claim jouw {getSavingsPercentage()}% korting! 🎉
              </span>
            </button>
            
            {/* Secondary option - Subtle */}
            <button
              onClick={handleReject}
              className="w-full px-3 py-2 text-xs sm:text-sm text-gray-500 hover:text-gray-700 transition-colors underline"
            >
              Nee, ik betaal liever de volledige prijs
            </button>
          </div>

          {/* Trust indicators - Enhanced */}
          <div className="border-t border-gray-200 pt-3 mt-4">
            <div className="flex items-center justify-center gap-4 sm:gap-6 text-[10px] sm:text-xs">
              <div className="flex items-center gap-1 text-green-700">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">SSL Beveiligd</span>
              </div>
              <div className="flex items-center gap-1 text-blue-700">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                </svg>
                <span className="font-medium">Gratis verzending</span>
              </div>
              <div className="flex items-center gap-1 text-purple-700">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="font-medium">4.8★ (1400+)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scale-in {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
        @keyframes slide-in-left {
          from {
            transform: translateX(100%) translateY(-50%);
            opacity: 0;
          }
          to {
            transform: translateX(0) translateY(-50%);
            opacity: 1;
          }
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.5s ease-out;
        }
        @keyframes ping-slow {
          0%, 100% {
            transform: scale(1);
            opacity: 0.2;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.4;
          }
        }
        .animate-ping-slow {
          animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes bounce-subtle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
        @keyframes urgent-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 20px 8px rgba(220, 38, 38, 0.4);
            transform: scale(1.01);
          }
        }
        .animate-urgent-pulse {
          animation: urgent-pulse 1s ease-in-out infinite;
        }
        @keyframes border-pulse {
          0%, 100% {
            border-color: rgb(220, 38, 38);
          }
          50% {
            border-color: rgb(239, 68, 68);
          }
        }
        .animate-border-pulse {
          animation: border-pulse 0.8s ease-in-out infinite;
        }
        @keyframes ping-fast {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.3);
            opacity: 0.5;
          }
        }
        .animate-ping-fast {
          animation: ping-fast 0.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes text-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
        .animate-text-pulse {
          animation: text-pulse 0.8s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
