"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";

// Lazy load zware components
const LoyaltyRedemption = dynamic(() => import("@/components/LoyaltyRedemption"), {
  loading: () => <SkeletonLoader />,
  ssr: false,
});

const LoyaltyCoupons = dynamic(() => import("@/components/LoyaltyCoupons"), {
  loading: () => <SkeletonLoader />,
  ssr: false,
});

function SkeletonLoader() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded w-4/6"></div>
      </div>
    </div>
  );
}

export default function LoyaltyPage() {
  const { user, isLoggedIn, fetchLoyaltyPoints, sessionRestored } = useAuth();
  const router = useRouter();
  const [isLoadingPoints, setIsLoadingPoints] = useState(true);

  useEffect(() => {
    // Redirect if not logged in
    if (sessionRestored && !isLoggedIn) {
      router.push("/auth/login");
      return;
    }

    // Fetch loyalty points progressively
    if (isLoggedIn && user) {
      const fetchData = async () => {
        setIsLoadingPoints(true);
        await fetchLoyaltyPoints();
        setIsLoadingPoints(false);
      };
      
      // Small delay to let page render first
      setTimeout(() => {
        fetchData();
      }, 100);
    }
  }, [isLoggedIn, sessionRestored, user?.email]);

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

  return (
    <div className="min-h-screen bg-[#F8F6F0] py-6 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Back Button */}
        <div className="mb-8">
          <Link
            href="/account"
            className="inline-flex items-center text-sm text-[#814E1E] hover:text-[#D6AD61] mb-4 transition-colors">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Terug naar account
          </Link>
          <h1 className="text-3xl font-bold text-[#814E1E] mb-2">
            Jouw Loyalty Programma 🎁
          </h1>
          <p className="text-gray-600">
            Verdien punten bij elke aankoop en wissel ze in voor kortingen.
          </p>
        </div>

        <div className="space-y-6">
          {/* Loyalty Card - Always visible */}
          {user.loyalty ? (
            <div className="bg-gradient-to-r from-[#D6AD61] to-[#814E1E] rounded-xl shadow-lg p-8 text-white">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-sm uppercase tracking-wider opacity-80">
                    Wasgeurtje Rewards
                  </span>
                  <h2 className="text-4xl font-bold mt-2">
                    {isLoadingPoints ? (
                      <span className="inline-block animate-pulse">...</span>
                    ) : (
                      user.loyalty.points
                    )}
                  </h2>
                  <p className="text-sm opacity-80 mt-1">punten beschikbaar</p>
                </div>
                <div className="text-right">
                  <div className="text-sm opacity-80">Totaal verdiend</div>
                  <div className="text-2xl font-semibold mt-1">
                    {isLoadingPoints ? (
                      <span className="inline-block animate-pulse">...</span>
                    ) : (
                      user.loyalty.totalEarned
                    )}
                  </div>
                </div>
              </div>

              {/* Referral Code */}
              {user.loyalty.referCode && (
                <div className="mt-4 pt-4 border-t border-white border-opacity-20">
                  <div className="flex justify-between items-center">
                    <span className="text-sm opacity-80">
                      Jouw referral code
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-mono font-bold">
                        {user.loyalty.referCode}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            user.loyalty?.referCode || ""
                          );
                          alert("Code gekopieerd!");
                        }}
                        className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Progress to next reward */}
              {user.loyalty.points < 60 && (
                <div className="mt-4 pt-4 border-t border-white border-opacity-20">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="opacity-80">Tot volgende beloning</span>
                    <span className="font-semibold">
                      {60 - user.loyalty.points} punten te gaan
                    </span>
                  </div>
                  <div className="w-full bg-white bg-opacity-20 rounded-full h-2">
                    <div
                      className="bg-white h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${(user.loyalty.points / 60) * 100}%`,
                      }}></div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <SkeletonLoader />
          )}

          {/* Info Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-[#814E1E] mb-4">
              Hoe werkt het?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-10 h-10 bg-[#D6AD61] bg-opacity-20 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🛍️</span>
                </div>
                <div>
                  <h4 className="font-medium text-[#814E1E] mb-1">
                    1. Shop & Verdien
                  </h4>
                  <p className="text-sm text-gray-600">
                    Verdien punten bij elke aankoop in onze webshop
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-10 h-10 bg-[#D6AD61] bg-opacity-20 rounded-lg flex items-center justify-center">
                  <span className="text-xl">⭐</span>
                </div>
                <div>
                  <h4 className="font-medium text-[#814E1E] mb-1">
                    2. Verzamel Punten
                  </h4>
                  <p className="text-sm text-gray-600">
                    60 punten = €1 korting op je volgende bestelling
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-10 h-10 bg-[#D6AD61] bg-opacity-20 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🎁</span>
                </div>
                <div>
                  <h4 className="font-medium text-[#814E1E] mb-1">
                    3. Wissel In
                  </h4>
                  <p className="text-sm text-gray-600">
                    Wissel punten in voor kortingscodes hieronder
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Loyalty Redemption Section - Lazy loaded */}
          {!isLoadingPoints && user.loyalty && user.loyalty.points >= 60 && (
            <div className="loyalty-redemption-section">
              <LoyaltyRedemption
                onSuccess={(couponCode, discountAmount) => {
                  alert(
                    `🎉 Succesvol ingewisseld!\n\nJouw kortingscode: ${couponCode}\nKorting: €${discountAmount}\n\nGebruik deze code bij checkout!`
                  );
                  // Refresh loyalty points
                  fetchLoyaltyPoints();
                }}
              />
            </div>
          )}

          {/* Not enough points message */}
          {!isLoadingPoints && user.loyalty && user.loyalty.points < 60 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-start space-x-3">
                <svg
                  className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h4 className="font-semibold text-blue-900 mb-1">
                    Bijna genoeg punten! 🎯
                  </h4>
                  <p className="text-sm text-blue-800">
                    Je hebt nog {60 - user.loyalty.points} punten nodig om in
                    te wisselen voor €1 korting. Plaats een bestelling om meer
                    punten te verdienen!
                  </p>
                  <Link
                    href="/wasparfum"
                    className="inline-block mt-3 px-4 py-2 bg-[#814E1E] text-white text-sm font-medium rounded-lg hover:bg-[#D6AD61] transition-colors">
                    Shop wasparfums
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Loyalty Coupons Section - Lazy loaded */}
          {!isLoadingPoints && (
            <LoyaltyCoupons
              onCouponCopied={(couponCode) => {
                console.log(`Coupon ${couponCode} copied to clipboard`);
              }}
            />
          )}

          {/* Back to Dashboard */}
          <div className="text-center pt-4">
            <Link
              href="/account"
              className="inline-flex items-center text-sm text-gray-600 hover:text-[#814E1E] transition-colors">
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Terug naar dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

