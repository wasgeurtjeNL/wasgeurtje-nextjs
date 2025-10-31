"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

export default function AccountPage() {
  const {
    user,
    orders,
    isLoggedIn,
    fetchOrders,
    sessionRestored,
  } = useAuth();
  const { addToCart } = useCart();
  const router = useRouter();
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null);

  useEffect(() => {
    // Wait for session restore to complete before redirecting
    if (sessionRestored && !isLoggedIn) {
      router.push("/auth/login");
      return;
    }

    // Progressive loading: Always fetch orders when page loads
    // Cache logic in fetchOrders prevents duplicate calls
    if (sessionRestored && isLoggedIn) {
      setIsLoadingOrders(true);
      const timer = setTimeout(async () => {
        await fetchOrders();
        setIsLoadingOrders(false);
      }, 300); // 300ms delay for better perceived performance
      
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, sessionRestored, fetchOrders]);

  // Show loading state while session is being restored
  if (!sessionRestored) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#814E1E] mx-auto"></div>
          <p className="mt-4 text-gray-600">Even geduld...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn || !user) {
    return null; // Will redirect
  }

  const recentOrders = orders.slice(0, 3); // Show last 3 orders

  // Function to reorder - adds all items from an order to cart at full price
  const handleReorder = async (order: typeof orders[0]) => {
    setReorderingOrderId(order.id);
    
    try {
      // Fetch current product prices from WooCommerce (to get full prices without discounts)
      const productIds = order.items.map(item => item.id).join(',');
      const response = await fetch(`/api/woocommerce/products?ids=${productIds}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch product prices');
      }
      
      const products = await response.json();
      
      // Create a map of product ID to current price
      const priceMap = new Map();
      products.forEach((product: any) => {
        // Use regular_price (full price) or fall back to price
        const fullPrice = product.regular_price || product.price || 0;
        // Store with both string and number keys for compatibility
        priceMap.set(product.id, fullPrice);
        priceMap.set(product.id.toString(), fullPrice);
      });
      
      // Add each product from the order to the cart with current full price
      for (const item of order.items) {
        const currentPrice = priceMap.get(item.id) || item.price; // Fallback to order price if not found
        
        addToCart({
          id: item.id,
          title: item.name,
          price: currentPrice,
          quantity: item.quantity,
          image: item.image,
        });
      }
      
      // Show simple success message (no mention of discounts to avoid customers asking)
      const productText = order.items.length === 1 ? 'product' : 'producten';
      alert(`✅ ${order.items.length} ${productText} toegevoegd aan winkelwagen!`);
      
      // Optionally redirect to cart
      // router.push('/checkout');
    } catch (error) {
      console.error('Error reordering:', error);
      alert('❌ Er is iets misgegaan bij het toevoegen van producten aan de winkelwagen.');
    } finally {
      setReorderingOrderId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "text-green-600 bg-green-50";
      case "shipped":
        return "text-blue-600 bg-blue-50";
      case "processing":
        return "text-yellow-600 bg-yellow-50";
      case "pending":
        return "text-gray-600 bg-gray-50";
      case "cancelled":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "delivered":
        return "Bezorgd";
      case "shipped":
        return "Verzonden";
      case "processing":
        return "In behandeling";
      case "pending":
        return "In afwachting";
      case "cancelled":
        return "Geannuleerd";
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6F0] py-6 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#814E1E] mb-2">
            Welkom terug, {user.firstName}! 👋
          </h1>
          <p className="text-gray-600">
            Beheer je account, bekijk je bestellingen en ontdek exclusieve
            aanbiedingen.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Account Info */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex items-center space-x-4 mb-6">
                {user.avatar ? (
                  <Image
                    src={user.avatar}
                    alt="Profile"
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-full object-cover border-4 border-[#D6AD61]"
                  />
                ) : (
                  <div className="w-16 h-16 bg-[#D6AD61] rounded-full flex items-center justify-center">
                    <span className="text-white text-xl font-bold">
                      {user.firstName.charAt(0)}
                      {user.lastName.charAt(0)}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-[#814E1E]">
                    {user.displayName}
                  </h3>
                  <p className="text-sm text-gray-600">{user.email}</p>
                  {user.phone && (
                    <p className="text-sm text-gray-600">{user.phone}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  href="/account/profile"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-[#FFF9F0] transition-colors group">
                  <div className="flex items-center space-x-3">
                    <svg
                      className="w-5 h-5 text-[#814E1E]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">
                      Profiel bewerken
                    </span>
                  </div>
                  <svg
                    className="w-4 h-4 text-gray-400 group-hover:text-[#814E1E] transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>

                <Link
                  href="/account/orders"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-[#FFF9F0] transition-colors group">
                  <div className="flex items-center space-x-3">
                    <svg
                      className="w-5 h-5 text-[#814E1E]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z"
                      />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">
                      Alle bestellingen
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-[#D6AD61] text-white px-2 py-1 rounded-full">
                      {orders.length}
                    </span>
                    <svg
                      className="w-4 h-4 text-gray-400 group-hover:text-[#814E1E] transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </Link>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-[#814E1E] mb-4">
                Jouw statistieken
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Totaal besteld</span>
                  <span className="font-bold text-[#814E1E]">
                    {isLoadingOrders ? (
                      <span className="inline-block animate-pulse">...</span>
                    ) : (
                      <>
                        €
                        {orders
                          .reduce((sum, order) => sum + order.total, 0)
                          .toFixed(2)
                          .replace(".", ",")}
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Aantal bestellingen
                  </span>
                  <span className="font-bold text-[#814E1E]">
                    {isLoadingOrders ? (
                      <span className="inline-block animate-pulse">...</span>
                    ) : (
                      orders.length
                    )}
                  </span>
                </div>

                {/* Loyalty Points - Lightweight display, no fetching */}
                {user.loyalty && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-600">
                      Loyalty punten
                    </span>
                    <div className="flex items-center">
                      <span className="font-bold text-[#D6AD61]">
                        {user.loyalty.points}
                      </span>
                      <svg
                        className="w-4 h-4 text-[#D6AD61] ml-1"
                        fill="currentColor"
                        viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Loyalty CTA Card - Quick Link */}
            {user.loyalty && (
              <Link href="/account/loyalty" className="block mt-6">
                <div className="bg-gradient-to-r from-[#D6AD61] to-[#814E1E] rounded-xl shadow-sm p-6 text-white hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-2xl">🎁</span>
                        <h3 className="text-lg font-semibold">
                          Loyalty Rewards
                        </h3>
                      </div>
                      <p className="text-sm opacity-90 mb-1">
                        {user.loyalty.points} punten beschikbaar
                      </p>
                      {user.loyalty.points >= 60 && (
                        <p className="text-sm font-semibold">
                          ✨ Je kunt punten inwisselen!
                        </p>
                      )}
                      {user.loyalty.points < 60 && (
                        <p className="text-sm opacity-80">
                          Nog {60 - user.loyalty.points} punten tot beloning
                        </p>
                      )}
                    </div>
                    <svg
                      className="w-6 h-6 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            )}
          </div>

          {/* Right Column - Recent Orders & Quick Actions */}
          <div className="lg:col-span-2">
            {/* Recent Orders */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-[#814E1E]">
                  Recente bestellingen
                </h3>
                <Link
                  href="/account/orders"
                  className="text-sm font-medium text-[#814E1E] hover:text-[#D6AD61] transition-colors">
                  Alle bestellingen →
                </Link>
              </div>

              {recentOrders.length > 0 ? (
                <div className="space-y-4">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-[#D6AD61] transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-[#814E1E]">
                            Bestelling {order.orderNumber}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {new Date(order.date).toLocaleDateString("nl-NL")}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                              order.status
                            )}`}>
                            {getStatusText(order.status)}
                          </span>
                          <p className="text-sm font-bold text-[#814E1E] mt-1">
                            €{order.total.toFixed(2).replace(".", ",")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        {order.items.slice(0, 3).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center space-x-2">
                            <Image
                              src={item.image}
                              alt={item.name}
                              width={32}
                              height={32}
                              className="w-8 h-8 object-contain bg-[#F8F6F0] rounded"
                            />
                            <span className="text-xs text-gray-600">
                              {item.quantity}x
                            </span>
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{order.items.length - 3} meer
                          </span>
                        )}
                      </div>

                      {order.trackingCode && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">
                              Track & Trace:
                            </span>
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {order.trackingCode}
                            </code>
                          </div>
                        </div>
                      )}

                      {/* Reorder Button */}
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => handleReorder(order)}
                          disabled={reorderingOrderId === order.id}
                          className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-[#814E1E] bg-[#FFF9F0] border border-[#D6AD61] rounded-lg hover:bg-[#D6AD61] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group">
                          {reorderingOrderId === order.id ? (
                            <>
                              <svg
                                className="animate-spin -ml-1 mr-2 h-4 w-4"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24">
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Toevoegen...
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                              Opnieuw bestellen
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg
                    className="w-16 h-16 text-gray-300 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nog geen bestellingen
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Ontdek onze luxe wasparfums en plaats je eerste bestelling!
                  </p>
                  <Link
                    href="/wasparfum"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#814E1E] hover:bg-[#D6AD61] transition-colors">
                    Bekijk wasparfums
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-[#814E1E] mb-4">
                Snelle acties
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                  href="/wasparfum"
                  className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-[#D6AD61] hover:bg-[#FFF9F0] transition-all group">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#D6AD61] rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z"
                      />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h4 className="font-medium text-[#814E1E]">
                      Nieuwe bestelling
                    </h4>
                    <p className="text-sm text-gray-600">
                      Ontdek onze wasparfums
                    </p>
                  </div>
                </Link>

                <Link
                  href="/account/orders"
                  className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-[#D6AD61] hover:bg-[#FFF9F0] transition-all group">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#814E1E] rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h4 className="font-medium text-[#814E1E]">
                      Bestelgeschiedenis
                    </h4>
                    <p className="text-sm text-gray-600">
                      Bekijk al je bestellingen
                    </p>
                  </div>
                </Link>

                {/* Loyalty Quick Action */}
                <Link
                  href="/account/loyalty"
                  className={`flex items-center p-4 border-2 rounded-lg transition-all group ${
                    user.loyalty && user.loyalty.points >= 60
                      ? "border-green-200 bg-green-50 hover:border-green-400 hover:bg-green-100"
                      : "border-gray-200 hover:border-[#D6AD61] hover:bg-[#FFF9F0]"
                  }`}>
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                      user.loyalty && user.loyalty.points >= 60
                        ? "bg-green-600"
                        : "bg-[#D6AD61]"
                    }`}>
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                      />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h4
                      className={`font-medium ${
                        user.loyalty && user.loyalty.points >= 60
                          ? "text-green-800"
                          : "text-[#814E1E]"
                      }`}>
                      {user.loyalty && user.loyalty.points >= 60
                        ? "Wissel punten in! 🎉"
                        : "Loyalty Rewards"}
                    </h4>
                    <p
                      className={`text-sm ${
                        user.loyalty && user.loyalty.points >= 60
                          ? "text-green-600"
                          : "text-gray-600"
                      }`}>
                      {user.loyalty && user.loyalty.points >= 60
                        ? `${Math.floor(user.loyalty.points / 60)}x beschikbaar`
                        : "Bekijk je punten"}
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
