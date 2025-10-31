"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

export default function OrdersPage() {
  const { user, orders, isLoggedIn, fetchOrders, sessionRestored } = useAuth();
  const { addToCart } = useCart();
  const router = useRouter();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (sessionRestored && !isLoggedIn) {
      router.push("/auth/login");
      return;
    }

    // Fetch fresh orders when page loads
    fetchOrders();
  }, [isLoggedIn, router, fetchOrders, sessionRestored]);

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

  const toggleOrderDetails = (orderId: string) => {
    setSelectedOrder(selectedOrder === orderId ? null : orderId);
  };

  return (
    <div className="min-h-screen bg-[#F8F6F0] py-6 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/account"
            className="flex items-center text-[#814E1E] hover:text-[#D6AD61] transition-colors mb-4"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span>Terug naar mijn account</span>
          </Link>
          <h1 className="text-3xl font-bold text-[#814E1E] mb-2">
            Mijn bestellingen
          </h1>
          <p className="text-gray-600">
            Bekijk de status en details van al je bestellingen
          </p>
        </div>

        {/* Orders List */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {orders.length > 0 ? (
            <div className="space-y-6">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-[#D6AD61] transition-colors"
                >
                  {/* Order Header */}
                  <button
                    className="w-full"
                    onClick={() => toggleOrderDetails(order.id)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-lg text-[#814E1E]">
                          Bestelling {order.orderNumber}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {new Date(order.date).toLocaleDateString("nl-NL")}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                            order.status
                          )}`}
                        >
                          {getStatusText(order.status)}
                        </span>
                        <p className="text-sm font-bold text-[#814E1E] mt-1">
                          €{order.total.toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {order.items.slice(0, 4).map((item, index) => (
                          <div
                            key={`${order.id}-${item.id}-${index}`}
                            className="flex items-center space-x-2"
                          >
                            <Image
                              src={item.image}
                              alt={item.name}
                              width={32}
                              height={32}
                              className="w-8 h-8 object-contain bg-[#F8F6F0] rounded"
                            />
                            <span className="text-xs text-gray-600 hidden sm:inline">
                              {item.quantity}x
                            </span>
                          </div>
                        ))}
                        {order.items.length > 4 && (
                          <span className="text-xs text-gray-500">
                            +{order.items.length - 4} meer
                          </span>
                        )}
                      </div>
                      
                      <svg
                        className={`w-5 h-5 text-[#814E1E] transition-transform ${
                          selectedOrder === order.id ? 'rotate-180' : ''
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
                  
                  {/* Quick Reorder Button (Collapsed State) */}
                  {selectedOrder !== order.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorder(order);
                        }}
                        disabled={reorderingOrderId === order.id}
                        className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-[#814E1E] bg-[#FFF9F0] border border-[#D6AD61] rounded-lg hover:bg-[#D6AD61] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {reorderingOrderId === order.id ? (
                          <>
                            <svg
                              className="animate-spin -ml-1 mr-2 h-4 w-4"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Toevoegen...
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-4 h-4 mr-2"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
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
                  )}

                  {/* Order Details (Expanded) */}
                  {selectedOrder === order.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="font-medium text-[#814E1E] mb-3">
                        Bestelgegevens
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-1">
                            Bezorgadres
                          </h5>
                          <p className="text-sm text-gray-600">
                            {order.shippingAddress.name}
                            <br />
                            {order.shippingAddress.street}
                            <br />
                            {order.shippingAddress.postalCode}{" "}
                            {order.shippingAddress.city}
                            <br />
                            {order.shippingAddress.country}
                          </p>
                        </div>
                        {order.trackingCode && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-1">
                              Track & Trace
                            </h5>
                            <p className="text-sm bg-gray-100 px-3 py-2 rounded font-mono">
                              {order.trackingCode}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Products Table */}
                      <h4 className="font-medium text-[#814E1E] mt-6 mb-3">
                        Producten
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 text-gray-700">
                            <tr>
                              <th className="px-4 py-2">Product</th>
                              <th className="px-4 py-2 text-center">Aantal</th>
                              <th className="px-4 py-2 text-right">Prijs</th>
                              <th className="px-4 py-2 text-right">Totaal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item, index) => (
                              <tr
                                key={`${order.id}-${item.id}-${index}`}
                                className="border-b"
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center space-x-3">
                                    <Image
                                      src={item.image}
                                      alt={item.name}
                                      width={40}
                                      height={40}
                                      className="w-10 h-10 object-contain bg-[#F8F6F0] rounded"
                                    />
                                    <span className="font-medium text-gray-700">
                                      {item.name}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center text-gray-700">
                                  {item.quantity}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700">
                                  €{item.price.toFixed(2).replace(".", ",")}
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-gray-700">
                                  €
                                  {(item.price * item.quantity)
                                    .toFixed(2)
                                    .replace(".", ",")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50">
                            <tr>
                              <td
                                colSpan={3}
                                className="px-4 py-2 text-right font-medium text-gray-700"
                              >
                                Subtotaal
                              </td>
                              <td className="px-4 py-2 text-right font-medium text-gray-700">
                                €
                                {order.items
                                  .reduce(
                                    (sum, item) =>
                                      sum + item.price * item.quantity,
                                    0
                                  )
                                  .toFixed(2)
                                  .replace(".", ",")}
                              </td>
                            </tr>
                            <tr>
                              <td
                                colSpan={3}
                                className="px-4 py-2 text-right font-medium text-gray-700"
                              >
                                Verzendkosten
                              </td>
                              <td className="px-4 py-2 text-right font-medium text-gray-700">
                                €
                                {(
                                  order.total -
                                  order.items.reduce(
                                    (sum, item) =>
                                      sum + item.price * item.quantity,
                                    0
                                  )
                                )
                                  .toFixed(2)
                                  .replace(".", ",")}
                              </td>
                            </tr>
                            <tr>
                              <td
                                colSpan={3}
                                className="px-4 py-2 text-right font-medium text-lg text-gray-700"
                              >
                                Totaal
                              </td>
                              <td className="px-4 py-2 text-right font-bold text-[#814E1E] text-lg text-gray-700">
                                €{order.total.toFixed(2).replace(".", ",")}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Order Actions */}
                      <div className="mt-6 flex flex-wrap gap-3">
                        <button
                          onClick={() => handleReorder(order)}
                          disabled={reorderingOrderId === order.id}
                          className="px-4 py-2 text-sm font-medium border border-[#814E1E] text-[#814E1E] rounded-md hover:bg-[#FFF9F0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                          {reorderingOrderId === order.id ? (
                            <>
                              <svg
                                className="animate-spin -ml-1 mr-2 h-4 w-4"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              Toevoegen...
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
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
                        {order.trackingCode &&
                          order.status !== "delivered" &&
                          order.status !== "cancelled" && (
                            <a
                              href={`https://www.postnl.nl/tracktrace/?lang=nl&B=${order.trackingCode}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 text-sm font-medium bg-[#D6AD61] text-white rounded-md hover:bg-[#814E1E] transition-colors"
                            >
                              Volg pakket
                            </a>
                          )}
                        <button className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                          Contact klantenservice
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
              <p className="text-gray-600 mb-6">
                Ontdek onze luxe wasparfums en plaats je eerste bestelling!
              </p>
              <Link
                href="/wasparfum"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#814E1E] hover:bg-[#D6AD61] transition-colors"
              >
                Bekijk wasparfums
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
