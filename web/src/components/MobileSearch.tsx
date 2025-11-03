"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { trackSearch } from "@/hooks/useCustomerTracking";

interface SearchResult {
  id: number;
  name: string;
  slug: string;
  price: string;
  images?: Array<{
    src: string;
    alt?: string;
  }>;
  categories?: Array<{
    name: string;
  }>;
}

interface MobileSearchProps {
  onClose: () => void;
}

export default function MobileSearch({ onClose }: MobileSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opening
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Search products
  useEffect(() => {
    const searchProducts = async () => {
      if (searchQuery.length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);

      try {
        // Track search event
        await trackSearch(searchQuery);

        // Search in WooCommerce products
        const response = await fetch(
          `/api/woocommerce/products?search=${encodeURIComponent(searchQuery)}&per_page=5`
        );

        if (response.ok) {
          const data = await response.json();
          setResults(data);
        }
      } catch (error) {
        console.error("[Search] Error searching products:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(searchProducts, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleLinkClick = () => {
    setSearchQuery("");
    setResults([]);
    onClose();
  };

  return (
    <div className="px-6 py-4">
      {/* Search Input */}
      <div className="relative mb-4">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Zoek naar producten..."
          className="w-full px-4 py-3 pr-10 text-sm bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent text-white placeholder-gray-300"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-5 w-5 border-2 border-[#d7aa43] border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {/* Search Results */}
      <div className="max-h-96 overflow-y-auto space-y-2">
        {searchQuery.length < 2 ? (
          <div className="py-8 text-center text-gray-300 text-sm">
            Typ minimaal 2 karakters om te zoeken...
          </div>
        ) : results.length === 0 && !isLoading ? (
          <div className="py-8 text-center text-gray-300 text-sm">
            Geen resultaten gevonden voor "{searchQuery}"
          </div>
        ) : (
          <>
            {results.map((product) => (
              <Link
                key={product.id}
                href={`/wasparfum/${product.slug}`}
                onClick={handleLinkClick}
                className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-white/5 to-white/[0.02] backdrop-blur-sm border border-white/10 hover:border-[#d7aa43]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#d7aa43]/20 flex items-center gap-3 p-3">
                {/* Product Image */}
                <div className="flex-shrink-0 w-12 h-12 bg-black/30 rounded-lg overflow-hidden border border-white/10">
                  {product.images?.[0]?.src ? (
                    <Image
                      src={product.images[0].src}
                      alt={product.images[0].alt || product.name}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white group-hover:text-[#e8b960] transition-colors truncate">
                    {product.name}
                  </h3>
                  {product.categories && product.categories.length > 0 && (
                    <p className="text-xs text-gray-300 mt-0.5">
                      {product.categories[0].name}
                    </p>
                  )}
                  <p className="text-sm font-semibold text-[#d7aa43] mt-1">
                    €{product.price}
                  </p>
                </div>

                {/* Arrow */}
                <svg
                  className="w-5 h-5 text-[#d7aa43]/50 group-hover:text-[#d7aa43] group-hover:translate-x-1 transition-all duration-300 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
            
            {/* View All Results */}
            {results.length > 0 && (
              <Link
                href={`/wasparfum?search=${encodeURIComponent(searchQuery)}`}
                onClick={handleLinkClick}
                className="block mt-4 text-center py-3 text-sm font-medium text-[#e8b960] hover:text-[#d7aa43] transition-colors rounded-lg border border-[#d7aa43]/30 hover:border-[#d7aa43]/50 bg-white/5">
                Bekijk alle resultaten voor "{searchQuery}" →
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

