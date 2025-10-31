"use client";

import { Fragment, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { getSmartProductSuggestion, extractPurchasedProductIds } from '@/utils/product-suggestions';
import { getTimeBasedGreeting, getContextualMessage } from '@/utils/greeting';

// Helper function to get proper image path with product ID override support
const getProductImageSrc = (imagePath: string | undefined, productId?: string): string => {
  // Image overrides for known products (same as upsell products)
  const imageOverrides: Record<string, string> = {
    "335060": "https://wasgeurtje.nl/wp-content/uploads/2025/04/wasstrips.jpg.webp", // Wasstrips
    "334999": "https://wasgeurtje.nl/wp-content/uploads/2023/11/wasparfum-proefpakket-e1705177381815.jpg", // Nieuwe geurcollectie proefpakket
    "335706": "https://wasgeurtje.nl/wp-content/uploads/2025/04/ChatGPT-Image-18-apr-2025-16_48_05.webp", // Combideal
    "267628": "https://wasgeurtje.nl/wp-content/uploads/2023/11/nieuwe-geurcollectie-proefpakket-5.jpg", // Tweede proefpakket
    // Individual Wasparfum products
    "1410": "https://wasgeurtje.nl/wp-content/uploads/2023/10/blossom-drip-wasparfum.png", // Blossom Drip
    "1411": "https://wasgeurtje.nl/wp-content/uploads/2023/10/cotton-love-wasparfum.png", // Cotton Love
    "1412": "https://wasgeurtje.nl/wp-content/uploads/2023/10/flower-rain-wasparfum.png", // Flower Rain
    "1413": "https://wasgeurtje.nl/wp-content/uploads/2023/10/linen-breeze-wasparfum.png", // Linen Breeze
    "1414": "https://wasgeurtje.nl/wp-content/uploads/2023/10/luxe-aroma-wasparfum.png", // Luxe Aroma
  };

  // Use override if product ID is provided and has an override
  if (productId && imageOverrides[productId]) {
    return imageOverrides[productId];
  }

  if (!imagePath) return "/figma/product-flower-rain.png";

  // If it's already a full URL from WooCommerce/WordPress, use it directly
  if (imagePath.startsWith("http")) {
    return imagePath;
  }

  // If it's a local path starting with /figma/, use it directly
  if (imagePath.startsWith("/figma/")) {
    return imagePath;
  }

  // For other paths, assume it's from the backend and should be used as-is
  // This matches the approach in product-helpers.ts and woocommerce.ts
  return imagePath;
};

export default function CartSidebar() {
  const {
    items,
    isOpen,
    closeCart,
    removeFromCart,
    updateQuantity,
    subtotal,
    remainingForFreeShipping,
    hasReachedFreeShipping,
    shippingThreshold,
    cartCount,
    addToCart,
  } = useCart();
  const { user, isLoggedIn, orders } = useAuth();

  const [isClosing, setIsClosing] = useState(false);
  const greeting = getTimeBasedGreeting({ includeEmoji: true, short: true });
  const contextMessage = getContextualMessage();
  const [promoCode, setPromoCode] = useState("");
  const [isPromoApplied, setIsPromoApplied] = useState(false);
  const [showAlternateMessage, setShowAlternateMessage] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [upsellProducts, setUpsellProducts] = useState<
    Array<{
      id: string;
      title: string;
      price: number;
      originalPrice?: number;
      image: string;
      badge?: string;
    }>
  >([]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [animatedItems, setAnimatedItems] = useState<Set<string>>(new Set());
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);

  // Leuke marketing boodschappen over wasstrips
  const alternateMessages = [
    { 
      emoji: "🌱", 
      text: "Wist je dat onze wasstrips goed zijn voor het milieu én goedkoper dan traditioneel wasmiddel?", 
      promoteWasstrips: true,
      confirmText: "Super! Je doet mee aan onze groene revolutie! 🌍"
    },
    { 
      emoji: "💚", 
      text: "Wasstrips: 60% minder verpakking, 100% schone was!", 
      promoteWasstrips: true,
      confirmText: "Yes! Je hebt wasstrips al toegevoegd. Top keuze! ✨"
    },
    { 
      emoji: "✨", 
      text: "Psst... Wasstrips nemen geen ruimte in en zijn supervlekeffectief!", 
      promoteWasstrips: true,
      confirmText: "Perfect! Je gaat het verschil zelf ervaren! 💪"
    },
    { 
      emoji: "🌍", 
      text: "Elke wasstrip bespaart 25ml plastic. Klein gebaar, groot verschil!", 
      promoteWasstrips: true,
      confirmText: "Geweldig! Jij maakt het verschil voor het milieu! 🌿"
    },
    { 
      emoji: "💰", 
      text: "Wasstrips = €0,25 per wasbeurt. Bespaar tot €50 per jaar!", 
      promoteWasstrips: true,
      confirmText: "Slimme keuze! Je gaat geld én het milieu besparen! 🎉"
    },
  ];

  // Check of wasstrips al in cart zit (product ID: 335060)
  const wasstripsInCart = items.some(item => item.id === "335060");

  // Handle closing animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      closeCart();
      setIsClosing(false);
    }, 300);
  };

  // Voeg wasstrips toe aan cart
  const handleAddWasstrips = async () => {
    try {
      // Fetch wasstrips product data
      const res = await fetch('/api/woocommerce/products?ids=335060');
      if (!res.ok) return;
      
      const products = await res.json();
      const wasstrips = Array.isArray(products) ? products[0] : null;
      
      // Only add to cart if product is in stock
      if (wasstrips && wasstrips.stock_status !== 'outofstock') {
        addToCart({
          id: "335060",
          title: wasstrips.name || "Wasstrips",
          price: parseFloat(wasstrips.price || wasstrips.regular_price || 0),
          image: wasstrips.images?.[0]?.src || "https://wasgeurtje.nl/wp-content/uploads/2025/04/wasstrips.jpg.webp",
          originalPrice: wasstrips.sale_price ? parseFloat(wasstrips.regular_price || 0) : undefined,
        });
      }
    } catch (error) {
      console.error('Error adding wasstrips:', error);
    }
  };

  // Wissel tussen begroeting en marketing boodschappen (alleen voor ingelogde gebruikers)
  useEffect(() => {
    if (!isLoggedIn || !user) return;

    const interval = setInterval(() => {
      setShowAlternateMessage((prev) => !prev);
      if (!showAlternateMessage) {
        // Kies een random boodschap
        setMessageIndex(Math.floor(Math.random() * alternateMessages.length));
      }
    }, 5000); // Wissel elke 5 seconden

    return () => clearInterval(interval);
  }, [isLoggedIn, user, showAlternateMessage, alternateMessages.length]);

  // Item animation when adding to cart
  useEffect(() => {
    if (items.length > 0) {
      const latestItem = items[items.length - 1];
      const itemKey = `${latestItem.id}-${latestItem.variant}`;
      setAnimatedItems((prev) => new Set(prev).add(itemKey));
      setTimeout(() => {
        setAnimatedItems((prev) => {
          const newSet = new Set(prev);
          newSet.delete(itemKey);
          return newSet;
        });
      }, 600);
    }
  }, [items.length]);

  // Alleen voorkom scrollen op mobiel, sta toe op desktop
  useEffect(() => {
    const handleScroll = () => {
      // Voorkom dat de pagina naar boven springt door evt.preventDefault()
      // niet te gebruiken op scroll events
    };

    if (isOpen) {
      // In plaats van overflow: hidden gebruiken we een class op de body
      // om beter te controleren hoe de pagina zich gedraagt
      document.body.classList.add("cart-sidebar-open");

      // Voor mobiel kunnen we overflow: hidden toevoegen
      if (window.innerWidth < 768) {
        document.body.style.overflow = "hidden";
      }

      // Voeg scroll handler toe om verspringen te voorkomen
      window.addEventListener("scroll", handleScroll, { passive: true });
    } else {
      document.body.classList.remove("cart-sidebar-open");
      document.body.style.overflow = "";
      window.removeEventListener("scroll", handleScroll);
    }

    return () => {
      document.body.classList.remove("cart-sidebar-open");
      document.body.style.overflow = "";
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isOpen]);

  // Dynamic upsells based on login state and past orders
  useEffect(() => {
    const computeAndFetchUpsells = async () => {
      try {
        // Stop showing upsells if free shipping is reached
        if (subtotal >= 40) {
          setUpsellProducts([]);
          return;
        }

        // Get purchased product IDs
        let purchasedProductIds: string[] = [];
        if (isLoggedIn && orders) {
          purchasedProductIds = extractPurchasedProductIds(orders);
          console.log("🛒 Cart: User has purchased:", purchasedProductIds);
        }
        
        // Count how many suggested products are already in cart
        const suggestedProductsInCart = ["334999", "267628", "335060"].filter(
          id => items.some(item => item.id === id)
        ).length;
        
        // Use central suggestion logic
        const suggestion = getSmartProductSuggestion(
          purchasedProductIds,
          items,
          subtotal,
          suggestedProductsInCart > 0
        );
        
        if (!suggestion) {
          setUpsellProducts([]);
          return;
        }

        // Fetch the suggested product
        const res = await fetch(
          `/api/woocommerce/products?ids=${suggestion.productId}`
        );
        if (!res.ok) {
          setUpsellProducts([]);
          return;
        }
        const products = await res.json();
        
        // Filter out products that are out of stock
        const inStockProducts = (Array.isArray(products) ? products : []).filter(
          (p: any) => p.stock_status !== 'outofstock'
        );
        
        const mapped = inStockProducts.map(
          (p: any) => {
            const mappedId = String(p.id);
            const apiImage = p.images?.[0]?.src || "https://wasgeurtje.nl/wp-content/uploads/2023/10/wasparfum-default.png";

            return {
              id: mappedId,
              title: p.name || p.title || "Product",
              price: parseFloat(p.price || p.regular_price || 0),
              originalPrice: p.sale_price
                ? parseFloat(p.regular_price || 0)
                : undefined,
              image: getProductImageSrc(apiImage, mappedId),
              badge: p.featured ? "Aanbevolen" : undefined,
            };
          }
        );
        // Limit to max 2 upsell products to keep sidebar clean
        setUpsellProducts(mapped.slice(0, 2));
      } catch {
        setUpsellProducts([]);
      }
    };

    computeAndFetchUpsells();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, subtotal, JSON.stringify(items), JSON.stringify(orders)]);

  if (!isOpen && !isClosing) return null;

  // Calculate shipping progress percentage
  const shippingProgress = Math.min((subtotal / shippingThreshold) * 100, 100);

  return (
    <>
      {/* Overlay with blur effect */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-all duration-300 z-[999] ${
          isOpen && !isClosing ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Sidebar - positioned on right side */}
      <div
        className={`fixed top-0 right-0 h-full w-full md:w-[520px] lg:w-[580px] bg-white/95 backdrop-blur-md shadow-2xl z-[1000] transition-all duration-300 cart-sidebar ${
          isOpen && !isClosing ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col bg-gradient-to-br from-white via-white to-[#FFF9F0]">
          {/* Header - Met wisselende boodschappen en voldoende ruimte */}
          <div className="relative px-4 py-3 bg-gradient-to-r from-[#d7aa43] via-[#e8b960] to-[#c29635] shadow-lg border-b-2 border-[#f5d68a]/30">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative flex items-start justify-between gap-2">
              <div className="flex flex-col min-w-0 flex-1">
                {isLoggedIn && user ? (
                  <>
                    <div className="relative min-h-[3.5rem]">
                      {/* Begroeting */}
                      <div 
                        className={`absolute inset-0 transition-all duration-500 ${
                          showAlternateMessage 
                            ? 'opacity-0 translate-y-[-10px] pointer-events-none' 
                            : 'opacity-100 translate-y-0'
                        }`}
                      >
                        <h2 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                          <span>{greeting} {user.firstName || user.displayName}!</span>
                          <span className="inline-flex items-center justify-center bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                            {cartCount}
                          </span>
                        </h2>
                        {user.loyalty && user.loyalty.points > 0 && (
                          <p className="text-xs text-white/90 mt-1">
                            {user.loyalty.points} punten ✨
                          </p>
                        )}
                      </div>
                      
                      {/* Marketing boodschap - Multi-line met optionele CTA */}
                      <div 
                        className={`absolute inset-0 transition-all duration-500 ${
                          showAlternateMessage 
                            ? 'opacity-100 translate-y-0' 
                            : 'opacity-0 translate-y-[10px] pointer-events-none'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-lg flex-shrink-0 mt-0.5">{alternateMessages[messageIndex].emoji}</span>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-white leading-relaxed mb-1.5">
                              {alternateMessages[messageIndex].text}
                            </p>
                            
                            {/* Wasstrips promotie logica */}
                            {alternateMessages[messageIndex].promoteWasstrips && (
                              <>
                                {/* Toon CTA knop als wasstrips nog NIET in cart */}
                                {!wasstripsInCart && (
                                  <button
                                    onClick={handleAddWasstrips}
                                    className="group inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold text-white border border-white/30 hover:border-white/50 transition-all duration-300 hover:scale-105 shadow-sm"
                                  >
                                    <svg 
                                      className="w-3 h-3 group-hover:rotate-90 transition-transform duration-300" 
                                      fill="none" 
                                      stroke="currentColor" 
                                      viewBox="0 0 24 24"
                                    >
                                      <path 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                        strokeWidth={2.5} 
                                        d="M12 4v16m8-8H4" 
                                      />
                                    </svg>
                                    <span>Probeer wasstrips</span>
                                  </button>
                                )}
                                
                                {/* Toon bevestigende tekst als wasstrips WEL in cart */}
                                {wasstripsInCart && alternateMessages[messageIndex].confirmText && (
                                  <div className="inline-flex items-center gap-1.5 bg-green-500/20 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold text-white border border-green-400/30 shadow-sm animate-in fade-in duration-300">
                                    <svg 
                                      className="w-3 h-3" 
                                      fill="none" 
                                      stroke="currentColor" 
                                      viewBox="0 0 24 24"
                                    >
                                      <path 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                        strokeWidth={2.5} 
                                        d="M5 13l4 4L19 7" 
                                      />
                                    </svg>
                                    <span>{alternateMessages[messageIndex].confirmText}</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Winkelwagen</span>
                    <span className="inline-flex items-center justify-center bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2 py-0.5 rounded-full">
                      {cartCount}
                    </span>
                  </h2>
                )}
              </div>
              <button
                onClick={handleClose}
                className="group p-2 hover:bg-white/10 rounded-lg transition-all duration-200 text-white backdrop-blur-sm flex-shrink-0"
              >
                <svg
                  className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            <div className="px-3 py-2">
              {/* Free Shipping Bar - Compact */}
              <div className="mb-2 p-1 bg-gradient-to-b from-white to-[#FFF9F0] rounded-lg border border-gray-100">
                {hasReachedFreeShipping ? (
                  <div className="text-center animate-in slide-in-from-top duration-500">
                    <div className="flex items-center justify-center text-green-600">
                      <svg
                        className="w-3.5 h-3.5 mr-1.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="font-bold text-sm">
                        Gratis verzending!
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs mb-1 font-medium text-[#814E1E]">
                      Nog{" "}
                      <span className="font-bold">
                        €{remainingForFreeShipping.toFixed(2)}
                      </span>{" "}
                      voor <span className="font-bold">gratis verzending!</span>
                    </p>
                    <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                      <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#FCCE4E] via-[#FFD700] to-[#D6AD61] transition-all duration-700 ease-out rounded-full"
                        style={{
                          width: `${shippingProgress}%`,
                          boxShadow: "0 1px 4px rgba(252, 206, 78, 0.4)",
                        }}
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-sm border border-[#D6AD61] flex items-center justify-center">
                          <div className="w-0.5 h-0.5 bg-[#D6AD61] rounded-full animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {items.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-[#d7aa43]/10 blur-3xl"></div>
                    <svg
                      className="relative w-20 h-20 mx-auto text-gray-300 mb-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500 mb-2 text-lg font-medium">
                    {isLoggedIn && user ? (
                      <>Je winkelwagen is nog leeg, {user.firstName || user.displayName}</>
                    ) : (
                      "Je winkelwagen is leeg"
                    )}
                  </p>
                  <p className="text-gray-400 mb-8 text-sm">
                    {isLoggedIn && user ? (
                      contextMessage
                    ) : (
                      "Tijd om wat lekkers uit te kiezen!"
                    )}
                  </p>
                  <button
                    onClick={handleClose}
                    className="w-full bg-gradient-to-br from-[#d7aa43] via-[#e8b960] to-[#c29635] text-white px-8 py-4 rounded-xl font-bold text-base tracking-wide hover:shadow-2xl hover:shadow-[#d7aa43]/50 hover:scale-[1.02] hover:from-[#e8b960] hover:via-[#d7aa43] hover:to-[#b88a2e] transition-all duration-500 shadow-xl shadow-[#d7aa43]/30 uppercase border-2 border-[#f5d68a]/20 hover:border-[#f5d68a]/40"
                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                  >
                    Verder winkelen
                  </button>
                </div>
              ) : (
                <>
                  {/* Cart Items */}
                  <div className="space-y-1.">
                    {items.map((item) => {
                      // Create a unique key that includes a variant or a fallback to ensure uniqueness
                      const itemKey = `${item.id}-${
                        item.variant ||
                        Math.random().toString(36).substring(2, 9)
                      }`;
                      const isAnimated = animatedItems.has(itemKey);
                      const isHovered = hoveredItem === itemKey;

                      return (
                        <div
                          key={itemKey}
                          className={`relative flex gap-2.5 p-2.5 bg-white rounded-lg shadow-sm border border-gray-100 transition-all duration-300 ${
                            isAnimated
                              ? "animate-in slide-in-from-right duration-500"
                              : ""
                          } ${isHovered ? "shadow-lg scale-[1.01]" : ""}`}
                          onMouseEnter={() => setHoveredItem(itemKey)}
                          onMouseLeave={() => setHoveredItem(null)}
                        >
                          <div className="relative w-14 h-14 bg-gradient-to-br from-[#F8F6F0] to-[#FFF9F0] rounded-lg overflow-hidden shadow-sm">
                            <Image
                              src={getProductImageSrc(item.image, item.id)}
                              alt={item.title || 'Product afbeelding'}
                              fill
                              className="object-contain p-1 hover:scale-105 transition-transform duration-300"
                              unoptimized={item.image?.startsWith("http")}
                            />
                          </div>
                          <div className="flex-1">
                            {/* Desktop version - no line break */}
                            <h3 
                              className="hidden md:block font-semibold text-[#814E1E] mb-0.5 text-sm leading-tight"
                              dangerouslySetInnerHTML={{ __html: item.title || 'Product' }}
                            />
                            {/* Mobile version - with line break for Combideal */}
                            <h3 
                              className="md:hidden font-semibold text-[#814E1E] mb-0.5 text-sm leading-tight"
                              dangerouslySetInnerHTML={{ 
                                __html: (item.title || 'Product').includes('Wasgeurtje Combideal') 
                                  ? (item.title || 'Product').replace('Wasgeurtje Combideal – ', 'Wasgeurtje Combideal –<br>') 
                                  : (item.title || 'Product')
                              }}
                            />
                            {item.variant && (
                              <p className="text-xs text-gray-600 mb-1.5 flex items-center gap-1">
                                <span className="w-1 h-1 bg-[#d7aa43] rounded-full"></span>
                                {item.variant}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-md overflow-hidden shadow-sm">
                                <button
                                  onClick={() =>
                                    updateQuantity(
                                      item.id,
                                      item.variant,
                                      Math.max(0, item.quantity - 1)
                                    )
                                  }
                                  className="px-2 py-1 hover:bg-white transition-all duration-200 text-[#814E1E] font-bold text-sm group"
                                >
                                  <span className="group-hover:scale-110 inline-block transition-transform">
                                    -
                                  </span>
                                </button>
                                <span className="px-2 py-1 min-w-[32px] text-center font-semibold text-[#814E1E] bg-white border-x border-gray-200 text-sm">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() =>
                                    updateQuantity(
                                      item.id,
                                      item.variant,
                                      item.quantity + 1
                                    )
                                  }
                                  className="px-2 py-1 hover:bg-white transition-all duration-200 text-[#814E1E] font-bold text-sm group"
                                >
                                  <span className="group-hover:scale-110 inline-block transition-transform">
                                    +
                                  </span>
                                </button>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-[#814E1E] text-base">
                                  €{(item.price * item.quantity).toFixed(2)}
                                </p>
                                {item.originalPrice && (
                                  <p className="text-sm text-gray-400 line-through">
                                    €
                                    {(
                                      item.originalPrice * item.quantity
                                    ).toFixed(2)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              removeFromCart(item.id, item.variant)
                            }
                            className="absolute top-1.5 right-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-md transition-all duration-200"
                            aria-label="Verwijder uit winkelwagen"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Cross-sell Section - compact design */}
                  {upsellProducts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <h3 className="font-bold text-xs mb-1.5 flex items-center text-[#814E1E]">
                        <span className="text-base mr-1.5">
                          {!hasReachedFreeShipping ? "💡" : "⭐"}
                        </span>
                        {!hasReachedFreeShipping
                          ? "Bijna gratis verzending!"
                          : "Aanraders voor jou!"}
                      </h3>
                      {upsellProducts.map((product) => (
                        <div
                          key={product.id}
                          className="group relative flex items-center gap-1.5 p-1.5 bg-gradient-to-r from-[#FFF9F0] to-[#FFFCF5] border border-[#D6AD61]/30 rounded-md shadow-sm hover:shadow-md transition-all duration-300 mb-1"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-[#d7aa43]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
                          <div className="relative w-9 h-9 bg-white rounded-md overflow-hidden shadow-sm">
                            <Image
                              src={getProductImageSrc(product.image, product.id)}
                              alt={product.title || 'Product afbeelding'}
                              fill
                              className="object-contain p-1 group-hover:scale-105 transition-transform duration-300"
                              unoptimized={product.image?.startsWith("https")}
                            />
                          </div>
                          <div className="relative flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                {/* Desktop version - no line break */}
                                <h4 
                                  className="hidden md:block text-xs font-bold text-[#814E1E] mb-0"
                                  dangerouslySetInnerHTML={{ __html: product.title || 'Product' }}
                                />
                                {/* Mobile version - with line break for Combideal */}
                                <h4 
                                  className="md:hidden text-xs font-bold text-[#814E1E] mb-0"
                                  dangerouslySetInnerHTML={{ 
                                    __html: (product.title || 'Product').includes('Wasgeurtje Combideal') 
                                      ? (product.title || 'Product').replace('Wasgeurtje Combideal – ', 'Wasgeurtje Combideal –<br>') 
                                      : (product.title || 'Product')
                                  }}
                                />
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-bold text-[#814E1E]">
                                    €{product.price}
                                  </span>
                                  {product.originalPrice && (
                                    <span className="text-xs text-gray-500 line-through">
                                      €{product.originalPrice}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  const crossSellItem = {
                                    id: product.id,
                                    title: product.title,
                                    price: product.price,
                                    image: product.image,
                                    originalPrice: product.originalPrice,
                                  };
                                  addToCart(crossSellItem);
                                }}
                                className="text-white bg-gradient-to-r from-[#d7aa43] via-[#e8b960] to-[#c29635] hover:shadow-lg hover:shadow-[#d7aa43]/40 hover:scale-105 hover:from-[#e8b960] hover:to-[#d7aa43] px-3 py-1.5 rounded-lg transition-all duration-300 text-xs font-bold shadow-md border border-[#f5d68a]/30 hover:border-[#f5d68a]/50"
                                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                              >
                                + Add
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Continue Shopping Button - Always visible when items in cart */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <button
                      onClick={handleClose}
                      className="group w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-[#d7aa43]/30 rounded-xl font-semibold text-sm text-[#814E1E] hover:bg-[#FFF9F0] hover:border-[#d7aa43] hover:shadow-md transition-all duration-300"
                    >
                      <svg
                        className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16l-4-4m0 0l4-4m-4 4h18"
                        />
                      </svg>
                      <span>Verder winkelen</span>
                      <span className="text-xs text-gray-500 font-normal">•</span>
                      <span className="text-xs text-gray-500 font-normal">Bekijk meer producten</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sticky Checkout Section - Always at bottom */}
          <div className="border-t-2 border-gray-200 bg-gradient-to-br from-white via-white to-[#FFF9F0] px-3 py-2">

            {/* Totaal with Dropdown - Combined */}
            <button
              onClick={() => setIsAccordionOpen(!isAccordionOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-white/50 backdrop-blur-sm rounded-lg border border-gray-100 shadow-sm hover:bg-white hover:shadow-md transition-all duration-200 mb-2"
            >
              <span className="font-bold text-base text-[#814E1E]">Totaal</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-[#814E1E]">
                  €
                  {(
                    subtotal +
                    (!hasReachedFreeShipping ? 4.95 : 0) -
                    (isPromoApplied ? subtotal * 0.1 : 0)
                  ).toFixed(2)}
                </span>
                <svg
                  className={`w-3.5 h-3.5 text-[#814E1E] transition-transform duration-200 ${
                    isAccordionOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>

            {/* Accordion Content */}
            <div
              className={`overflow-hidden transition-all duration-300 ${
                isAccordionOpen ? "max-h-96 mb-3" : "max-h-0"
              }`}
            >
              <div className="space-y-4">
                {/* Promo Code */}
                <div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Kortingscode"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#d7aa43] focus:ring-2 focus:ring-[#d7aa43]/30 transition-all duration-200"
                    />
                    <button
                      onClick={() => {
                        if (promoCode) setIsPromoApplied(true);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-[#d7aa43] via-[#e8b960] to-[#c29635] text-white rounded-lg hover:shadow-lg hover:shadow-[#d7aa43]/40 hover:scale-105 hover:from-[#e8b960] hover:to-[#d7aa43] transition-all duration-300 text-sm font-bold shadow-md border border-[#f5d68a]/30 hover:border-[#f5d68a]/50"
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                    >
                      Apply
                    </button>
                  </div>
                  {isPromoApplied && (
                    <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Korting toegepast!
                    </p>
                  )}
                </div>

                {/* Breakdown */}
                <div className="space-y-2 bg-white/50 backdrop-blur-sm p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-gray-700">Subtotaal</span>
                    <span className="text-[#814E1E] font-semibold">
                      €{subtotal.toFixed(2)}
                    </span>
                  </div>
                  {!hasReachedFreeShipping && (
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-gray-700">Verzending</span>
                      <span className="text-[#814E1E] font-semibold">
                        €4,95
                      </span>
                    </div>
                  )}
                  {isPromoApplied && (
                    <div className="flex justify-between text-sm font-medium text-green-600">
                      <span>Korting (10%)</span>
                      <span>-€{(subtotal * 0.1).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Checkout Button - Always Visible and Prominent */}
            <Link href="/checkout">
              <button
                className="w-full bg-gradient-to-br from-[#d7aa43] via-[#e8b960] to-[#c29635] text-white py-3 px-5 rounded-xl font-bold text-base tracking-wide hover:shadow-2xl hover:shadow-[#d7aa43]/50 hover:scale-[1.02] hover:from-[#e8b960] hover:via-[#d7aa43] hover:to-[#b88a2e] transition-all duration-500 shadow-xl shadow-[#d7aa43]/30 uppercase border-2 border-[#f5d68a]/20 hover:border-[#f5d68a]/40 flex items-center justify-center gap-2"
                onClick={() => {
                  handleClose();
                }}
                style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
              >
                {isLoggedIn && user ? (
                  <span className="flex flex-col items-center">
                    <span>Afrekenen</span>
                    {user.loyalty && user.loyalty.points >= 60 && (
                      <span className="text-[10px] font-normal opacity-90 normal-case">
                        +{user.loyalty.points} punten beschikbaar
                      </span>
                    )}
                  </span>
                ) : (
                  "Afrekenen"
                )}
                <svg
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </button>
            </Link>

            {/* Trust Badges - horizontal auto-scroll */}
            <div className="mt-2">
              <div className="overflow-hidden relative">
                <div
                  className="flex animate-infinity-scroll gap-2"
                  style={{ animationPlayState: "running !important" }}
                >
                  {/* Create 4 identical sets for perfect seamless scrolling */}
                  {Array.from({ length: 4 }, (_, setIndex) =>
                    [
                      { icon: "🔒", text: "Veilig betalen" },
                      { icon: "⚡", text: "Vandaag verzonden" },
                      { icon: "♻️", text: "30 dagen retour" },
                      { icon: "🚚", text: "Gratis verzending" },
                      { icon: "💳", text: "iDEAL betaling" },
                      { icon: "⭐", text: "Hoge kwaliteit" },
                    ].map((badge, badgeIndex) => (
                      <div
                        key={`set-${setIndex}-badge-${badgeIndex}`}
                        className="flex items-center text-xs text-gray-600 bg-gray-50 rounded-md px-2 py-1 whitespace-nowrap flex-shrink-0 hover:bg-gray-100 transition-colors duration-200"
                        style={{ animationPlayState: "running" }}
                      >
                        <span className="text-xs mr-1.5">{badge.icon}</span>
                        <span className="font-medium">{badge.text}</span>
                      </div>
                    ))
                  ).flat()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
