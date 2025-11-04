// WordPress REST API Client voor Wasgeurtje.nl
const WORDPRESS_BASE_URL = "https://wasgeurtje.nl";
const API_BASE = `${WORDPRESS_BASE_URL}/wp-json`;

// WooCommerce API credentials
const WC_CONSUMER_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY!;
const WC_CONSUMER_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET!;

// API Endpoints
export const endpoints = {
  pages: `${API_BASE}/wp/v2/pages`,
  products: `${API_BASE}/wc/v3/products`,
  media: `${API_BASE}/wp/v2/media`,
  acf: `${API_BASE}/acf/v3`,
};

// Fetch wrapper met error handling and retry logic
async function apiRequest(
  url: string,
  options: RequestInit = {},
  useWooCommerceAuth: boolean = false,
  retries: number = 3
) {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const headers: Record<string, string> = {
        ...((options.headers as Record<string, string>) || {}),
      };

      // Only add Content-Type for POST/PUT/PATCH requests
      const method = (options.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        headers["Content-Type"] = "application/json";
      }

      // Add WooCommerce authentication if needed
      if (useWooCommerceAuth) {
        const auth = Buffer.from(
          `${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`
        ).toString("base64");
        headers["Authorization"] = `Basic ${auth}`;
      }

      const response = await fetch(url, {
        ...options,
        headers,
        next: { revalidate: 3600 }, // Cache for 1 hour
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error Response (attempt ${attempt + 1}): ${errorText}`);
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      lastError = error as Error;
      console.error(`WordPress API Error (attempt ${attempt + 1}/${retries}):`, error);
      
      // If this is not the last attempt, wait before retrying
      if (attempt < retries - 1) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
        console.log(`Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // All retries failed
  throw lastError || new Error('All retry attempts failed');
}

// export const wooApi = new WooCommerceRestApi({
//   url: process.env.WC_URL!,
//   consumerKey: process.env.WC_CONSUMER_KEY!,
//   consumerSecret: process.env.WC_CONSUMER_SECRET!,
//   version: "wc/v3",
// });

// Fetch page by ID met ACF velden
export async function getPageById(pageId: number): Promise<any> {
  const url = `${endpoints.pages}/${pageId}?acf_format=standard&_embed=true`;
  return apiRequest(url);
}

// Fetch wasparfum page (ID: 24)
export async function getWasparfumPageData() {
  try {
    return await getPageById(24);
  } catch (error) {
    console.error("Failed to fetch wasparfum page:", error);
    return null;
  }
}

// Fetch product by ID from WooCommerce API
export async function getProductById(productId: number): Promise<any> {
  const url = `${endpoints.products}/${productId}`;
  return apiRequest(url, {}, true); // Use WooCommerce auth
}

// Fetch multiple products by IDs (optimized batch fetch)
export async function getProductsByIds(productIds: number[]): Promise<any[]> {
  try {
    // If only one product, use single fetch
    if (productIds.length === 1) {
      const product = await getProductById(productIds[0]);
      return [product];
    }
    
    // Batch fetch multiple products in one API call
    const idsParam = productIds.join(',');
    const url = `${endpoints.products}?include=${idsParam}&per_page=100`;
    
    try {
      const products = await apiRequest(url, {}, true); // Use WooCommerce auth
      return Array.isArray(products) ? products : [];
    } catch (batchError) {
      // If batch fetch fails, fall back to individual fetches with retry
      console.warn('Batch fetch failed, falling back to individual fetches:', batchError);
      const promises = productIds.map((id) => getProductById(id));
      const results = await Promise.allSettled(promises);

      return results
        .filter(
          (result): result is PromiseFulfilledResult<any> =>
            result.status === "fulfilled"
        )
        .map((result) => result.value);
    }
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return [];
  }
}

// Fetch media by ID
export async function getMediaById(mediaId: number): Promise<any> {
  const url = `${endpoints.media}/${mediaId}`;
  return apiRequest(url);
}

// Transform multiple WordPress products in batch (optimized)
export async function transformWordPressProducts(wpProducts: any[]): Promise<any[]> {
  if (!wpProducts || wpProducts.length === 0) {
    return [];
  }

  try {
    // Identify which products need WooCommerce data (ACF products without price)
    const productsNeedingFetch: number[] = [];
    const productsWithData: any[] = [];

    wpProducts.forEach((wpProduct) => {
      if (wpProduct.ID && !wpProduct.price) {
        // ACF product needs WooCommerce data
        productsNeedingFetch.push(wpProduct.ID);
      } else {
        // Already has complete data
        productsWithData.push(wpProduct);
      }
    });

    // Batch fetch all products that need WooCommerce data
    let fetchedProducts: any[] = [];
    if (productsNeedingFetch.length > 0) {
      console.log(`Batch fetching ${productsNeedingFetch.length} products from WooCommerce`);
      fetchedProducts = await getProductsByIds(productsNeedingFetch);
    }

    // Create a map of fetched products by ID for easy lookup
    const fetchedProductsMap = new Map(
      fetchedProducts.map((p) => [p.id, p])
    );

    // Transform all products
    const transformedProducts = await Promise.all(
      wpProducts.map(async (wpProduct) => {
        let productData = wpProduct;

        // If this product needed fetching, use the fetched data
        if (wpProduct.ID && !wpProduct.price) {
          const fetchedData = fetchedProductsMap.get(wpProduct.ID);
          if (fetchedData) {
            productData = fetchedData;
          } else {
            console.warn(`Failed to fetch product ${wpProduct.ID}, using fallback`);
          }
        }

        return await transformSingleProduct(productData, wpProduct);
      })
    );

    return transformedProducts;
  } catch (error) {
    console.error("Error batch transforming products:", error);
    // Fall back to individual transforms
    return Promise.all(
      wpProducts.map((wpProduct) => transformWordPressProduct(wpProduct))
    );
  }
}

// Helper function to transform a single product (shared logic)
async function transformSingleProduct(productData: any, wpProduct: any) {
  try {
    const productId = productData.id || productData.ID || wpProduct.ID;

    // Extract price data from WooCommerce response
    const price = productData.price || "0";
    const regularPrice = productData.regular_price || price;
    const salePrice = productData.sale_price || "";

    // Extract image data
    let mainImage = "";
    if (productData.images && productData.images.length > 0) {
      mainImage = productData.images[0].src;
    } else if (productData.featured_media) {
      // Fallback: try to get image from featured_media
      try {
        const mediaData = await getMediaById(productData.featured_media);
        mainImage = mediaData.source_url || mediaData.guid?.rendered || "";
      } catch (error) {
        console.error(`Failed to fetch media for product ${productId}:`, error);
      }
    }

    // Transform all images
    const images = productData.images
      ? productData.images.map((img: any) => ({
          id: img.id,
          src: img.src,
          alt: img.alt || productData.name || wpProduct.post_title,
        }))
      : mainImage
      ? [
          {
            id: productId,
            src: mainImage,
            alt: productData.name || wpProduct.post_title || "",
          },
        ]
      : [];

    // Convert WordPress permalink to NextJS route
    const productSlug = productData.slug || wpProduct.post_name || "";
    let relativePermalink = "";
    
    // If we have a full permalink, extract the path
    if (productData.permalink || wpProduct.link) {
      try {
        const url = new URL(productData.permalink || wpProduct.link);
        relativePermalink = url.pathname; // e.g., /wasparfum/morning-vapor/
      } catch {
        // If URL parsing fails, construct from slug
        relativePermalink = `/product/${productSlug}`;
      }
    } else {
      relativePermalink = `/product/${productSlug}`;
    }

    return {
      id: productId,
      name: productData.name || wpProduct.post_title || "",
      slug: productSlug,
      permalink: relativePermalink,
      price: price,
      regular_price: regularPrice,
      sale_price: salePrice,
      images: images,
      short_description:
        productData.short_description || wpProduct.post_excerpt || "",
      description: productData.description || wpProduct.post_content || "",
      featured: productData.featured || false,
      stock_status: productData.stock_status || "instock",
      categories: productData.categories || [],
      featured_media: productData.featured_media || wpProduct.featured_media,
    };
  } catch (error) {
    console.error("Error transforming single product:", error);
    // Return basic fallback data
    const productId = wpProduct.ID || wpProduct.id || productData.id;
    const fallbackSlug = wpProduct.post_name || wpProduct.slug || productData.slug || "";
    
    // Convert WordPress link to relative URL if available
    let fallbackPermalink = `/product/${fallbackSlug}`;
    if (wpProduct.link) {
      try {
        const url = new URL(wpProduct.link);
        fallbackPermalink = url.pathname;
      } catch {
        // Keep default fallback
      }
    }
    
    return {
      id: productId,
      name: wpProduct.post_title || wpProduct.name || productData.name || "Product",
      slug: fallbackSlug,
      permalink: fallbackPermalink,
      price: "0",
      regular_price: "0",
      sale_price: "",
      images: [
        {
          id: productId,
          src: `https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80`,
          alt: wpProduct.post_title || wpProduct.name || productData.name || "",
        },
      ],
      short_description: wpProduct.post_excerpt || "",
      description: wpProduct.post_content || "",
      featured: false,
      stock_status: "instock",
      categories: [],
      featured_media: wpProduct.featured_media,
    };
  }
}

// Transform WordPress product data to our format (single product - kept for backwards compatibility)
export async function transformWordPressProduct(wpProduct: any) {
  try {
    // If we received product data from ACF (WordPress post type),
    // we need to fetch the full WooCommerce product data
    let productData = wpProduct;

    // Check if this is ACF data (has ID or post_title) vs WooCommerce data (has id and name)
    if (wpProduct.ID && !wpProduct.price) {
      // This is ACF data, fetch full WooCommerce product
      console.log(`Fetching WooCommerce data for product ID: ${wpProduct.ID}`);
      try {
        productData = await getProductById(wpProduct.ID);
      } catch (error) {
        console.error(
          `Failed to fetch WooCommerce data for product ${wpProduct.ID}:`,
          error
        );
        // Fall back to ACF data
        productData = wpProduct;
      }
    }

    // Use the shared transform logic
    return await transformSingleProduct(productData, wpProduct);
  } catch (error) {
    console.error("Error transforming product:", error);
    // Use the shared transform logic for fallback
    return await transformSingleProduct({}, wpProduct);
  }
}

// Get media URL from WordPress
export function getWordPressImageUrl(
  imageData: any,
  size: string = "full"
): string {
  if (!imageData) return "";

  if (typeof imageData === "string") {
    return imageData;
  }

  if (imageData.sizes && imageData.sizes[size]) {
    return imageData.sizes[size];
  }

  if (imageData.url) {
    return imageData.url;
  }

  return imageData.source_url || "";
}
