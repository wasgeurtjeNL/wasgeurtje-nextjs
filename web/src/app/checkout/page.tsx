"use client";

import CheckoutWrapper from "./CheckoutWrapper";
import { useEffect } from "react";

export default function CheckoutPage() {
  useEffect(() => {
    console.log("🎯 [CheckoutPage] DEDICATED checkout/page.tsx is rendering!");
    console.log("🎯 [CheckoutPage] URL:", window.location.href);
    console.log("🎯 [CheckoutPage] This should show the real checkout, not WordPress page");
  }, []);
  
  return (
    <div>
      <div style={{ position: 'absolute', top: 0, left: 0, background: 'red', color: 'white', padding: '4px', zIndex: 9999, fontSize: '10px' }}>
        DEBUG: checkout/page.tsx loaded
      </div>
      <CheckoutWrapper />
    </div>
  );
}

