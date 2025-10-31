"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface OrderDetails {
  orderId?: string;
  orderNumber?: string;
  paymentIntentId?: string;
  amount?: number;
  customerEmail?: string;
  status?: "loading" | "creating" | "completed" | "failed" | "payment_only";
  wooCommerceOrderId?: number;
  isCreating?: boolean;
  creationError?: string;
  orderData?: any;
}

// Analytics and monitoring functions
const trackOrderSuccess = (orderData: OrderDetails) => {
  if (typeof window !== "undefined") {
    // Google Analytics 4
    if ((window as any).gtag) {
      (window as any).gtag("event", "purchase", {
        transaction_id: orderData.orderId,
        value: orderData.amount,
        currency: "EUR",
        items:
          orderData.orderData?.lineItems?.map((item: any) => ({
            item_id: item.id,
            item_name: item.name,
            quantity: item.quantity,
            price: item.price,
          })) || [],
      });
    }

    // Facebook Pixel
    if ((window as any).fbq) {
      (window as any).fbq("track", "Purchase", {
        value: orderData.amount,
        currency: "EUR",
      });
    }
  }
};

const logErrorToService = (errorData: any) => {
  console.error("Application Error:", errorData);

  // Send to error tracking service (Sentry, LogRocket, etc.)
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "exception", {
      description: errorData.error,
      fatal: false,
    });
  }
};

export default function SuccessPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SuccessPageWrapper />
    </Suspense>
  );
}

// Loading component with skeleton screen
const LoadingState = () => (
  <div className="min-h-screen bg-[#F4F2EB] flex items-center justify-center">
    <div className="bg-white rounded-lg p-8 shadow-lg max-w-md w-full mx-4 text-center">
      <div className="animate-pulse">
        <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
      </div>
      <p className="text-gray-600 mt-4">Even geduld alstublieft...</p>
    </div>
  </div>
);

const SuccessPageWrapper = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orderDetails, setOrderDetails] = useState<OrderDetails>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [productDetails, setProductDetails] = useState<any[]>([]);

  // Refs to prevent duplicate operations
  const orderCreationStarted = useRef(false);
  const paymentVerified = useRef(false);

  // Function to fetch product details by IDs
  const fetchProductDetails = async (lineItems: any[]) => {
    try {
      const productIds = lineItems.map((item) => item.id);

      const response = await fetch(
        `/api/woocommerce/products?ids=${productIds.join(",")}`
      );

      if (response.ok) {
        const products = await response.json();

        const productsWithQuantity = products.map((product: any) => {
          const lineItem = lineItems.find((item) => item.id == product.id);
          return {
            ...product,
            quantity: lineItem?.quantity || 1,
          };
        });

        setProductDetails(productsWithQuantity);
      } else {
        const errorText = await response.text();
        logErrorToService({
          type: "PRODUCT_FETCH_FAILED",
          error: errorText,
          status: response.status,
        });
      }
    } catch (error) {
      logErrorToService({
        type: "PRODUCT_FETCH_ERROR",
        error: error,
      });
    }
  };

  useEffect(() => {
    const paymentIntentId = searchParams.get("payment_intent");
    const paymentIntentClientSecret = searchParams.get(
      "payment_intent_client_secret"
    );

    if (!paymentIntentId && !paymentIntentClientSecret) {
      setError("Geen betalingsinformatie gevonden");
      setLoading(false);
      return;
    }

    if (paymentIntentId && !paymentVerified.current) {
      paymentVerified.current = true;
      verifyPaymentStatus(paymentIntentId);
      return;
    }
  }, [searchParams]);

  // Fetch product details when orderData is available
  useEffect(() => {
    if (orderDetails.orderData?.lineItems) {
      fetchProductDetails(orderDetails.orderData.lineItems);
    }
  }, [orderDetails.orderData]);

  // Track order success when completed
  useEffect(() => {
    if (orderDetails.status === "completed" && orderDetails.orderId) {
      trackOrderSuccess(orderDetails);
    }
  }, [orderDetails.status, orderDetails.orderId]);

  const verifyPaymentStatus = async (paymentIntentId: string) => {
    try {
      const response = await fetch(
        `/api/stripe/payment-status?payment_intent=${paymentIntentId}`
      );

      if (!response.ok) {
        throw new Error("Failed to verify payment status");
      }

      const paymentStatus = await response.json();

      if (paymentStatus.status === "succeeded") {
        proceedWithSuccessFlow(paymentIntentId);
      } else {
        sessionStorage.removeItem("successOrderData");

        let errorMessage = "Betaling is niet succesvol voltooid.";
        if (paymentStatus.status === "canceled") {
          errorMessage = "Betaling is geannuleerd.";
        } else if (paymentStatus.status === "requires_action") {
          errorMessage = "Betaling vereist nog actie.";
        } else if (paymentStatus.status === "requires_payment_method") {
          errorMessage = "Betaling mislukt - probeer een andere betaalmethode.";
        }

        setError(
          errorMessage + " Ga terug naar de checkout om opnieuw te proberen."
        );
        setLoading(false);
      }
    } catch (error) {
      logErrorToService({
        type: "PAYMENT_VERIFICATION_ERROR",
        error: error,
        paymentIntentId,
      });

      sessionStorage.removeItem("successOrderData");
      setError("Kon betalingsstatus niet verifiëren. Probeer het opnieuw.");
      setLoading(false);
    }
  };

  const proceedWithSuccessFlow = (paymentIntentId: string) => {
    const successDataStr = sessionStorage.getItem("successOrderData");
    if (!successDataStr) {
      if (paymentIntentId) {
        fetch(`/api/stripe/payment-status?payment_intent=${paymentIntentId}`)
          .then((response) => response.json())
          .then((paymentStatus) => {
            setOrderDetails({
              paymentIntentId: paymentIntentId,
              status: "payment_only",
              amount: paymentStatus.amount ? paymentStatus.amount / 100 : 0,
            });
            setLoading(false);
          })
          .catch((error) => {
            logErrorToService({
              type: "PAYMENT_DETAILS_FETCH_ERROR",
              error: error,
              paymentIntentId,
            });

            setOrderDetails({
              paymentIntentId: paymentIntentId,
              status: "payment_only",
              amount: 0,
            });
            setLoading(false);
          });
        return;
      }

      setError("Geen bestelling data gevonden");
      setLoading(false);
      return;
    }

    try {
      const successData = JSON.parse(successDataStr);

      const { orderData, paymentIntentId: storedPaymentIntentId } = successData;
      const finalPaymentIntentId = paymentIntentId || storedPaymentIntentId;

      if (!orderData) {
        throw new Error("Order data ontbreekt");
      }

      // Set initial order details with proper status
      setOrderDetails({
        paymentIntentId: finalPaymentIntentId,
        amount: orderData?.finalTotal || orderData?.totals?.finalTotal,
        customerEmail: orderData?.customer?.email,
        isCreating: true,
        status: "creating",
        orderData: orderData,
      });

      checkForExistingOrderOrCreate(orderData, finalPaymentIntentId);
    } catch (err) {
      logErrorToService({
        type: "ORDER_DATA_PARSE_ERROR",
        error: err,
      });

      setError("Fout bij het verwerken van bestelling data");
      setLoading(false);
    }
  };

  const checkForExistingOrderOrCreate = async (
    orderData: any,
    paymentIntentId: string
  ) => {
    // Prevent duplicate order creation
    if (orderCreationStarted.current) {
      return;
    }
    orderCreationStarted.current = true;

    // 🚀 Production: Skip complex checks and create order directly
    await createWooCommerceOrder(orderData, paymentIntentId);
  };

  const createWooCommerceOrder = async (
    orderData: any,
    paymentIntentId: string,
    retryCount = 0
  ) => {
    const MAX_RETRIES = 2;

    // Prevent duplicate requests
    const requestKey = `order_request_${paymentIntentId}`;
    const requestCount = parseInt(sessionStorage.getItem(requestKey) || "0");

    if (requestCount > 0) {
      return;
    }

    sessionStorage.setItem(requestKey, "1");

    try {
      const lineItems = orderData.lineItems || [];
      const appliedDiscount = orderData.appliedDiscount;

      const totals = orderData.totals || {
        subtotal: orderData.finalTotal || 0,
        discountAmount: appliedDiscount?.discount_amount || 0,
        volumeDiscount: 0,
        shippingCost: (orderData.finalTotal || 0) >= 40 ? 0 : 4.95,
        finalTotal: orderData.finalTotal || 0,
      };

      // Validate required fields
      if (!lineItems || lineItems.length === 0) {
        throw new Error("Geen producten gevonden in bestelling");
      }

      if (!orderData.customer) {
        throw new Error("Klantgegevens ontbreken");
      }

      if (!orderData.customer.email) {
        throw new Error("Klant e-mail ontbreekt");
      }

      if (!paymentIntentId) {
        throw new Error("Payment Intent ID ontbreekt");
      }

      const requestPayload = {
        lineItems,
        customer: orderData.customer,
        appliedDiscount,
        totals,
        paymentIntentId,
      };

      const response = await fetch("/api/woocommerce/orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        let errorBody;
        try {
          errorBody = await response.text();

          let errorData;
          try {
            errorData = JSON.parse(errorBody);
          } catch {
            errorData = { error: errorBody };
          }

          throw new Error(
            errorData.error ||
              errorData.message ||
              `HTTP ${response.status}: ${response.statusText}`
          );
        } catch (readError) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      // Parse success response
      let result;
      try {
        const responseText = await response.text();
        result = JSON.parse(responseText);

        if (!result.orderId) {
          throw new Error("No orderId in response");
        }
      } catch (parseError) {
        throw new Error("Invalid response from server");
      }

      // ✅ ONLY set completed when order is actually created in WooCommerce
      setOrderDetails((prev) => ({
        ...prev,
        isCreating: false,
        wooCommerceOrderId: result.orderId,
        orderNumber: result.orderNumber,
        status: "completed",
      }));

      sessionStorage.removeItem("successOrderData");
      sessionStorage.removeItem(requestKey);
      setLoading(false);
    } catch (err) {
      // Retry logic for transient errors
      const shouldRetry =
        retryCount < MAX_RETRIES &&
        ["timeout", "network", "5"].some((keyword) =>
          errorMessage.includes(keyword)
        );

      if (shouldRetry) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (retryCount + 1))
        );
        return createWooCommerceOrder(
          orderData,
          paymentIntentId,
          retryCount + 1
        );
      }

      logErrorToService({
        type: "ORDER_CREATION_FAILED",
        error: err,
        paymentIntentId,
        retryCount,
      });

      const errorMessage =
        err instanceof Error
          ? err.message
          : "Onbekende fout bij het aanmaken van de bestelling";

      setOrderDetails((prev) => ({
        ...prev,
        isCreating: false,
        status: "failed",
        creationError: `⚠️ Betaling geslaagd, maar bestelling aanmaken mislukt. Onze support neemt contact met u op. Referentie: ${paymentIntentId}`,
      }));

      sessionStorage.removeItem(requestKey);
      setLoading(false);
    }
  };

  // 🎯 RENDERING LOGIC
  if (
    loading ||
    orderDetails.status === "loading" ||
    orderDetails.status === "creating" ||
    orderDetails.isCreating
  ) {
    return <LoadingState />;
  }

  // 🎯 ERROR STATE
  if (error || orderDetails.status === "failed") {
    const displayError =
      error || orderDetails.creationError || "Er is een fout opgetreden";

    return (
      <div className="min-h-screen bg-[#F4F2EB]">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Main Error Card */}
            <div className="bg-white rounded-lg p-8 shadow-lg text-center mb-6">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-10 h-10 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                {orderDetails.status === "failed"
                  ? "Betaling geslaagd, maar bestelling mislukt"
                  : "Oeps! Er is iets misgegaan"}
              </h1>

              <p className="text-gray-600 mb-6 leading-relaxed">
                {displayError}
              </p>

              {/* Primary Action - Try Again */}
              <div className="space-y-4">
                <Link
                  href="/checkout"
                  className="w-full inline-block bg-[#814e1e] text-white py-4 px-6 rounded-lg hover:bg-[#6d3f18] transition-colors font-semibold text-lg shadow-lg touch-manipulation"
                >
                  🔄 Probeer opnieuw
                </Link>

                <div className="flex gap-3">
                  <Link
                    href="/wasparfum"
                    className="flex-1 inline-block bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium text-center touch-manipulation"
                  >
                    🛍️ Verder winkelen
                  </Link>
                  <Link
                    href="/"
                    className="flex-1 inline-block bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium text-center touch-manipulation"
                  >
                    🏠 Naar homepage
                  </Link>
                </div>
              </div>
            </div>

            {/* Contact Support */}
            <div className="bg-blue-50 rounded-lg p-6 text-center">
              <h3 className="font-semibold text-gray-900 mb-2">
                🤝 Hulp nodig?
              </h3>
              <p className="text-gray-600 mb-4 text-sm">
                Neem contact op met onze klantenservice met je Payment ID.
              </p>
              {orderDetails.paymentIntentId && (
                <div className="bg-yellow-50 p-3 rounded mb-4">
                  <p className="text-sm font-mono text-gray-700">
                    Payment ID: {orderDetails.paymentIntentId}
                  </p>
                </div>
              )}
              <div className="flex gap-3 justify-center">
                <a
                  href="mailto:info@wasgeurtje.nl"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors touch-manipulation"
                >
                  📧 E-mail ons
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 🎯 SUCCESS STATE
  if (
    orderDetails.status === "completed" ||
    orderDetails.status === "payment_only"
  ) {
    return (
      <div className="min-h-screen bg-[#F4F2EB]">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Success Header */}
            <div className="bg-white rounded-lg p-8 mb-6 shadow-sm text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-10 h-10 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Bedankt voor je bestelling! 🎉
              </h1>

              <p className="text-lg text-gray-600 mb-6">
                Je betaling is succesvol verwerkt en je bestelling is in
                behandeling genomen.
              </p>

              {/* Order Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
                {orderDetails.wooCommerceOrderId && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Bestelnummer:</p>
                    <p className="font-bold text-lg text-gray-900">
                      #
                      {orderDetails.orderNumber ||
                        orderDetails.wooCommerceOrderId}
                    </p>
                  </div>
                )}

                {orderDetails.paymentIntentId && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Betalings-ID:</p>
                    <p className="font-mono text-sm text-gray-900">
                      {orderDetails.paymentIntentId}
                    </p>
                  </div>
                )}

                {orderDetails.amount && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      Betaald bedrag:
                    </p>
                    <p className="font-semibold text-gray-900">
                      €{orderDetails.amount.toFixed(2)}
                    </p>
                  </div>
                )}

                {orderDetails.creationError && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="text-sm text-yellow-800 font-medium mb-1">
                      ⚠️ Betalingsmelding:
                    </p>
                    <p className="text-sm text-yellow-700">
                      Je betaling is succesvol verwerkt, maar er was een
                      probleem bij het aanmaken van de bestelling:{" "}
                      {orderDetails.creationError}
                    </p>
                    <p className="text-sm text-yellow-700 mt-2">
                      Neem contact met ons op met je betalings-ID hierboven.
                    </p>
                  </div>
                )}
              </div>

              {/* Show message if no order data available */}
              {!orderDetails.orderData && (
                <div className="bg-blue-50 rounded-lg p-6 mb-6 text-center">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    🔍 Ordergegevens ophalen...
                  </h3>
                  <p className="text-blue-800 text-sm">
                    Je bestelling wordt verwerkt. Gedetailleerde ordergegevens
                    zijn beschikbaar in je e-mailbevestiging.
                  </p>
                </div>
              )}

              {/* Customer & Order Information */}
              {orderDetails.orderData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Customer Details */}
                  <div className="bg-white rounded-lg p-6 shadow-lg border border-gray-200">
                    <h3 className="font-bold text-gray-900 mb-6 text-xl border-b border-gray-200 pb-3">
                      Klantgegevens
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <span className="block text-gray-500 text-sm font-medium mb-1">
                          Naam:
                        </span>
                        <div className="font-bold text-gray-900 text-lg">
                          {orderDetails.orderData.customer?.firstName}{" "}
                          {orderDetails.orderData.customer?.lastName}
                        </div>
                      </div>
                      <div>
                        <span className="block text-gray-500 text-sm font-medium mb-1">
                          E-mail:
                        </span>
                        <div className="font-semibold text-gray-900 text-base">
                          {orderDetails.orderData.customer?.email}
                        </div>
                      </div>
                      {orderDetails.orderData.customer?.phone && (
                        <div>
                          <span className="block text-gray-500 text-sm font-medium mb-1">
                            Telefoon:
                          </span>
                          <div className="font-semibold text-gray-900 text-base">
                            {orderDetails.orderData.customer?.phone}
                          </div>
                        </div>
                      )}
                      {orderDetails.orderData.customer?.businessOrder && (
                        <>
                          {orderDetails.orderData.customer?.companyName && (
                            <div>
                              <span className="block text-gray-500 text-sm font-medium mb-1">
                                Bedrijf:
                              </span>
                              <div className="font-semibold text-gray-900 text-base">
                                {orderDetails.orderData.customer.companyName}
                              </div>
                            </div>
                          )}
                          {orderDetails.orderData.customer?.vatNumber && (
                            <div>
                              <span className="block text-gray-500 text-sm font-medium mb-1">
                                BTW-nummer:
                              </span>
                              <div className="font-semibold text-gray-900 text-base">
                                {orderDetails.orderData.customer.vatNumber}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Delivery Address */}
                  <div className="bg-white rounded-lg p-6 shadow-lg border border-gray-200">
                    <h3 className="font-bold text-gray-900 mb-6 text-xl border-b border-gray-200 pb-3">
                      Bezorgadres
                    </h3>
                    <div className="space-y-3">
                      <div className="font-bold text-gray-900 text-lg">
                        {orderDetails.orderData.customer?.firstName}{" "}
                        {orderDetails.orderData.customer?.lastName}
                      </div>
                      {orderDetails.orderData.customer?.companyName && (
                        <div className="text-gray-800 text-base font-medium">
                          {orderDetails.orderData.customer.companyName}
                        </div>
                      )}
                      <div className="text-gray-900 text-base leading-relaxed font-medium">
                        {orderDetails.orderData.customer?.useShippingAddress ? (
                          <>
                            <div className="mb-1">
                              {orderDetails.orderData.customer.shippingAddress}{" "}
                              {
                                orderDetails.orderData.customer
                                  .shippingHouseNumber
                              }
                              {
                                orderDetails.orderData.customer
                                  .shippingHouseAddition
                              }
                            </div>
                            <div className="mb-1">
                              {orderDetails.orderData.customer.shippingPostcode}{" "}
                              {orderDetails.orderData.customer.shippingCity}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="mb-1">
                              {orderDetails.orderData.customer?.address}{" "}
                              {orderDetails.orderData.customer?.houseNumber}
                              {orderDetails.orderData.customer?.houseAddition}
                            </div>
                            <div className="mb-1">
                              {orderDetails.orderData.customer?.postcode}{" "}
                              {orderDetails.orderData.customer?.city}
                            </div>
                          </>
                        )}
                        <div className="text-gray-700 mt-2 font-medium">
                          Nederland
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Summary */}
              {(orderDetails.orderData?.lineItems ||
                productDetails.length > 0) && (
                <div className="bg-white rounded-lg p-6 shadow-lg border border-gray-200 mb-6">
                  <h3 className="font-bold text-gray-900 mb-6 text-xl border-b border-gray-200 pb-3">
                    Bestelde producten
                  </h3>
                  <div className="space-y-6">
                    {productDetails.length > 0
                      ? // Show detailed product info when available
                        productDetails.map((product: any, index: number) => (
                          <div
                            key={product.id}
                            className="flex items-center space-x-6 py-4 border-b border-gray-100 last:border-b-0"
                          >
                            {/* Product Image */}
                            <div className="flex-shrink-0">
                              <div className="w-20 h-20 bg-gray-100 rounded-lg border-2 border-gray-200 flex items-center justify-center overflow-hidden">
                                {product.image ? (
                                  <img
                                    src={product.image}
                                    alt={product.title || product.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      console.log(
                                        "Image failed to load:",
                                        product.image
                                      );
                                      e.currentTarget.style.display = "none";
                                      const sibling = e.currentTarget
                                        .nextElementSibling as HTMLElement | null;
                                      if (sibling)
                                        sibling.style.display = "flex";
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                                    Geen afbeelding
                                  </div>
                                )}
                                <div
                                  className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs"
                                  style={{
                                    display: product.image ? "none" : "flex",
                                  }}
                                >
                                  Geen afbeelding
                                </div>
                              </div>
                            </div>

                            {/* Product Details */}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-gray-900 text-lg mb-2 truncate">
                                {product.title ||
                                  product.name ||
                                  `Product ID: ${product.id}`}
                              </h4>
                              <p className="text-base text-gray-700 font-medium mb-1">
                                Aantal: {product.quantity}
                              </p>
                              <p className="text-base font-semibold text-gray-900">
                                €{parseFloat(product.price || 0).toFixed(2)} per
                                stuk
                              </p>
                            </div>

                            {/* Total Price */}
                            <div className="flex-shrink-0 text-right">
                              <p className="font-bold text-gray-900 text-xl">
                                €
                                {(
                                  parseFloat(product.price || 0) *
                                  product.quantity
                                ).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))
                      : // Fallback to basic product info while loading
                        orderDetails.orderData?.lineItems?.map(
                          (item: any, index: number) => (
                            <div
                              key={index}
                              className="flex justify-between items-center py-4 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex items-center space-x-4">
                                <div className="w-20 h-20 bg-gray-200 rounded-lg border-2 border-gray-300 flex items-center justify-center">
                                  <span className="text-gray-500 text-xs">
                                    Laden...
                                  </span>
                                </div>
                                <div>
                                  <span className="font-bold text-gray-900 text-lg block">
                                    Product wordt geladen...
                                  </span>
                                  <span className="text-gray-700 text-base font-medium">
                                    Aantal: {item.quantity}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        )}

                    {/* Order Totals */}
                    {orderDetails.orderData?.totals && (
                      <div className="pt-8 mt-8 border-t-2 border-gray-300 space-y-4 bg-gray-50 -mx-6 px-6 py-6 rounded-b-lg">
                        <div className="flex justify-between text-lg">
                          <span className="text-gray-700 font-medium">
                            Subtotaal:
                          </span>
                          <span className="font-bold text-gray-900">
                            €
                            {orderDetails.orderData.totals.subtotal?.toFixed(2)}
                          </span>
                        </div>
                        {orderDetails.orderData.totals.discountAmount > 0 && (
                          <div className="flex justify-between text-lg text-green-600">
                            <span className="font-medium">Korting:</span>
                            <span className="font-bold">
                              -€
                              {orderDetails.orderData.totals.discountAmount.toFixed(
                                2
                              )}
                            </span>
                          </div>
                        )}
                        {orderDetails.orderData.totals.bundleDiscount > 0 && (
                          <div className="flex justify-between text-lg text-green-600">
                            <span className="font-medium">Bundle korting:</span>
                            <span className="font-bold">
                              -€
                              {orderDetails.orderData.totals.bundleDiscount.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {orderDetails.orderData.totals.volumeDiscount > 0 && (
                          <div className="flex justify-between text-lg text-green-600">
                            <span className="font-medium">Volume korting:</span>
                            <span className="font-bold">
                              -€
                              {orderDetails.orderData.totals.volumeDiscount.toFixed(
                                2
                              )}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg">
                          <span className="text-gray-700 font-medium">
                            Verzendkosten:
                          </span>
                          <span className="font-bold text-gray-900">
                            {orderDetails.orderData.totals.shippingCost === 0
                              ? "Gratis"
                              : `€${orderDetails.orderData.totals.shippingCost.toFixed(
                                  2
                                )}`}
                          </span>
                        </div>
                        <div className="flex justify-between font-black text-2xl pt-4 border-t-2 border-gray-400 text-gray-900">
                          <span>Totaal:</span>
                          <span>
                            €
                            {orderDetails.orderData.totals.finalTotal?.toFixed(
                              2
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="border-t border-gray-200 pt-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Wat gebeurt er nu?
                </h2>
                <div className="space-y-3 text-left">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-[#814e1e] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">1</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        Bevestiging per e-mail
                      </p>
                      <p className="text-sm text-gray-600">
                        Je ontvangt binnen enkele minuten een bevestiging van je
                        bestelling per e-mail.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-[#814e1e] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">2</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        Bestelling voorbereiden
                      </p>
                      <p className="text-sm text-gray-600">
                        We bereiden je bestelling zorgvuldig voor in ons
                        magazijn.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-[#814e1e] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">3</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Verzending</p>
                      <p className="text-sm text-gray-600">
                        Je bestelling wordt zo snel mogelijk naar je verzonden.
                        Je ontvangt een track & trace code.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Support */}
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Vragen over je bestelling?
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Neem gerust contact met ons op als je vragen hebt over je
                    bestelling of onze producten.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-gray-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                      <span className="text-gray-600">info@wasgeurtje.nl</span>
                    </div>
                    <div className="flex items-center gap-2"></div>
                  </div>
                </div>

                {/* Social Media */}
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Volg ons op social media
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Blijf op de hoogte van nieuwe producten en waslessen!
                  </p>
                  <div className="flex gap-3">
                    <a
                      href="#"
                      className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors"
                    >
                      <span className="text-white text-sm font-bold">f</span>
                    </a>
                    <a
                      href="#"
                      className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                    >
                      <span className="text-white text-sm font-bold">📷</span>
                    </a>
                    <a
                      href="#"
                      className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <span className="text-white text-sm font-bold">▶</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <Link
                  href="/"
                  className="flex-1 bg-[#814e1e] text-white py-3 px-6 rounded-lg hover:bg-[#6d3f18] transition-colors text-center font-semibold touch-manipulation"
                >
                  Terug naar home
                </Link>
                <Link
                  href="/shop"
                  className="flex-1 border border-[#814e1e] text-[#814e1e] py-3 px-6 rounded-lg hover:bg-[#814e1e] hover:text-white transition-colors text-center font-semibold touch-manipulation"
                >
                  Verder winkelen
                </Link>
              </div>
              {/* Guarantee Banner */}
              <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <svg
                    className="w-6 h-6 text-green-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <h3 className="font-semibold text-green-900">
                    100% Tevredenheidsgarantie
                  </h3>
                </div>
                <p className="text-sm text-green-800">
                  Niet tevreden? Geen probleem! Je krijgt binnen 30 dagen je
                  geld terug.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback - should not normally reach here
  return (
    <div className="min-h-screen bg-[#F4F2EB] flex items-center justify-center">
      <div className="bg-white rounded-lg p-8 shadow-lg max-w-md w-full mx-4 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Onverwachte status
        </h2>
        <p className="text-gray-600">
          Er is een onverwachte status opgetreden. Probeer het opnieuw.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block bg-[#814e1e] text-white py-2 px-4 rounded-lg hover:bg-[#6d3f18] transition-colors touch-manipulation"
        >
          Naar homepage
        </Link>
      </div>
    </div>
  );
};
