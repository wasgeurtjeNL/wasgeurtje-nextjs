"use client";

import Link from "next/link";
import { Product } from '@/types/product';
import { useState } from 'react';

export default function ProductCard({ product }: { product: Product }) {
  const [imgSrc, setImgSrc] = useState(product.image);

  return (
    <Link href={`/wasparfum/${product.slug}`} className="group">
      <div className="bg-white border border-[#d6ad61] rounded-[4px] overflow-hidden">
        <div className="relative h-[200px] bg-white flex items-center justify-center p-4">
          <img
            src={imgSrc}
            alt={product.title}
            width={160}
            height={200}
            className="object-contain h-full w-auto transition-transform group-hover:scale-105"
            onError={() => setImgSrc('/figma/product-flower-rain.png')}
          />
        </div>
        <div className="p-4">
          <h2 className="text-center text-[#814e1e] text-base font-medium leading-[1.5] font-['Helvetica']">
            {product.title}
          </h2>
          <p className="mt-2 text-center font-bold text-[#212529]">
            {product.price}
          </p>
        </div>
      </div>
    </Link>
  );
}
