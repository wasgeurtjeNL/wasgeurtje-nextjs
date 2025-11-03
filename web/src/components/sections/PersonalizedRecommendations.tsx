"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/context/CartContext";
import { getDaySpecificGreeting } from '@/utils/greeting';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  categories: string[];
}

export default function PersonalizedRecommendations() {
  const { user, isLoggedIn, orders } = useAuth();
  const { addToCart } = useCart();
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  useEffect(() => {
    if (isLoggedIn && user) {
      fetchPersonalizedProducts();
    } else {
      setIsLoading(false);
    }
  }, [isLoggedIn, user, orders]);

  const fetchPersonalizedProducts = async () => {
    setIsLoading(true);
    try {
      // Fetch all products
      const response = await fetch("/api/woocommerce/products");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to fetch products:", errorData);
        throw new Error(errorData.message || "Failed to fetch products");
      }
      
      const allProducts = await response.json();
      
      // Ensure we have valid products
      if (!Array.isArray(allProducts) || allProducts.length === 0) {
        console.warn("No products returned from API");
        setRecommendations([]);
        return;
      }
      
      // Product IDs to exclude from recommendations (including cap products that should never be shown)
      const excludedProductIds = new Set(["334999", "1893", "348218", "348219"]);
      
      // Filter out excluded products and out of stock products
      const filteredProducts = allProducts.filter((p: any) => 
        !excludedProductIds.has(p.id.toString()) && p.stock_status !== 'outofstock'
      );
      
      // Get product IDs from user's orders
      const previousProductIds = new Set(
        orders.flatMap((order) => order.items.map((item) => item.id))
      );

      // Filter products: show previously ordered products first (excluding blacklisted ones)
      const previouslyOrdered = filteredProducts.filter((p: any) =>
        previousProductIds.has(p.id.toString())
      );

      // Get popular products (by rating or meta) as fallback
      const popular = filteredProducts
        .filter((p: any) => !previousProductIds.has(p.id.toString()))
        .sort((a: any, b: any) => {
          const aRating = parseFloat(a.average_rating || "0");
          const bRating = parseFloat(b.average_rating || "0");
          return bRating - aRating;
        })
        .slice(0, 3);

      // Combine: show previously ordered first, then popular
      const combined = [...previouslyOrdered, ...popular].slice(0, 4);

      const transformed = combined.map((p: any) => ({
        id: p.id.toString(),
        name: p.name || p.title,
        slug: p.slug,
        price: parseFloat(p.price),
        image: p.images?.[0]?.src || p.image || "/figma/products/Wasgeurtje_Blossom_Drip.png",
        categories: p.categories?.map((c: any) => c.name) || [],
      }));

      setRecommendations(transformed);
    } catch (error) {
      console.error("Error fetching personalized products:", error);
      // Gracefully handle error - section will be hidden
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAdd = async (product: Product) => {
    setAddingToCart(product.id);
    try {
      await addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.image,
      });
      
      // Show success feedback
      setTimeout(() => {
        setAddingToCart(null);
      }, 1000);
    } catch (error) {
      console.error("Error adding to cart:", error);
      setAddingToCart(null);
    }
  };

  // Don't show section if user is not logged in or no recommendations
  if (!isLoggedIn || !user || recommendations.length === 0) {
    return null;
  }

  const hasOrderedBefore = orders && orders.length > 0;
  
  // Only show this section if user has ordered before
  if (!hasOrderedBefore) {
    return null;
  }
  const dayGreeting = getDaySpecificGreeting();
  const isWeekend = dayGreeting !== null;

  return (
    <section className="py-8 md:py-16 px-4 md:px-6 bg-gradient-to-b from-white to-[#FFFAF0]">
      <div className="max-w-7xl mx-auto">
        {/* Header with personalization */}
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 bg-[#D6AD61]/10 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-3 md:mb-4">
            <span className="text-xl md:text-2xl">{isWeekend ? '🎉' : '✨'}</span>
            <span className="text-xs md:text-sm font-semibold text-[#B8860B]">
              {isWeekend ? dayGreeting : "Speciaal voor jou geselecteerd"}
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-[var(--font-eb-garamond)] font-bold text-[#1a1a1a] mb-2 md:mb-3 px-4">
            {user.firstName || user.displayName}, bestel je favorieten opnieuw
          </h2>
          <p className="text-sm md:text-base text-gray-600 max-w-2xl mx-auto px-4">
            Snel en gemakkelijk je geliefde geuren herbestellen
          </p>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-3 md:p-6 shadow-sm animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-xl mb-4" />
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            {recommendations.map((product, index) => (
              <div
                key={product.id}
                className="group relative bg-white rounded-xl md:rounded-2xl p-3 md:p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-[#D6AD61]/30 animate-fadeIn"
                style={{ animationDelay: `${index * 100}ms` }}>
                {/* Badge for previously ordered */}
                {hasOrderedBefore && index === 0 && (
                  <div className="absolute -top-2 md:-top-3 left-1/2 -translate-x-1/2 bg-[#B8860B] text-white text-[10px] md:text-xs font-semibold px-2 md:px-3 py-0.5 md:py-1 rounded-full z-10">
                    Je favoriet
                  </div>
                )}

                {/* Product Image */}
                <Link href={`/products/${product.slug}`} className="block">
                  <div className="relative aspect-square mb-2 md:mb-4 overflow-hidden rounded-lg md:rounded-xl bg-gray-50">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                </Link>

                {/* Product Info */}
                <Link href={`/products/${product.slug}`}>
                  <h3 className="font-semibold text-[#1a1a1a] text-xs md:text-base mb-1 md:mb-2 group-hover:text-[#B8860B] transition-colors line-clamp-2">
                    {product.name}
                  </h3>
                </Link>
                
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-0 md:mt-4">
                  <span className="text-sm md:text-lg font-bold text-[#1a1a1a]">
                    €{product.price.toFixed(2)}
                  </span>
                  
                  {/* Quick Add Button */}
                  <button
                    onClick={() => handleQuickAdd(product)}
                    disabled={addingToCart === product.id}
                    className={`
                      flex items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-md md:rounded-lg font-medium text-xs md:text-sm w-full md:w-auto
                      transition-all duration-200
                      ${
                        addingToCart === product.id
                          ? "bg-green-500 text-white"
                          : "bg-black text-white hover:bg-[#1a1a1a]"
                      }
                    `}>
                    {addingToCart === product.id ? (
                      <>
                        <span>✓</span>
                        <span className="hidden md:inline">Toegevoegd</span>
                        <span className="md:hidden">✓</span>
                      </>
                    ) : (
                      <>
                        <span>+</span>
                        <span>Bestel</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA to shop */}
        <div className="text-center mt-8 md:mt-12">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 bg-black text-white px-6 md:px-8 py-2.5 md:py-3 rounded-lg font-medium text-sm md:text-base hover:bg-[#1a1a1a] transition-colors">
            <span>Bekijk alle producten</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

