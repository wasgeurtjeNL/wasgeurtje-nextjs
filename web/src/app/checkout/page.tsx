"use client";

import { useEffect, useState } from "react";
import CheckoutWrapper from "./CheckoutWrapper";

export default function CheckoutPage() {
  const [mounted, setMounted] = useState(false);

  // Only render on client-side to prevent hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#814E1E] mb-4"></div>
          <p className="text-gray-600">Checkout laden...</p>
        </div>
      </div>
    );
  }

  return <CheckoutWrapper />;
}

