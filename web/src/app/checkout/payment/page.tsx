"use client";

import { Suspense, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import PaymentForm from "@/components/PaymentForm";
import {
  suppressStripeDevWarnings,
  stripeDefaultOptions,
} from '@/utils/stripe-config';
import OrderSummary, {
  AppliedDiscount,
  AuthUserLite,
  CartItemWithVariant,
  CheckoutFormData,
  PreviousAddress,
} from "@/components/sections/OrderSummary";

export interface OrderSummaryProps {
  // <-- make sure this is exported
  items: CartItemWithVariant[];
  subtotal: number;
  appliedDiscount: AppliedDiscount;
  calculateShipping: () => number;
  calculateDiscount: () => number;
  calculateVolumeDiscount: () => number;
  calculateTotal: () => number;
  removeFromCart: (id: string, variant?: string) => void;
  updateQuantity: (
    id: string,
    variant: string | undefined,
    quantity: number
  ) => void;
  formData: CheckoutFormData;
  previousAddresses: PreviousAddress[];
  isLoggedIn: boolean;
  user?: AuthUserLite;
  onLoyaltyCouponSelect?: (couponCode: string) => Promise<void>;
}

// Load Stripe
const getStripePromise = () => {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (
    !publishableKey ||
    publishableKey === "pk_test_placeholder_for_development"
  ) {
    console.warn(
      "⚠️  Stripe publishable key not configured. Please add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env.local"
    );
    return null;
  }
  return loadStripe(publishableKey);
};

const stripePromise = getStripePromise();

interface PaymentPageProps {
  orderData: any;
  orderSummary: OrderSummaryProps;
  onError?: (error: string) => void;
}

export default function PaymentPage({
  orderData,
  orderSummary,
  onError,
}: PaymentPageProps) {
  const router = useRouter();
  // const searchParams = useSearchParams();
  const [clientSecret, setClientSecret] = useState<string>("");
  const [paymentIntentId, setPaymentIntentId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [productDetails, setProductDetails] = useState<any[]>([]);
  const hasInitialized = useRef(false);
  const hasFetchedProducts = useRef(false);

  // Memoize Stripe options to prevent Elements from re-mounting
  const stripeOptions = useMemo(() => {
    if (!clientSecret) return null;
    return {
      clientSecret,
      ...stripeDefaultOptions,
    };
  }, [clientSecret]);

  // Memoize callback functions to prevent unnecessary re-renders
  const handlePaymentSuccessMemoized = useCallback((successPaymentIntentId: string) => {
    // Store both order data and payment intent ID for success page
    const successData = {
      orderData,
      paymentIntentId: successPaymentIntentId,
    };
    sessionStorage.setItem("successOrderData", JSON.stringify(successData));

    // Clear payment intent from sessionStorage as it's now complete
    sessionStorage.removeItem("paymentIntentId");
    sessionStorage.removeItem("clientSecret");
    console.log("✅ Payment successful, cleared payment intent from sessionStorage");

    // Always redirect to success page for consistent flow
    router.push(`/checkout/success?payment_intent=${successPaymentIntentId}`);
  }, [orderData, router]);

  const handlePaymentErrorMemoized = useCallback((error: string) => {
    setError(error);
    if (onError) {
      onError(error);
    }
  }, [onError]);

  // const {
  //   user,
  //   isLoggedIn,
  //   previousAddresses,
  //   formData,
  //   updateQuantity,
  //   removeFromCart,
  //   calculateTotal,
  //   calculateVolumeDiscount,
  //   calculateDiscount,
  //   calculateShipping,
  //   appliedDiscount,
  //   subtotal,
  //   items,
  // } = orderSummary;

  // Function to fetch product details by IDs
  const fetchProductDetails = async (lineItems: any[]) => {
    try {
      const productIds = lineItems.map((item) => item.id);
      console.log("🛍️ Fetching product details for IDs:", productIds);

      const response = await fetch(
        `/api/woocommerce/products?ids=${productIds.join(",")}`
      );
      if (response.ok) {
        const products = await response.json();
        // DEBUG: ✅ Product details fetched:', products);

        // Map products with quantities from lineItems
        const productsWithQuantity = products.map((product: any) => {
          const lineItem = lineItems.find((item) => item.id == product.id);
          return {
            ...product,
            quantity: lineItem?.quantity || 1,
          };
        });

        setProductDetails(productsWithQuantity);
      } else {
        console.error("❌ Failed to fetch product details");
      }
    } catch (error) {
      console.error("❌ Error fetching product details:", error);
    }
  };

  useEffect(() => {
    // Suppress Stripe development warnings
    suppressStripeDevWarnings();

    // Only initialize once
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Use orderData passed as props
    if (!orderData) {
      console.error("No order data provided");
      setError(
        "Er is een fout opgetreden bij het laden van de betalingsgegevens"
      );
      setLoading(false);
      return;
    }

    // Check if we have an existing payment intent in sessionStorage
    const existingPaymentIntentId = sessionStorage.getItem("paymentIntentId");
    const existingClientSecret = sessionStorage.getItem("clientSecret");

    if (existingPaymentIntentId && existingClientSecret) {
      console.log("💳 Reusing existing payment intent:", existingPaymentIntentId);
      setPaymentIntentId(existingPaymentIntentId);
      setClientSecret(existingClientSecret);
      setLoading(false);
    } else {
      console.log("💳 No existing payment intent, creating new one");
      // Create PaymentIntent once on mount
      createPaymentIntent(orderData);
    }
  }, []); // Empty deps - only run once on mount

  // Update payment intent when appliedDiscount or totals change
  useEffect(() => {
    // Skip on initial mount (hasInitialized will handle that)
    if (!hasInitialized.current) return;
    
    // Only update if orderData exists
    if (!orderData) return;

    // Only update if we have an existing payment intent
    if (!paymentIntentId) return;

    console.log("🔄 OrderData changed, updating payment intent", {
      appliedDiscount: orderData.appliedDiscount,
      totals: orderData.totals,
    });
    
    // Update payment intent with new data
    updatePaymentIntent(orderData);
  }, [
    orderData?.appliedDiscount?.coupon_code,
    orderData?.appliedDiscount?.discount_amount,
    orderData?.totals?.finalTotal,
  ]); // Listen to discount and total changes

  // Fetch product details when orderData is available (only once)
  useEffect(() => {
    if (hasFetchedProducts.current) return;
    if (orderData?.lineItems && productDetails.length === 0) {
      hasFetchedProducts.current = true;
      fetchProductDetails(orderData.lineItems);
    }
  }, []); // Empty deps - only run once on mount

  const createPaymentIntent = async (data: any) => {
    try {
      console.log("💳 Creating payment intent with data:", {
        hasAppliedDiscount: !!data.appliedDiscount,
        appliedDiscount: data.appliedDiscount,
        hasTotals: !!data.totals,
        totals: data.totals,
      });
      
      const response = await fetch("/api/stripe/create-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMessage = "Failed to create payment intent";
        let isSetupError = false;

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          isSetupError = errorData.setup_required || false;
        } catch (jsonError) {
          // If response is not JSON (e.g., HTML error page), use status text
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }

        // If it's a setup error, show specific setup instructions
        if (isSetupError) {
          setError(
            `${errorMessage}\n\nSetup instructies:\n1. Maak een .env.local bestand in de web/ directory\n2. Voeg je Stripe test keys toe (zie STRIPE_ENV_SETUP.md)\n3. Herstart de development server`
          );
        } else {
          setError(errorMessage);
        }
        setLoading(false);
        return;
      }

      const result = await response.json();
      setClientSecret(result.clientSecret);
      setPaymentIntentId(result.paymentIntentId);

      // Store payment intent details in sessionStorage for reuse
      sessionStorage.setItem("paymentIntentId", result.paymentIntentId);
      sessionStorage.setItem("clientSecret", result.clientSecret);
      console.log("✅ Payment intent stored in sessionStorage");

      // Store order data for success page BEFORE payment (for async redirects like iDEAL)
      const successData = {
        orderData: data,
        paymentIntentId: result.paymentIntentId,
      };
      const serializedData = JSON.stringify(successData);
      sessionStorage.setItem("successOrderData", serializedData);
      console.log("📦 Serialized data length:", serializedData.length);

      // Verify it was stored correctly
      const verifyData = sessionStorage.getItem("successOrderData");

      setLoading(false);
    } catch (err) {
      console.error("Error creating PaymentIntent:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Er is een fout opgetreden bij het voorbereiden van de betaling"
      );
      setLoading(false);
    }
  };

  const updatePaymentIntent = async (data: any) => {
    try {
      console.log("🔄 Updating payment intent with data:", {
        paymentIntentId,
        hasAppliedDiscount: !!data.appliedDiscount,
        appliedDiscount: data.appliedDiscount,
        hasTotals: !!data.totals,
        totals: data.totals,
      });
      
      const response = await fetch("/api/stripe/update-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          paymentIntentId,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to update payment intent";

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (jsonError) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }

        setError(errorMessage);
        return;
      }

      const result = await response.json();
      setClientSecret(result.clientSecret);

      // Update sessionStorage with new client secret (payment intent ID stays the same)
      sessionStorage.setItem("clientSecret", result.clientSecret);
      console.log("✅ Payment intent updated successfully");

      // Update order data for success page
      const successData = {
        orderData: data,
        paymentIntentId: result.paymentIntentId,
      };
      sessionStorage.setItem("successOrderData", JSON.stringify(successData));

    } catch (err) {
      console.error("Error updating PaymentIntent:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Er is een fout opgetreden bij het updaten van de betaling"
      );
    }
  };

  const handlePaymentSuccess = (successPaymentIntentId: string) => {
    // Store both order data and payment intent ID for success page
    const successData = {
      orderData,
      paymentIntentId: successPaymentIntentId,
    };
    sessionStorage.setItem("successOrderData", JSON.stringify(successData));

    // Clear payment intent from sessionStorage as it's now complete
    sessionStorage.removeItem("paymentIntentId");
    sessionStorage.removeItem("clientSecret");
    console.log("✅ Payment successful, cleared payment intent from sessionStorage");

    // Always redirect to success page for consistent flow
    router.push(`/checkout/success?payment_intent=${successPaymentIntentId}`);
  };

  const handlePaymentError = (error: string) => {
    setError(error);
    if (onError) {
      onError(error);
    }
  };

  if (loading) {
    return (
      // <div className="min-h-screen bg-[#F4F2EB] flex items-center justify-center">
      <div>
        {/* <div className="bg-white rounded-lg p-8  max-w-md w-full mx-4"> */}
        <div className="bg-white w-full">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded mb-4"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
          <p className="text-center text-gray-600 mt-4">
            Betaling voorbereiden...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      // <div className="min-h-screen bg-[#F4F2EB] flex items-center justify-center">
      <div>
        <div className="bg-white rounded-lg p-8  max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Er is een fout opgetreden
          </h2>
          <div className="text-gray-600 mb-6 text-left">
            {error.split("\n").map((line, index) => (
              <p
                key={index}
                className={index === 0 ? "mb-2 font-medium" : "mb-1"}
              >
                {line}
              </p>
            ))}
          </div>
          <button
            onClick={() =>
              onError ? onError("User cancelled") : router.push("/checkout")
            }
            className="w-full bg-[#814e1e] text-white py-3 rounded-lg hover:bg-[#6d3f18] transition-colors"
          >
            Terug naar checkout
          </button>
        </div>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      // <div className="min-h-screen bg-[#F4F2EB] flex items-center justify-center">
      <div>
        <div className="bg-white rounded-lg p-8  max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Stripe Setup Vereist
          </h2>
          <div className="text-gray-600 mb-6 text-left">
            <p className="mb-2 font-medium">Stripe is niet geconfigureerd</p>
            <p className="mb-1">
              1. Maak een .env.local bestand in de web/ directory
            </p>
            <p className="mb-1">
              2. Voeg je Stripe keys toe (zie STRIPE_ENV_SETUP.md)
            </p>
            <p className="mb-1">3. Herstart de development server</p>
          </div>
          <button
            onClick={() =>
              onError
                ? onError("Stripe not configured")
                : router.push("/checkout")
            }
            className="w-full bg-[#814e1e] text-white py-3 rounded-lg hover:bg-[#6d3f18] transition-colors"
          >
            Terug naar checkout
          </button>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      // <div className="min-h-screen bg-[#F4F2EB] flex items-center justify-center">
      <div>
        <div className="bg-white rounded-lg p-8 shadow-lg max-w-md w-full mx-4 text-center">
          <p className="text-gray-600">Betaling voorbereiden...</p>
        </div>
      </div>
    );
  }

  if (!stripeOptions) {
    return (
      <div>
        <div className="bg-white rounded-lg p-8 shadow-lg max-w-md w-full mx-4 text-center">
          <p className="text-gray-600">Betaling voorbereiden...</p>
        </div>
      </div>
    );
  }

  return (
    // <div className="min-h-screen bg-[#F4F2EB]">
    <Suspense fallback={<div>Loading payment form...</div>}>
      {/* <div className="container mx-auto px-4 py-8"> */}
      <div className="container">
        {/* <div className="max-w-2xl mx-auto">  dsf*/}
        <div>

          <div className="">
            <OrderSummary {...orderSummary} />
          </div>

          {/* Header */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 mb-6">
            <div className="bg-gradient-to-br from-slate-50 to-gray-100 px-6 py-5 border-b-2 border-gray-200">
              <div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  Betaling voltooien
                </h1>
                <p className="text-sm text-gray-600 mt-0.5">
                  Veilig betalen via Stripe
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
              <p className="text-sm text-gray-700 font-medium">
                Voer je betaalgegevens in om de bestelling af te ronden
              </p>
            </div>
          </div>

          {/* Payment Form */}
          <div className="bg-white rounded-lg md:p-6 p-2  border-gray-200">
            {/* KEY PROP: Force remount when clientSecret changes to ensure new payment intent is used */}
            <Elements 
              key={clientSecret} 
              stripe={stripePromise} 
              options={stripeOptions}
            >
              <PaymentForm
                onSuccess={handlePaymentSuccessMemoized}
                onError={handlePaymentErrorMemoized}
                amount={orderData?.finalTotal || 0}
                customerEmail={orderData?.customer?.email}
                customerName={`${orderData?.customer?.firstName || ""} ${
                  orderData?.customer?.lastName || ""
                }`.trim()}
                customerPhone={orderData?.customer?.phone}
                customerCountry="NL"
              />
            </Elements>
          </div>

          {/* Security Notice */}
          <div className="mt-6 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Je betaalgegevens worden veilig verwerkt door Stripe</span>
            </div>
          </div>
        </div>
      </div>
    </Suspense>
  );
}
