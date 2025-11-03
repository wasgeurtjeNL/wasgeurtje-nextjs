"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { trackSearch } from "@/hooks/useCustomerTracking";
import { useMediaQuery, deviceBreakpoints } from '@/hooks/useMediaQuery';

interface SearchResult {
  id: number;
  name: string;
  slug: string;
  price: string;
  image?: {
    src: string;
  };
  categories?: Array<{
    name: string;
  }>;
}

export default function SearchBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useMediaQuery(deviceBreakpoints.mobile);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

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

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery("");
    setResults([]);
  };

  return (
    <div className="relative" ref={searchRef}>
      {/* Search Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-white"
        aria-label="Search">
        <Image
          src="/figma/header/search-icon.svg"
          alt="Search"
          width={isMobile ? 26 : 22}
          height={isMobile ? 26 : 22}
          className={isMobile ? "w-[29px] h-[29px]" : "w-6 h-6"}
        />
      </button>

      {/* Search Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border-2 border-[#d7aa43]/20 z-50 overflow-hidden animate-slideDown">
          {/* Search Input */}
          <div className="p-4 bg-gradient-to-r from-[#d7aa43]/5 to-[#c29635]/5 border-b border-gray-200">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek naar producten..."
                className="w-full px-4 py-3 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent"
              />
              {isLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin h-5 w-5 border-2 border-[#d7aa43] border-t-transparent rounded-full" />
                </div>
              )}
            </div>
          </div>

          {/* Search Results */}
          <div className="max-h-96 overflow-y-auto">
            {searchQuery.length < 2 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                Typ minimaal 2 karakters om te zoeken...
              </div>
            ) : results.length === 0 && !isLoading ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                Geen resultaten gevonden voor "{searchQuery}"
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {results.map((product) => (
                  <Link
                    key={product.id}
                    href={`/wasparfum/${product.slug}`}
                    onClick={handleClose}
                    className="flex items-center gap-3 p-3 hover:bg-gradient-to-r hover:from-[#d7aa43]/10 hover:to-[#c29635]/5 transition-all duration-200 group">
                    {/* Product Image */}
                    <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                      {product.image?.src ? (
                        <Image
                          src={product.image.src}
                          alt={product.name}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 group-hover:text-[#814E1E] transition-colors truncate">
                        {product.name}
                      </h3>
                      {product.categories && product.categories.length > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {product.categories[0].name}
                        </p>
                      )}
                      <p className="text-sm font-semibold text-[#814E1E] mt-1">
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
              </div>
            )}
          </div>

          {/* Footer - View All Results */}
          {results.length > 0 && (
            <div className="p-3 bg-gray-50 border-t border-gray-200">
              <Link
                href={`/wasparfum?search=${encodeURIComponent(searchQuery)}`}
                onClick={handleClose}
                className="block text-center text-sm font-medium text-[#814E1E] hover:text-[#d7aa43] transition-colors">
                Bekijk alle resultaten voor "{searchQuery}" →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

