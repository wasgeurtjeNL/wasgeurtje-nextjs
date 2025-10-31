"use client";

import { useState } from "react";
import Image from "next/image";
import CheckoutLoyaltyInfo from "@/components/CheckoutLoyaltyInfo";
import type { CartItem } from "@/context/CartContext";
import { FeatureFlags } from '@/utils/featureFlags';

type CountryCode = "NL" | "BE" | "DE" | (string & {});

export type AppliedDiscount = {
  code: string;
  amount: number;
  type: "fixed" | "percentage";
} | null;

export interface PreviousAddress {
  id: string;
  name: string;
  fullName: string;
  street: string;
  city: string;
  postalCode: string;
  country: CountryCode;
}

export interface CheckoutFormData {
  // Personal
  firstName: string;
  lastName: string;

  // Billing
  billingAddress: string;
  billingHouseNumber: string;
  billingHouseAddition: string;
  billingPostcode: string;
  billingCity: string;
  billingCountry: CountryCode;

  // Shipping
  useShippingAddress: boolean;
  shippingAddress: string;
  shippingHouseNumber: string;
  shippingHouseAddition: string;
  shippingPostcode: string;
  shippingCity: string;
  shippingCountry: CountryCode;

  // Selection
  selectedAddressId: string;
}

export interface AuthUserLite {
  email?: string;
  loyalty?: unknown;
}

export type CartItemWithVariant = CartItem & { variant?: string };

interface OrderSummaryProps {
  items: CartItemWithVariant[];
  subtotal: number;

  // Prices / totals
  appliedDiscount: AppliedDiscount;
  calculateShipping: () => number;
  calculateDiscount: () => number;
  calculateVolumeDiscount: () => number;
  calculateTotal: () => number;

  // Cart actions
  removeFromCart: (id: string, variant?: string) => void;
  updateQuantity: (
    id: string,
    variant: string | undefined,
    quantity: number
  ) => void;

  // Address display
  formData: CheckoutFormData;
  previousAddresses: PreviousAddress[];

  // Loyalty
  isLoggedIn: boolean;
  user?: AuthUserLite;
  onLoyaltyCouponSelect?: (couponCode: string) => Promise<void>;

  // Optional UI flags
  isApplyingDiscount?: boolean;
}

export default function OrderSummary({
  items,
  subtotal,
  appliedDiscount,
  calculateShipping,
  calculateDiscount,
  calculateVolumeDiscount,
  calculateTotal,
  removeFromCart,
  updateQuantity,
  formData,
  previousAddresses,
  isLoggedIn,
  user,
  onLoyaltyCouponSelect,
}: OrderSummaryProps) {
  const [isOrderSummaryOpen, setIsOrderSummaryOpen] = useState(false);
  
  if (!items?.length) return null;

  const countryLabel = (code?: CountryCode) => {
    switch (code) {
      case "NL":
        return "Nederland";
      case "BE":
        return "België";
      case "DE":
        return "Duitsland";
      default:
        return code || "";
    }
  };

  const renderAddress = () => {
    // Shipping selected & has data
    if (
      formData.useShippingAddress &&
      (formData.shippingAddress || formData.shippingPostcode)
    ) {
      return (
        <div>
          {(formData.firstName || formData.lastName) && (
            <p className="font-medium text-gray-900">
              {formData.firstName} {formData.lastName}
            </p>
          )}
          {formData.shippingAddress ? (
            <>
              <p>
                {`${formData.shippingAddress} ${formData.shippingHouseNumber}${
                  formData.shippingHouseAddition || ""
                }`.trim()}
              </p>
              <p>
                {formData.shippingPostcode} {formData.shippingCity}
              </p>
              <p>{countryLabel(formData.shippingCountry)}</p>
            </>
          ) : (
            <p className="text-gray-400 italic">
              Verzendadres nog niet ingevuld
            </p>
          )}
        </div>
      );
    }

    // Selected saved address
    const selectedAddress = previousAddresses.find(
      (addr) => addr.id === formData.selectedAddressId
    );

    if (selectedAddress) {
      return (
        <div>
          <p className="font-medium text-gray-900">
            {selectedAddress.fullName}
          </p>
          <p>
            {formData.billingAddress && formData.billingHouseNumber
              ? `${formData.billingAddress} ${formData.billingHouseNumber}${
                  formData.billingHouseAddition || ""
                }`.trim()
              : // Fallback: normalize possible duplicated housenumber artifacts
                selectedAddress.street.replace(/\s+(\d+)\s+\1(?:\s|$)/, " $1")}
          </p>
          <p>
            {selectedAddress.postalCode} {selectedAddress.city}
          </p>
          <p>{countryLabel(selectedAddress.country)}</p>
        </div>
      );
    }

    // Manual billing
    if (formData.billingAddress) {
      return (
        <div>
          {(formData.firstName || formData.lastName) && (
            <p className="font-medium text-gray-900">
              {formData.firstName} {formData.lastName}
            </p>
          )}
          <p>
            {`${formData.billingAddress} ${formData.billingHouseNumber}${
              formData.billingHouseAddition || ""
            }`.trim()}
          </p>
          <p>
            {formData.billingPostcode} {formData.billingCity}
          </p>
          <p>{countryLabel(formData.billingCountry)}</p>
        </div>
      );
    }

    return <p className="text-gray-400 italic">Nog geen adres geselecteerd</p>;
  };

  const ShippingRow = () => (
    <div className="flex flex-wrap justify-between text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <svg
          className="w-4 h-4 text-gray-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
          <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-.293-.707L15 4.586A1 1 0 0014.414 4H14v3z" />
        </svg>
        <span>Verzending</span>
      </div>
      <span>
        {calculateShipping() === 0
          ? "Gratis"
          : `€${calculateShipping().toFixed(2)}`}
      </span>
    </div>
  );

  const DiscountRow = () =>
    appliedDiscount ? (
      <div className="flex flex-wrap justify-between text-sm text-green-600">
        <div className="flex flex-wrap items-center gap-2">
          <svg
            className="w-4 h-4 text-green-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span>Korting ({appliedDiscount.code})</span>
        </div>
        <span>-€{calculateDiscount().toFixed(2)}</span>
      </div>
    ) : null;

  const VolumeRow = () =>
    FeatureFlags.ENABLE_VOLUME_DISCOUNT && subtotal >= 75 ? (
      <div className="flex flex-wrap justify-between text-sm text-purple-600">
        <span>Volume korting (10%)</span>
        <span>-€{calculateVolumeDiscount().toFixed(2)}</span>
      </div>
    ) : null;

  const ItemsList = () => (
    <div className="space-y-4 mb-6">
      {items.map((item) => (
        <div
          key={`${item.id}${item.variant ?? ""}`}
          className="border border-gray-200 rounded-lg p-3"
        >
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-shrink-0">
              <Image
                src={item.image}
                alt={item.title || "Product afbeelding"}
                width={60}
                height={60}
                className="object-cover rounded"
              />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap justify-between items-start mb-2">
                <div>
                  <h3 className="text-sm font-medium">{item.title}</h3>
                  {item.variant && (
                    <p className="text-xs text-gray-500">{item.variant}</p>
                  )}
                </div>
                <button
                  onClick={() => removeFromCart(item.id, item.variant)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  title="Product verwijderen"
                  aria-label="Product verwijderen"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Quantity */}
              <div className="flex flex-wrap items-center justify-between">
                <div className="flex flex-wrap items-center border border-gray-300 rounded">
                  <button
                    onClick={() =>
                      updateQuantity(
                        item.id,
                        item.variant,
                        Math.max(1, item.quantity - 1)
                      )
                    }
                    className="px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                    disabled={item.quantity <= 1}
                    aria-label="Minder"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 12H4"
                      />
                    </svg>
                  </button>
                  <span className="px-3 py-1 text-sm font-medium border-x border-gray-300 min-w-[40px] text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() =>
                      updateQuantity(item.id, item.variant, item.quantity + 1)
                    }
                    className="px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                    aria-label="Meer"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                </div>
                <div className="text-sm font-medium">
                  <span className="text-gray-500">
                    €{item.price.toFixed(2)} × {item.quantity} ={" "}
                  </span>
                  <span className="text-[#814e1e] font-semibold">
                    €{(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const TotalsBlock = ({ compact = false }: { compact?: boolean }) => (
    <div className={`border-t pt-4 space-y-2 ${compact ? "" : ""}`}>
      <div className="flex flex-wrap justify-between text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <svg
            className="w-4 h-4 text-gray-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
          <span>Subtotaal</span>
        </div>
        <span>€{subtotal.toFixed(2)}</span>
      </div>

      <ShippingRow />
      <DiscountRow />
      <VolumeRow />

      <div className="border-t pt-2 flex flex-wrap justify-between font-semibold">
        <div className="flex flex-wrap items-center gap-2">
          <svg
            className="w-4 h-4 text-[#814e1e]"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
          <span>Totaal</span>
        </div>
        <span>€{calculateTotal().toFixed(2)}</span>
      </div>
    </div>
  );

  const Loyalty = () =>
    isLoggedIn && user?.loyalty ? (
      <div className="mt-4">
        <CheckoutLoyaltyInfo
          orderTotal={subtotal}
          onCouponSelect={async (couponCode) => {
            if (onLoyaltyCouponSelect) {
              await onLoyaltyCouponSelect(couponCode);
            }
          }}
        />
      </div>
    ) : null;

  const TrustBadges = () => (
    <div className="mt-6 pt-6 border-t">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <svg
            className="w-5 h-5 text-green-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm text-gray-600">
            Veilig betalen met SSL-encryptie
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <svg
            className="w-5 h-5 text-green-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm text-gray-600">30 dagen bedenktijd</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <svg
            className="w-5 h-5 text-green-600"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M19.5 12.5l-1.5-3h-3v-2c0-1.1-.9-2-2-2h-9c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h.76c.55 1.19 1.74 2 3.24 2s2.69-.81 3.24-2h3.52c.55 1.19 1.74 2 3.24 2s2.69-.81 3.24-2h.76c.55 0 1-.45 1-1v-3.5c0-.83-.67-1.5-1.5-1.5zm-11.5 4c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm8 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm3-3h-3v-2.5h2.5l.5 1v1.5z" />
          </svg>
          <span className="text-sm text-gray-600">
            Gratis verzending vanaf €40
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="lg:col-span-1 block md:block">
      {/* Desktop */}
      <div
        id="order-summary"
        className="bg-white rounded-lg border border-gray-200 shadow-sm sticky top-4 block lg:hidden"
      >
        {/* Dropdown Header - Always Visible */}
        <button
          type="button"
          onClick={() => setIsOrderSummaryOpen(!isOrderSummaryOpen)}
          className="w-full flex items-center justify-between gap-3 p-4 hover:bg-gray-50 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-900">Orderoverzicht</h2>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-base font-bold text-[#814e1e]">
              €{calculateTotal().toFixed(2)}
            </span>
            <svg
              className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${
                isOrderSummaryOpen ? 'rotate-180' : ''
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

        {/* Collapsible Content */}
        {isOrderSummaryOpen && (
        <div className="px-4 pb-4 animate-in fade-in duration-200">
        <ItemsList />

        {(formData.billingAddress ||
          formData.selectedAddressId ||
          (formData.useShippingAddress && formData.shippingAddress)) && (
          <div className="border-t pt-4 mb-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <svg
                className="w-4 h-4 text-[#814e1e]"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                  clipRule="evenodd"
                />
              </svg>
              <h3 className="text-sm font-semibold text-gray-900">
                Bezorgadres
              </h3>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              {renderAddress()}
            </div>
          </div>
        )}

        <TotalsBlock />
        <Loyalty />
        <TrustBadges />
        </div>
        )}
      </div>

      {/* Mobile */}
      <div
        id="mobile-order-summary"
        className="bg-white rounded-lg p-6 shadow-sm lg:hidden hidden"
      >
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <svg
            className="w-5 h-5 text-[#814e1e]"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"
              clipRule="evenodd"
            />
          </svg>
          <h2 className="text-xl font-semibold">Orderoverzicht</h2>
        </div>

        <ItemsList />

        {(formData.billingAddress ||
          formData.selectedAddressId ||
          (formData.useShippingAddress && formData.shippingAddress)) && (
          <div className="border-t pt-4 mb-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <svg
                className="w-4 h-4 text-[#814e1e]"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                  clipRule="evenodd"
                />
              </svg>
              <h3 className="text-sm font-semibold text-gray-900">
                Bezorgadres
              </h3>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              {renderAddress()}
            </div>
          </div>
        )}

        <TotalsBlock compact />
        <Loyalty />
      </div>
    </div>
  );
}
