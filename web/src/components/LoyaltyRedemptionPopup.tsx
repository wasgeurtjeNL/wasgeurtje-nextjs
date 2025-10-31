"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLoyality } from "@/context/LoyalityContext";
import LoyaltyRedemption from "./LoyaltyRedemption";

interface LoyaltyRedemptionPopupProps {
  onCouponSelect?: (code: string) => void;
}

export default function LoyaltyRedemptionPopup({
  onCouponSelect,
}: LoyaltyRedemptionPopupProps) {
  const { user } = useAuth();
  const { showRedemptionPopup, closeRedemptionPopup, coupons, fetchCoupons } =
    useLoyality();

  // Fetch coupons when popup opens
  useEffect(() => {
    if (showRedemptionPopup && user?.email) {
      fetchCoupons(user.email, false); // Don't force refresh, use cache if available
    }
  }, [showRedemptionPopup, user?.email, fetchCoupons]);

  if (!showRedemptionPopup || !user?.loyalty) {
    return null;
  }

  const handleCouponSelect = (code: string, discountAmount: number) => {
    if (onCouponSelect) {
      onCouponSelect(code);

      setTimeout(() => {
        closeRedemptionPopup();

        const successMessage = document.createElement("div");
        successMessage.className =
          "fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50";
        successMessage.style.animation = "fadeIn 0.3s ease-out";
        successMessage.innerHTML = `
          <div class="flex items-center space-x-2">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>✨ Kortingscode ${code} is toegepast! Je bespaart €${discountAmount}</span>
          </div>
        `;
        document.body.appendChild(successMessage);

        const style = document.createElement("style");
        style.textContent = `
          @keyframes fadeIn {
            from { opacity: 0; transform: translate(-50%, -10px); }
            to { opacity: 1; transform: translate(-50%, 0); }
          }
        `;
        document.head.appendChild(style);

        setTimeout(() => {
          successMessage.remove();
          style.remove();
        }, 4000);
      }, 500);
    }

    // Refresh coupons (force refresh to get latest data)
    fetchCoupons(user.email!, true);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm sm:max-w-md lg:max-w-2xl relative my-20 sm:my-24 max-h-[calc(100vh-10rem)] sm:max-h-[calc(100vh-12rem)] overflow-y-auto">
        {/* Popup Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              Loyalty Punten Verzilveren
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Je hebt {user.loyalty.points} punten • 60 punten = €13 korting
            </p>
          </div>
          <button
            onClick={closeRedemptionPopup}
            className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Popup Content */}
        <div className="p-4 sm:p-6">
          <LoyaltyRedemption
            onSuccess={(couponCode, discountAmount) => {
              handleCouponSelect(couponCode, discountAmount);
            }}
          />

          {/* Existing Coupons Display */}
          {coupons.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Beschikbare kortingscodes
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {coupons.map((coupon) => (
                  <div
                    key={coupon.id}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-mono font-medium text-gray-900">
                          {coupon.code}
                        </div>
                        <div className="text-sm text-gray-600">
                          €{coupon.discount_amount} korting
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleCouponSelect(
                            coupon.code,
                            coupon.discount_amount
                          );
                        }}
                        className="px-3 py-1 bg-[#814E1E] text-white text-sm rounded hover:bg-[#D6AD61] transition-colors">
                        Toepassen
                      </button>
                    </div>
                    {coupon.days_until_expiry !== null && (
                      <div className="text-xs text-gray-500 mt-1">
                        {coupon.days_until_expiry <= 3
                          ? `Verloopt over ${coupon.days_until_expiry} dag${
                              coupon.days_until_expiry !== 1 ? "en" : ""
                            }`
                          : `Geldig ${coupon.days_until_expiry} dagen`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


