"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import CheckoutTracker from "@/components/analytics/CheckoutTracker";
import PaymentPage from "./payment/page";
import OrderSummary from "@/components/sections/OrderSummary";

// Progress steps for checkout (based on wasgeurtje.nl)
const CHECKOUT_STEPS = ["Informatie", "Verzendkosten", "Betaling"];

// Wasstrips product ID
const WASSTRIPS_PRODUCT_ID = "335060";

export default function CheckoutPageV2() {
  const router = useRouter();
  const { items, subtotal, removeFromCart, updateQuantity, addToCart } = useCart();
  const { user, isLoggedIn } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [email, setEmail] = useState("");
  const [createAccount, setCreateAccount] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("NL");
  const [postcode, setPostcode] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    amount: number;
    type: "fixed" | "percentage";
  } | null>(null);
  const [discountError, setDiscountError] = useState("");
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  const [shippingMethod, setShippingMethod] = useState("postnl");
  const [paymentMethod, setPaymentMethod] = useState("ideal");
  const [billingAddress, setBillingAddress] = useState("same");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [wasstripsAdded, setWasstripsAdded] = useState(false);

  // Filter visible items (exclude hidden products like caps)
  const visibleItems = items.filter((item) => !item.isHiddenProduct);

  // Check if wasstrips is already in cart
  useEffect(() => {
    const hasWasstrips = items.some(item => item.id === WASSTRIPS_PRODUCT_ID);
    setWasstripsAdded(hasWasstrips);
  }, [items]);

  // Handle wasstrips checkbox toggle
  const handleWasstripsToggle = (checked: boolean) => {
    if (checked) {
      // Add wasstrips to cart
      addToCart({
        id: WASSTRIPS_PRODUCT_ID,
        title: "Wasgeurtje Wasstrips",
        price: 13.46,
        quantity: 1,
        image: "https://wasgeurtje.nl/wp-content/uploads/2025/04/wasstrips.jpg.webp",
        originalPrice: 14.95,
        isHiddenProduct: false
      });
      setWasstripsAdded(true);
    } else {
      // Remove wasstrips from cart
      removeFromCart(WASSTRIPS_PRODUCT_ID);
      setWasstripsAdded(false);
    }
  };

  // Apply discount code (same as CheckoutPage.tsx)
  const applyDiscountCode = async () => {
    if (!couponCode.trim()) {
      setDiscountError("Voer een kortingscode in");
      return;
    }

    setIsApplyingDiscount(true);
    setDiscountError("");

    try {
      // Call WooCommerce API to validate coupon
      const response = await fetch(`/api/woocommerce/coupons/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coupon_code: couponCode,
          subtotal: subtotal,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ongeldige kortingscode");
      }

      const couponData = await response.json();

      // Set the discount
      setAppliedDiscount({
        code: couponCode,
        amount: couponData.discount_amount,
        type: couponData.discount_type === "percent" ? "percentage" : "fixed",
      });

      setCouponCode("");
    } catch (error) {
      console.error("Discount code error:", error);
      setDiscountError(
        error instanceof Error
          ? error.message
          : "Kortingscode kon niet worden toegepast"
      );
      setAppliedDiscount(null);
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  // Remove discount
  const removeDiscount = () => {
    setAppliedDiscount(null);
    setDiscountError("");
  };

  // Calculate discount amount
  const calculateDiscount = () => {
    if (!appliedDiscount) return 0;
    
    if (appliedDiscount.type === "percentage") {
      return (subtotal * appliedDiscount.amount) / 100;
    }
    return appliedDiscount.amount;
  };

  const discountAmount = calculateDiscount();
  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);

  // Calculate shipping (based on subtotal after discount)
  const shippingCost = subtotalAfterDiscount >= 29 ? 0 : 1.95;
  const total = subtotalAfterDiscount + shippingCost;

  // Format address for display
  const formattedAddress = `${firstName} ${lastName}, ${address}, ${postcode} ${city}`.trim();

  // Prepare orderData for PaymentPage (same structure as CheckoutPage)
  const orderData = useMemo(() => {
    const lineItems = visibleItems.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      price: item.price,
    }));

    const customer = {
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone,
      companyName: "",
      address: address,
      houseNumber: "",
      houseAddition: "",
      postcode: postcode,
      city: city,
      shippingAddress: address,
      shippingHouseNumber: "",
      shippingHouseAddition: "",
      shippingPostcode: postcode,
      shippingCity: city,
      useShippingAddress: true,
    };

    const totals = {
      subtotal: subtotal,
      discountAmount: discountAmount,
      loyaltyDiscount: 0,
      volumeDiscount: 0,
      bundleDiscount: 0,
      shippingCost: shippingCost,
      finalTotal: total,
    };

    return {
      customer,
      lineItems,
      appliedDiscount: appliedDiscount,
      totals,
      finalTotal: total,
    };
  }, [firstName, lastName, email, phone, address, postcode, city, visibleItems, subtotal, shippingCost, total, appliedDiscount, discountAmount]);

  // Helper functions for OrderSummary (simplified)
  const calculateShipping = () => shippingCost;
  const calculateVolumeDiscount = () => 0;
  const calculateTotal = () => total;

  // Count bottles for free caps message
  const BOTTLE_PRODUCTS = [
    "1427", "1425", "1423", "1417", "1410",
    "273950", "273949", "273947", "273946", "273942"
  ];
  const totalBottles = items
    .filter(item => BOTTLE_PRODUCTS.includes(item.id))
    .reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckoutTracker />
      <div className="min-h-screen bg-gray-50">
        {/* Progress Indicator */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-4">
            <nav aria-label="Progress">
              <ol className="flex items-center justify-center space-x-2 sm:space-x-4">
                {CHECKOUT_STEPS.map((step, index) => {
                  const stepNumber = index + 1;
                  const isClickable = currentStep > stepNumber;
                  
                  return (
                    <li key={step} className="flex items-center">
                      <button
                        onClick={() => isClickable && setCurrentStep(stepNumber)}
                        className={`flex flex-col sm:flex-row items-center ${isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                        disabled={!isClickable}
                      >
                        <div
                          className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 ${
                            currentStep > stepNumber
                              ? "bg-green-500 border-green-500 text-white"
                              : currentStep === stepNumber
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "bg-white border-gray-300 text-gray-500"
                          }`}
                        >
                          {currentStep > stepNumber ? (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <span className="text-xs sm:text-sm font-medium">{stepNumber}</span>
                          )}
                        </div>
                        <span className={`mt-0.5 sm:mt-0 sm:ml-2 text-[10px] sm:text-sm font-medium text-center sm:whitespace-nowrap ${
                          currentStep >= stepNumber ? "text-gray-900" : "text-gray-500"
                        }`}>
                          {step}
                        </span>
                      </button>
                      {index < CHECKOUT_STEPS.length - 1 && (
                        <svg className="mx-1.5 sm:mx-4 h-4 w-4 sm:h-5 sm:w-5 text-gray-300 flex-shrink-0 hidden sm:block" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
          </div>
        </div>

        {/* Loyalty Points Banner - Only show on step 1 */}
        {currentStep === 1 && isLoggedIn && user && (
          <div className="bg-blue-50 border-b border-blue-100">
            <div className="max-w-7xl mx-auto px-4 py-3">
              <p className="text-sm text-blue-900">
                Rond je bestelling af en verdien 30 punten met uw account voor korting op een toekomstige aankoop.
              </p>
            </div>
          </div>
        )}

        {/* Free Caps Alert - Only show on step 1 */}
        {currentStep === 1 && totalBottles > 0 && (
          <div className="bg-yellow-50 border-b border-yellow-200">
            <div className="max-w-7xl mx-auto px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎁</span>
                <p className="text-sm text-yellow-900">
                  <strong>{totalBottles} gratis {totalBottles === 1 ? 'dopje' : 'dopjes'} toegevoegd</strong> voor optimale dosering van je wasparfum
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {/* Mobile Collapsible Order Summary */}
              <div className="lg:hidden mb-6 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-blue-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-sm font-medium">
                      {isSidebarOpen ? 'Orderoverzicht verbergen' : 'Orderoverzicht weergeven'}
                    </span>
                    <svg 
                      className={`w-4 h-4 transition-transform ${isSidebarOpen ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <span className="text-lg font-bold text-gray-900">€{total.toFixed(2)}</span>
                </button>

                <div className={`transition-all duration-300 ease-in-out ${isSidebarOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                  <div className="p-4 pt-0 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Uw winkelwagen</h3>

                    {/* Cart Items */}
                    <div className="mb-6 overflow-x-auto">
                      <table className="w-full">
                        <tbody>
                          {visibleItems.map((item) => {
                            const itemKey = `${item.id}-${item.variant || ""}`;
                            return (
                              <tr key={itemKey} className="border-b border-gray-200 last:border-b-0">
                                <td className="py-3 pr-2">
                                  <div className="relative w-12 h-12 bg-gray-50 rounded overflow-hidden flex-shrink-0">
                                    <Image
                                      src={item.image || "/figma/product-flower-rain.png"}
                                      alt={item.title || "Product"}
                                      fill
                                      className="object-contain p-1"
                                      unoptimized={item.image?.startsWith("http")}
                                    />
                                  </div>
                                </td>
                                <td className="py-3 pr-2">
                                  <div className="flex flex-col gap-1">
                                    <h4 className="text-xs font-medium text-gray-900 line-clamp-2" dangerouslySetInnerHTML={{ __html: item.title || "Product" }} />
                                    {item.variant && (
                                      <p className="text-[10px] text-gray-600">{item.variant}</p>
                                    )}
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => updateQuantity(item.id, item.variant, Math.max(0, item.quantity - 1))}
                                        className="p-0.5 hover:bg-gray-100 rounded"
                                      >
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                        </svg>
                                      </button>
                                      <span className="text-xs font-medium min-w-[1rem] text-center">{item.quantity}</span>
                                      <button
                                        onClick={() => updateQuantity(item.id, item.variant, item.quantity + 1)}
                                        className="p-0.5 hover:bg-gray-100 rounded"
                                      >
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 text-right">
                                  <div className="flex flex-col items-end gap-1">
                                    <button
                                      onClick={() => removeFromCart(item.id, item.variant)}
                                      className="text-gray-400 hover:text-red-500"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                    <span className="font-semibold text-gray-900 text-xs">€{(item.price * item.quantity).toFixed(2)}</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Coupon Code */}
                    <div className="mb-6">
                      <label htmlFor="coupon-mobile" className="block text-xs font-medium text-gray-700 mb-2">
                        Kortingscode
                      </label>
                      
                      {/* Applied discount display */}
                      {appliedDiscount && (
                        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span className="text-xs font-medium text-green-800">
                                Kortingscode "{appliedDiscount.code}"
                              </span>
                            </div>
                            <button
                              onClick={removeDiscount}
                              className="text-xs text-red-600 hover:text-red-800 font-medium"
                            >
                              Verwijder
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Discount error */}
                      {discountError && (
                        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-xs text-red-800">{discountError}</p>
                        </div>
                      )}

                      {/* Input field */}
                      {!appliedDiscount && (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            id="coupon-mobile"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && applyDiscountCode()}
                            placeholder="Voer de promotiecode in"
                            className="flex-1 px-2 py-2 text-xs text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isApplyingDiscount}
                          />
                          <button
                            onClick={applyDiscountCode}
                            disabled={isApplyingDiscount}
                            className="px-3 py-2 text-xs bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isApplyingDiscount ? "..." : "Toepassen"}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Order Summary */}
                    <table className="w-full">
                      <tbody>
                        <tr>
                          <td className="py-2 text-xs text-gray-700">Subtotaal</td>
                          <td className="py-2 text-right text-sm font-semibold text-gray-900">€{subtotal.toFixed(2)}</td>
                        </tr>
                        {discountAmount > 0 && (
                          <tr>
                            <td className="py-2 text-xs text-green-700">Korting</td>
                            <td className="py-2 text-right text-sm font-semibold text-green-700">-€{discountAmount.toFixed(2)}</td>
                          </tr>
                        )}
                        <tr>
                          <td className="py-2 text-xs text-gray-700">Verzendmethoden</td>
                          <td className="py-2 text-right text-xs text-gray-600">
                            {currentStep >= 2 ? (
                              shippingCost === 0 ? "Gratis" : `€${shippingCost.toFixed(2)}`
                            ) : (
                              <span className="text-[10px]">Voer je adres in</span>
                            )}
                          </td>
                        </tr>
                        <tr className="border-t border-gray-200">
                          <td className="py-3 text-sm font-semibold text-gray-900">Totaal</td>
                          <td className="py-3 text-right font-bold text-base text-gray-900">€{total.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Snelle kassa</h2>

                {/* Step 1: Information */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Informatie</h3>
                      
                      {/* Login Link */}
                      {!isLoggedIn && (
                        <div className="mb-4 text-sm text-gray-600">
                          Heb je al een account?{" "}
                          <Link href="/login" className="text-blue-600 hover:underline">
                            Inloggen.
                          </Link>
                        </div>
                      )}

                      {/* Email */}
                      <div className="mb-4">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                          E-mailadres *
                        </label>
                        <input
                          type="email"
                          id="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      {/* Create Account */}
                      {!isLoggedIn && (
                        <div className="mb-6">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={createAccount}
                              onChange={(e) => setCreateAccount(e.target.checked)}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Maak een Wasgeurtje winkel account aan.</span>
                          </label>
                        </div>
                      )}

                      {/* Shipping Address */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Verzendadres</h3>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                              Voornaam *
                            </label>
                            <input
                              type="text"
                              id="firstName"
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                          <div>
                            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                              Achternaam *
                            </label>
                            <input
                              type="text"
                              id="lastName"
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                        </div>

                        <div className="mb-4">
                          <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                            Straatnaam huisnummer
                          </label>
                          <input
                            type="text"
                            id="address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                              Land/regio *
                            </label>
                            <select
                              id="country"
                              value={country}
                              onChange={(e) => setCountry(e.target.value)}
                              className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            >
                              <option value="NL">Nederland</option>
                              <option value="BE">België</option>
                              <option value="DE">Duitsland</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor="postcode" className="block text-sm font-medium text-gray-700 mb-1">
                              Postcode
                            </label>
                            <input
                              type="text"
                              id="postcode"
                              value={postcode}
                              onChange={(e) => setPostcode(e.target.value)}
                              className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div className="mb-4">
                          <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                            Plaats
                          </label>
                          <input
                            type="text"
                            id="city"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                            Telefoon *
                          </label>
                          <div className="flex gap-2">
                            <select className="px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                              <option value="+31">Nederland +31</option>
                              <option value="+32">België +32</option>
                              <option value="+49">Duitsland +49</option>
                            </select>
                            <input
                              type="tel"
                              id="phone"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              placeholder="06 12345678"
                              className="flex-1 px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      {/* Wasstrips Upsell */}
                      <div className="mt-6 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <label className="flex items-start cursor-pointer">
                          <input
                            type="checkbox"
                            checked={wasstripsAdded}
                            onChange={(e) => handleWasstripsToggle(e.target.checked)}
                            className="mt-1 mr-2 sm:mr-3 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-gray-900 text-sm sm:text-base block mb-2">
                              Ja, ik wil voordelig wassen met Wasstrips!
                            </span>
                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                              <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 mx-auto sm:mx-0">
                                <Image
                                  src="https://wasgeurtje.nl/wp-content/uploads/2025/04/wasstrips.jpg.webp"
                                  alt="Wasstrips"
                                  width={96}
                                  height={96}
                                  className="rounded object-cover w-full h-full"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm text-gray-700 mb-2">
                                  💧 Slechts €0,18 per wasbeurt (60 wasbeurten)! Voeg onze Wasgeurtje Wasstrips toe: compact, biologisch afbreekbaar en heerlijk geurend. Exclusieve korting alleen nu!
                                </p>
                                <div className="flex items-center gap-2 justify-center sm:justify-start">
                                  <span className="text-xs sm:text-sm text-gray-500 line-through">€ 14,95</span>
                                  <span className="text-base sm:text-lg font-bold text-gray-900">€ 13,46</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </label>
                      </div>

                      {/* Continue Button */}
                      <button
                        onClick={() => setCurrentStep(2)}
                        className="w-full mt-6 bg-blue-600 text-white py-3 px-6 rounded-md font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Doorgaan met de verzending
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Shipping */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    {/* Summary Table */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <tbody>
                          <tr className="border-b border-gray-200">
                            <td className="px-4 py-3 bg-gray-50 font-semibold text-gray-900">Contact</td>
                            <td className="px-4 py-3 text-gray-900">{email || "Niet ingevuld"}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => setCurrentStep(1)}
                                className="text-blue-600 hover:underline text-sm"
                              >
                                Wijzigen
                              </button>
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 bg-gray-50 font-semibold text-gray-900">Leveradres</td>
                            <td className="px-4 py-3 text-gray-900">{formattedAddress || "Niet ingevuld"}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => setCurrentStep(1)}
                                className="text-blue-600 hover:underline text-sm"
                              >
                                Wijzigen
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Shipping Method */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Verzendmethode</h3>
                      <div className="space-y-3">
                        <label className="flex items-center p-4 border-2 border-blue-600 rounded-lg cursor-pointer bg-blue-50">
                          <input
                            type="radio"
                            name="shipping"
                            value="postnl"
                            checked={shippingMethod === "postnl"}
                            onChange={(e) => setShippingMethod(e.target.value)}
                            className="mr-3"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">Postnl Track&trace(1-2 werkdagen)</div>
                            <div className="text-sm text-gray-600 mt-1">€ {shippingCost.toFixed(2)}</div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex gap-4">
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-md font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        « Terug naar informatie
                      </button>
                      <button
                        onClick={() => setCurrentStep(3)}
                        className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-md font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Verder naar betalen
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Payment */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    {/* Summary Table */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <tbody>
                          <tr className="border-b border-gray-200">
                            <td className="px-4 py-3 bg-gray-50 font-semibold text-gray-900">Contact</td>
                            <td className="px-4 py-3 text-gray-900">{email || "Niet ingevuld"}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => setCurrentStep(1)}
                                className="text-blue-600 hover:underline text-sm"
                              >
                                Wijzigen
                              </button>
                            </td>
                          </tr>
                          <tr className="border-b border-gray-200">
                            <td className="px-4 py-3 bg-gray-50 font-semibold text-gray-900">Leveradres</td>
                            <td className="px-4 py-3 text-gray-900">{formattedAddress || "Niet ingevuld"}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => setCurrentStep(1)}
                                className="text-blue-600 hover:underline text-sm"
                              >
                                Wijzigen
                              </button>
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 bg-gray-50 font-semibold text-gray-900">Methode</td>
                            <td className="px-4 py-3 text-gray-900">Postnl Track&trace(1-2 werkdagen)</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => setCurrentStep(2)}
                                className="text-blue-600 hover:underline text-sm"
                              >
                                Wijzigen
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Payment Page Integration */}
                    <PaymentPage
                      orderData={orderData}
                      onError={(error) => {
                        console.error("Payment error:", error);
                      }}
                      orderSummary={{
                        items: visibleItems.map((item) => ({
                          id: item.id,
                          title: item.title || "",
                          price: item.price,
                          quantity: item.quantity,
                          variant: item.variant,
                          image: item.image,
                        })),
                        subtotal,
                        appliedDiscount: appliedDiscount || undefined,
                        calculateShipping,
                        calculateDiscount,
                        calculateVolumeDiscount,
                        calculateTotal,
                        removeFromCart,
                        updateQuantity,
                        formData: {
                          firstName,
                          lastName,
                          email,
                          phone,
                          billingAddress: address,
                          billingHouseNumber: "",
                          billingHouseAddition: "",
                          billingPostcode: postcode,
                          billingCity: city,
                          shippingAddress: address,
                          shippingHouseNumber: "",
                          shippingHouseAddition: "",
                          shippingPostcode: postcode,
                          shippingCity: city,
                          useShippingAddress: true,
                          companyName: "",
                        },
                        previousAddresses: [],
                        isLoggedIn,
                        user: user || undefined,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Sidebar - Order Summary (Always visible on desktop) */}
            <div className="hidden lg:block lg:col-span-1">
              <aside className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Uw winkelwagen</h3>

                {/* Cart Items Table */}
                <table className="w-full mb-6">
                  <tbody>
                    {visibleItems.map((item) => {
                      const itemKey = `${item.id}-${item.variant || ""}`;
                      return (
                        <tr key={itemKey} className="border-b border-gray-200 last:border-b-0">
                          <td className="py-3 pr-3">
                            <div className="relative w-16 h-16 bg-gray-50 rounded overflow-hidden">
                              <Image
                                src={item.image || "/figma/product-flower-rain.png"}
                                alt={item.title || "Product"}
                                fill
                                className="object-contain p-1"
                                unoptimized={item.image?.startsWith("http")}
                              />
                            </div>
                          </td>
                          <td className="py-3 pr-3">
                            <div className="flex flex-col gap-1">
                              <h4 className="text-sm font-medium text-gray-900" dangerouslySetInnerHTML={{ __html: item.title || "Product" }} />
                              {item.variant && (
                                <p className="text-xs text-gray-600">{item.variant}</p>
                              )}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => updateQuantity(item.id, item.variant, Math.max(0, item.quantity - 1))}
                                  className="p-1 hover:bg-gray-100 rounded"
                                  aria-label="Verlaging"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                  </svg>
                                </button>
                                <span className="text-sm font-medium min-w-[1.5rem] text-center">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.id, item.variant, item.quantity + 1)}
                                  className="p-1 hover:bg-gray-100 rounded"
                                  aria-label="Bodverhoging"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <button
                                onClick={() => removeFromCart(item.id, item.variant)}
                                className="text-gray-400 hover:text-red-500"
                                aria-label="Remove this item"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              <span className="font-semibold text-gray-900">€{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Coupon Code */}
                <div className="mb-6">
                  <label htmlFor="coupon" className="block text-sm font-medium text-gray-700 mb-2">
                    Kortingscode
                  </label>
                  
                  {/* Applied discount display */}
                  {appliedDiscount && (
                    <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium text-green-800">
                            Kortingscode "{appliedDiscount.code}"
                          </span>
                        </div>
                        <button
                          onClick={removeDiscount}
                          className="text-sm text-red-600 hover:text-red-800 font-medium"
                        >
                          Verwijder
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Discount error */}
                  {discountError && (
                    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800">{discountError}</p>
                    </div>
                  )}

                  {/* Input field */}
                  {!appliedDiscount && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="coupon"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && applyDiscountCode()}
                        placeholder="Voer de promotiecode in"
                        className="flex-1 px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isApplyingDiscount}
                      />
                      <button
                        onClick={applyDiscountCode}
                        disabled={isApplyingDiscount}
                        className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isApplyingDiscount ? "..." : "Toepassen"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Order Summary */}
                <table className="w-full mb-6">
                  <tbody>
                    <tr>
                      <td className="py-2 text-gray-700">Subtotaal</td>
                      <td className="py-2 text-right font-semibold text-gray-900">€{subtotal.toFixed(2)}</td>
                    </tr>
                    {discountAmount > 0 && (
                      <tr>
                        <td className="py-2 text-green-700">Korting</td>
                        <td className="py-2 text-right font-semibold text-green-700">-€{discountAmount.toFixed(2)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-2 text-gray-700">Verzendmethoden</td>
                      <td className="py-2 text-right text-sm text-gray-600">
                        {currentStep >= 2 ? (
                          shippingCost === 0 ? "Gratis" : `€${shippingCost.toFixed(2)}`
                        ) : (
                          "Voer je adres in om de verzendopties te bekijken."
                        )}
                      </td>
                    </tr>
                    <tr className="border-t border-gray-200">
                      <td className="py-3 font-semibold text-gray-900">Totaal</td>
                      <td className="py-3 text-right font-bold text-lg text-gray-900">€{total.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </Suspense>
  );
}

