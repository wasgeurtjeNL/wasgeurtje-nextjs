"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useCart, CartItem } from "@/context/CartContext";
import { Product } from '@/types/product';

type BundleKey = "single" | "duo" | "trio";

function parsePrice(
  input: string | number | null | undefined,
  fallback = 14.95
) {
  if (typeof input === "number") return input;
  if (!input) return fallback;
  // handles "€12,95" or "12.95"
  const normalized = String(input)
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const val = parseFloat(normalized);
  return Number.isFinite(val) ? val : fallback;
}

export default function StickyCartBar({ product }: { product: Product }) {
  const { addToCart, isOpen: cartIsOpen } = useCart();
  const [showStickyCart, setShowStickyCart] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<BundleKey | null>(null);

  const basePrice = useMemo(
    () => parsePrice(product?.price, 14.95),
    [product?.price]
  );

  const bundles = useMemo(() => {
    const duoPrice = basePrice * 2 - 1; // €1 korting
    const trioPrice = basePrice * 3 * 0.89; // 11% korting
    return {
      single: {
        name: "Single",
        price: basePrice,
        originalPrice: basePrice,
        savings: 0,
        quantity: 1,
        perItem: basePrice,
      },
      duo: {
        name: "Duo",
        price: duoPrice,
        originalPrice: basePrice * 2,
        savings: 1.0,
        quantity: 2,
        perItem: duoPrice / 2,
      },
      trio: {
        name: "Trio",
        price: trioPrice,
        originalPrice: basePrice * 3,
        savings: basePrice * 3 * 0.11,
        quantity: 3,
        perItem: trioPrice / 3,
      },
    } as const;
  }, [basePrice]);

  const getCurrentPrice = () =>
    selectedBundle ? bundles[selectedBundle].price : basePrice;

  useEffect(() => {
    const handleScroll = () => setShowStickyCart(window.scrollY > 800);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleAddToCart = () => {
    if (!selectedBundle) {
      addToCart({
        id: product.id,
        title: product.title,
        price: basePrice,
        image: product.image,
        quantity: 1,
      } as CartItem);
      return;
    }
    const b = bundles[selectedBundle];
    addToCart({
      id: product.id,
      title: product.title,
      price: b.perItem,
      image: product.image,
      quantity: b.quantity,
    } as CartItem);
  };

  if (cartIsOpen || !showStickyCart) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t z-[9999] py-3 px-4"
      style={{ borderColor: "#D6AD61" }}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* tiny bundle selector (optional). Remove if you don’t want controls here */}
        {/* <div className="hidden md:flex items-center gap-2">
          {(["single", "duo", "trio"] as BundleKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSelectedBundle(k)}
              className={`text-xs px-3 py-1 rounded-full border transition ${
                selectedBundle === k ? "border-[#814E1E]" : "border-gray-300"
              }`}
              style={{ color: "#814E1E" }}>
              {bundles[k].name}
            </button>
          ))}
        </div> */}

        <div className="flex items-center space-x-3">
          <Image
            src={product.image}
            alt={product.title}
            width={50}
            height={50}
            className="rounded"
          />
          <div>
            <h3 className="font-medium text-sm text-[#814E1E]">
              {product.title}
            </h3>
            <p className="text-lg font-bold text-[#814E1E]">
              €{getCurrentPrice().toFixed(2).replace(".", ",")}
            </p>
          </div>
        </div>

        <button
          onClick={handleAddToCart}
          className="text-black px-6 py-2 rounded-full font-medium hover:opacity-90 transition-opacity sticky-cart-button"
          style={{
            background: "linear-gradient(90deg, #D6AD61 0%, #FCCE4E 100%)",
          }}>
          NU BESTELLEN
        </button>
      </div>
    </div>
  );
}
