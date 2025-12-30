"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLoyality } from "@/context/LoyalityContext";

interface LoyaltyRedemptionProps {
  className?: string;
  onSuccess?: (couponCode: string, discountAmount: number) => void;
}

export default function LoyaltyRedemption({
  className = "",
  onSuccess,
}: LoyaltyRedemptionProps) {
  const { user, redeemPoints, isLoading, error } = useAuth();
  const { coupons } = useLoyality(); // 🌐 Get available coupons from global state
  const [eligibility, setEligibility] = useState({
    eligible: false,
    canRedeemTimes: 0,
    currentPoints: 0,
  });
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{
    success: boolean;
    coupon_code?: string;
    discount_amount?: number;
    message?: string;
    error?: string;
  } | null>(null);

  // ✅ Calculate eligibility locally (no API call needed - data is already in user.loyalty)
  useEffect(() => {
    if (user?.loyalty) {
      const currentPoints = user.loyalty.points;
      const hasUnusedCoupons = coupons.length > 0;
      
      // 🚫 Only allow redemption if:
      // 1. User has enough points (>= 60)
      // 2. AND user has no unused coupons (they should use existing ones first!)
      setEligibility({
        eligible: currentPoints >= 60 && !hasUnusedCoupons,
        canRedeemTimes: Math.floor(currentPoints / 60),
        currentPoints: currentPoints,
      });
    } else {
      setEligibility({
        eligible: false,
        canRedeemTimes: 0,
        currentPoints: 0,
      });
    }
  }, [user?.loyalty?.points, coupons.length]); // Re-run when points OR coupons change

  const handleRedeem = async () => {
    console.log("🎯 LoyaltyRedemption: handleRedeem CALLED");
    
    if (!eligibility.eligible || isRedeeming) {
      console.log("❌ Cannot redeem:", { eligible: eligibility.eligible, isRedeeming });
      return;
    }

    // ✅ Removed preventive coupon check - user can see existing coupons in the popup list
    // This eliminates an unnecessary API call

    setIsRedeeming(true);
    setRedeemResult(null);

    try {
      console.log("🔄 Calling redeemPoints()...");
      const result = await redeemPoints();
      console.log("✅ redeemPoints result:", result);
      setRedeemResult(result);

      if (result.success && result.coupon_code) {
        console.log("✅ Redemption successful! Coupon code:", result.coupon_code);
        
        // ✅ AUTO-APPLY: Call onSuccess callback to automatically apply the coupon
        if (onSuccess) {
          console.log("🎯 Calling onSuccess callback with:", {
            coupon_code: result.coupon_code,
            discount_amount: result.discount_amount || 13
          });
          onSuccess(result.coupon_code, result.discount_amount || 13);
          
          // 🎉 Show auto-apply success notification ONLY when used with callback (in checkout context)
          // Parent component (LoyaltyRedemptionPopup/CheckoutLoyaltyInfo) will show its own notification
        } else {
          // Show standalone notification when used without callback (e.g., on loyalty page)
          setTimeout(() => {
            const notification = document.createElement("div");
            notification.className = "fixed top-20 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 rounded-xl shadow-2xl z-[60] max-w-md";
            notification.style.animation = "slideDownBounce 0.5s ease-out";
            notification.innerHTML = `
              <div class="flex items-start gap-3">
                <div class="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                  <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p class="font-bold text-lg">🎉 Kortingscode aangemaakt!</p>
                  <p class="text-sm mt-1"><strong>${result.coupon_code}</strong> • €${result.discount_amount || 13} korting</p>
                  <p class="text-xs mt-2 opacity-90">✅ Gebruik deze code bij checkout</p>
                </div>
              </div>
            `;
            document.body.appendChild(notification);
            
            // Add animation
            if (!document.querySelector("#slideDownBounceAnimation")) {
              const style = document.createElement("style");
              style.id = "slideDownBounceAnimation";
              style.textContent = `
                @keyframes slideDownBounce {
                  0% { opacity: 0; transform: translate(-50%, -30px); }
                  60% { opacity: 1; transform: translate(-50%, 5px); }
                  80% { transform: translate(-50%, -2px); }
                  100% { transform: translate(-50%, 0); }
                }
              `;
              document.head.appendChild(style);
            }
            
            setTimeout(() => notification.remove(), 5000);
          }, 500);
        }
      }

      // ✅ Refresh eligibility locally (no API call needed)
      if (result.success && user?.loyalty) {
        const newPoints = result.remaining_points || user.loyalty.points - 60;
        setEligibility({
          eligible: newPoints >= 60,
          canRedeemTimes: Math.floor(newPoints / 60),
          currentPoints: newPoints,
        });
      }
    } catch (error) {
      console.error("Redemption error:", error);
      setRedeemResult({
        success: false,
        error: "Er is een fout opgetreden bij het inwisselen van punten",
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  const clearResult = () => {
    setRedeemResult(null);
  };

  if (!user) {
    return (
      <div className={`bg-gray-100 p-4 rounded-lg ${className}`}>
        <p className="text-gray-600">
          Log in om je loyaliteitspunten in te wisselen
        </p>
      </div>
    );
  }

  return (
    <div
      className={`bg-gradient-to-br from-amber-50 to-amber-100 p-4 sm:p-6 rounded-lg border border-amber-200 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-amber-900">
          Punten inwisselen
        </h3>
        <div className="text-xs sm:text-sm text-amber-700">
          {eligibility.currentPoints} punten beschikbaar
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-amber-700">60 punten =</span>
          <span className="font-semibold text-amber-900">€13 korting</span>
        </div>

        {eligibility.canRedeemTimes > 0 && !coupons.length && (
          <div className="text-xs text-amber-600">
            Je kunt {eligibility.canRedeemTimes}x inwisselen
          </div>
        )}
      </div>

      {/* Warning: Unused coupons */}
      {coupons.length > 0 && eligibility.currentPoints >= 60 && (
        <div className="mb-4 p-3 sm:p-4 rounded-lg bg-orange-50 border border-orange-300">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="text-xl sm:text-2xl flex-shrink-0">⚠️</div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-semibold text-orange-900 mb-1">
                Gebruik eerst je bestaande kortingscodes
              </div>
              <div className="text-xs sm:text-sm text-orange-800">
                Je hebt nog <strong>{coupons.length} ongebruikte kortingscode{coupons.length !== 1 ? 's' : ''}</strong> ter waarde van <strong>€{coupons.length * 13}</strong>. 
                Gebruik deze eerst voordat je nieuwe punten inwisselt om onnodige kortingscodes te voorkomen.
              </div>
              <div className="text-xs text-orange-700 mt-2">
                💡 Scroll naar beneden om je beschikbare kortingscodes te bekijken
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Redemption Result Display */}
      {redeemResult && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            redeemResult.success
              ? "bg-green-100 border border-green-300"
              : "bg-red-100 border border-red-300"
          }`}
        >
          {redeemResult.success ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-800 font-medium text-base">
                  🎉 Korting automatisch toegepast!
                </span>
                <button
                  onClick={clearResult}
                  className="text-green-600 hover:text-green-800 text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="text-sm text-green-700 mb-3">
                Je kortingscode is automatisch toegevoegd aan je winkelwagen. Je hoeft niets meer te doen! 
              </div>
              {redeemResult.coupon_code && (
                <div className="bg-white p-3 rounded border-2 border-dashed border-green-400">
                  <div className="text-sm text-green-700 mb-1">
                    Je kortingscode:
                  </div>
                  <div className="font-mono text-lg font-bold text-green-900 select-all">
                    {redeemResult.coupon_code}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    ✅ €{redeemResult.discount_amount} korting automatisch toegepast
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-red-800 font-medium">
                  ❌ Inwisseling mislukt
                </span>
                <button
                  onClick={clearResult}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="text-sm text-red-700">
                {redeemResult.error || "Er is een onbekende fout opgetreden"}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && !redeemResult && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Redemption Button */}
      <button
        onClick={handleRedeem}
        disabled={!eligibility.eligible || isRedeeming || isLoading}
        className={`w-full py-2.5 sm:py-3 px-4 rounded-lg text-sm sm:text-base font-medium transition-colors ${
          eligibility.eligible && !isRedeeming && !isLoading
            ? "bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
      >
        {isRedeeming || isLoading ? (
          <span className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-current"
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
            Inwisselen...
          </span>
        ) : eligibility.eligible ? (
          "Wissel 60 punten in voor €13 korting"
        ) : eligibility.currentPoints < 60 ? (
          `Je hebt ${60 - eligibility.currentPoints} punten meer nodig`
        ) : coupons.length > 0 ? (
          `Gebruik eerst je ${coupons.length} bestaande kortingscode${coupons.length !== 1 ? 's' : ''}`
        ) : (
          "Inwisselen niet mogelijk"
        )}
      </button>

      {/* Info Text */}
      <div className="mt-3 text-xs text-center">
        {eligibility.eligible ? (
          <span className="text-amber-600">
            ⚡ De korting wordt direct toegepast in je winkelwagen - geen handmatige invoer nodig!
          </span>
        ) : coupons.length > 0 ? (
          <span className="text-orange-600">
            💡 Je hebt nog {coupons.length} ongebruikte kortingscode{coupons.length !== 1 ? 's' : ''} van €{coupons.length * 13}. 
            Gebruik deze eerst voordat je nieuwe aanmaakt!
          </span>
        ) : eligibility.currentPoints < 60 ? (
          <span className="text-amber-600">
            Verzamel meer punten door bestellingen te plaatsen
          </span>
        ) : (
          <span className="text-gray-600">
            Verzamel meer punten door bestellingen te plaatsen
          </span>
        )}
      </div>
    </div>
  );
}
