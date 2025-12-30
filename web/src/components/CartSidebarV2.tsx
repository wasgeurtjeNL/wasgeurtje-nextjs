"use client";

import { Fragment, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";

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
  return imagePath;
};

export default function CartSidebarV2() {
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
  } = useCart();
  const { user, isLoggedIn } = useAuth();

  const [isClosing, setIsClosing] = useState(false);

  // Handle closing animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      closeCart();
      setIsClosing(false);
    }, 300);
  };

  // Prevent body scroll when cart is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen && !isClosing) return null;

  // Filter out hidden products (dopjes)
  const visibleItems = items.filter((item) => !item.isHiddenProduct);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 transition-all duration-300 z-[999] ${
          isOpen && !isClosing ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleClose}
      />

      {/* Dialog Modal - Based on wasgeurtje.nl structure */}
      <div
        className={`fixed inset-0 z-[1000] flex items-center justify-end transition-all duration-300 ${
          isOpen && !isClosing ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        role="dialog"
        aria-label="Winkelwagen"
        aria-modal="true"
      >
        <div
          className={`bg-white w-full max-w-lg h-full shadow-2xl transition-transform duration-300 flex flex-col ${
            isOpen && !isClosing ? "translate-x-0" : "translate-x-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-2">
              <svg
                className="w-6 h-6 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <span className="text-lg font-semibold text-gray-900">
                {cartCount}
              </span>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Sluit winkelwagen"
            >
              <svg
                className="w-5 h-5 text-gray-700"
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

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {visibleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <svg
                  className="w-20 h-20 text-gray-300 mb-4"
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
                <p className="text-gray-500 text-lg font-medium mb-2">
                  Je winkelwagen is leeg
                </p>
                <p className="text-gray-400 text-sm mb-6">
                  Tijd om wat lekkers uit te kiezen!
                </p>
                <button
                  onClick={handleClose}
                  className="bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                >
                  Verder winkelen
                </button>
              </div>
            ) : (
              <div className="p-4">
                {/* Cart Items Table - Based on wasgeurtje.nl structure */}
                <table className="w-full">
                  <tbody>
                    {visibleItems.map((item) => {
                      const itemKey = `${item.id}-${item.variant || ""}`;
                      return (
                        <tr
                          key={itemKey}
                          className="border-b border-gray-200 last:border-b-0"
                        >
                          {/* Product Image */}
                          <td className="py-4 pr-4 align-top">
                            <div className="relative w-20 h-20 bg-gray-50 rounded overflow-hidden flex-shrink-0">
                              <Image
                                src={getProductImageSrc(item.image, item.id)}
                                alt={item.title || "Product afbeelding"}
                                fill
                                className="object-contain p-2"
                                unoptimized={item.image?.startsWith("http")}
                              />
                            </div>
                          </td>

                          {/* Product Name and Quantity */}
                          <td className="py-4 pr-4 align-top">
                            <div className="flex flex-col gap-2">
                              <h3
                                className="font-semibold text-gray-900 text-sm leading-tight"
                                dangerouslySetInnerHTML={{
                                  __html: item.title || "Product",
                                }}
                              />
                              {item.variant && (
                                <p className="text-xs text-gray-600">
                                  {item.variant}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <button
                                  onClick={() =>
                                    updateQuantity(
                                      item.id,
                                      item.variant,
                                      Math.max(0, item.quantity - 1)
                                    )
                                  }
                                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                                  aria-label="Verlaging"
                                >
                                  <svg
                                    className="w-4 h-4 text-gray-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M20 12H4"
                                    />
                                  </svg>
                                </button>
                                <span className="text-sm font-medium text-gray-900 min-w-[2rem] text-center">
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
                                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                                  aria-label="Bodverhoging"
                                >
                                  <svg
                                    className="w-4 h-4 text-gray-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 4v16m8-8H4"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* Quantity Display (hidden on mobile, shown in name column) */}
                          <td className="py-4 pr-4 hidden md:table-cell align-top">
                            <span className="text-sm text-gray-600">
                              {item.quantity}
                            </span>
                          </td>

                          {/* Price and Remove */}
                          <td className="py-4 text-right align-top">
                            <div className="flex flex-col items-end gap-2">
                              <button
                                onClick={() =>
                                  removeFromCart(item.id, item.variant)
                                }
                                className="text-gray-400 hover:text-red-500 transition-colors mb-1"
                                aria-label="Remove this item"
                              >
                                <svg
                                  className="w-4 h-4"
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
                              <span className="font-semibold text-gray-900 text-base">
                                €{(item.price * item.quantity).toFixed(2)}
                              </span>
                              {item.originalPrice && (
                                <span className="text-xs text-gray-400 line-through">
                                  €
                                  {(item.originalPrice * item.quantity).toFixed(
                                    2
                                  )}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer - Checkout Section */}
          {visibleItems.length > 0 && (
            <div className="border-t border-gray-200 p-4 space-y-4 bg-gray-50">
              {/* Subtotal */}
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="py-2 text-gray-700 font-medium">Subtotaal</td>
                    <td className="py-2 text-right font-semibold text-gray-900">
                      €{subtotal.toFixed(2)}
                    </td>
                  </tr>
                  {!hasReachedFreeShipping && (
                    <tr>
                      <td className="py-2 text-gray-700 font-medium">
                        Verzending
                      </td>
                      <td className="py-2 text-right font-semibold text-gray-900">
                        €1,95
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Checkout Button */}
              <Link href="/checkout">
                <button
                  onClick={handleClose}
                  className="w-full bg-gray-900 text-white py-3 px-5 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                >
                  Verder naar afrekenen
                </button>
              </Link>

              {/* Trust Badges */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <span className="font-medium">
                    Track&trace verzending slechts 1.95 NL & BE
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span className="font-medium">
                    Voor 16:00 uur besteld vandaag verzonden
                  </span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="pt-2">
                <Image
                  src="/figma/productpagina/betaalmethodes.png"
                  alt="Betaalmethodes"
                  width={200}
                  height={30}
                  className="mx-auto"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

