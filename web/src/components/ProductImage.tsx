"use client";

import { useState } from 'react';

interface ProductImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}

export default function ProductImage({ 
  src, 
  alt, 
  width = 160, 
  height = 200, 
  className = "" 
}: ProductImageProps) {
  const [imgSrc, setImgSrc] = useState(src);

  return (
    <img
      src={imgSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => setImgSrc('/figma/product-flower-rain.png')}
      loading="lazy"
    />
  );
}

