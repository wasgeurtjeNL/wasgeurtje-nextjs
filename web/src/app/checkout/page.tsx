"use client";

import dynamic from "next/dynamic";

// Load CheckoutWrapper with SSR disabled to prevent hydration errors
// This is necessary because the wrapper depends on client-side WordPress options
const CheckoutWrapper = dynamic(() => import("./CheckoutWrapper"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#814E1E] mb-4"></div>
        <p className="text-gray-600">Checkout laden...</p>
      </div>
    </div>
  ),
});

export default function CheckoutPage() {
  return <CheckoutWrapper />;
}

