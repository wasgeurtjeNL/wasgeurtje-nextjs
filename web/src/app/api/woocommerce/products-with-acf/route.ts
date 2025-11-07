import { NextRequest, NextResponse } from 'next/server';

const WC_API_URL = process.env.WOOCOMMERCE_API_URL || 'https://api.wasgeurtje.nl';
const CK = process.env.WOOCOMMERCE_CONSUMER_KEY!;
const CS = process.env.WOOCOMMERCE_CONSUMER_SECRET!;

function wcHeaders() {
  // Basic auth header for WooCommerce REST API
  const token = Buffer.from(`${CK}:${CS}`).toString('base64');
  return {
    Authorization: `Basic ${token}`,
    'Content-Type': 'application/json',
  } as Record<string, string>;
}

interface WooCommerceProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  price: string;
  regular_price: string;
  sale_price: string;
  images: Array<{
    id: number;
    src: string;
    alt: string;
  }>;
  short_description: string;
  description: string;
  stock_status: string;
  stock_quantity: number | null;
  categories: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
}

interface ACFResponse {
  acf?: {
    parfum_tags?: string[];
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productIds = searchParams.get('ids');
    
    if (!productIds) {
      return NextResponse.json(
        { error: 'Product IDs are required' },
        { status: 400 }
      );
    }

    // Fetch products from WooCommerce
    // Ensure we don't double-add the path if WC_API_URL already contains it
    const baseUrl = WC_API_URL.includes('/wp-json') ? WC_API_URL : `${WC_API_URL}/wp-json/wc/v3`;
    const productsUrl = `${baseUrl}/products?include=${productIds}&per_page=20`;
    
    console.log(`[Products-ACF] Fetching from: ${productsUrl}`);
    
    const productsResponse = await fetch(productsUrl, {
      headers: wcHeaders(),
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!productsResponse.ok) {
      console.error('WooCommerce API Error:', productsResponse.status, await productsResponse.text());
      return NextResponse.json(
        { error: `WooCommerce API Error: ${productsResponse.statusText}` },
        { status: productsResponse.status }
      );
    }

    const products: WooCommerceProduct[] = await productsResponse.json();
    
    // Fetch ACF data for each product
    const productsWithACF = await Promise.all(
      products.map(async (product) => {
        try {
          // Try to fetch ACF data for this product
          let acfData: ACFResponse = {};
          try {
            // WordPress product endpoint (different from WooCommerce)
            const wpBaseUrl = WC_API_URL.replace('/wp-json/wc/v3', '').replace(/\/+$/, '');
            const acfUrl = `${wpBaseUrl}/wp-json/wp/v2/product/${product.id}`;
            
            const acfResponse = await fetch(acfUrl, {
              headers: wcHeaders(),
              next: { revalidate: 300 }, // Cache for 5 minutes
            });

            if (acfResponse.ok) {
              const wpData = await acfResponse.json();
              acfData = { acf: wpData.acf || {} };
            } else {
              console.warn(`ACF data not available for product ${product.id}, status: ${acfResponse.status}`);
            }
          } catch (acfError) {
            console.warn(`Failed to fetch ACF data for product ${product.id}:`, acfError);
          }

          // Transform to our Product interface
          return {
            id: product.id.toString(),
            slug: product.slug,
            title: product.name,
            price: product.price ? `€${product.price}` : '€0,00',
            image: product.images?.[0]?.src || null,
            description: product.short_description || product.description || '',
            scents: acfData.acf?.parfum_tags || ['Fris', 'Bloemig'], // Fallback scents if ACF data is unavailable
            stock_status: product.stock_status,
            stock_quantity: product.stock_quantity,
            categories: product.categories?.map(cat => cat.name) || [],
          };
        } catch (error) {
          console.error(`Error fetching ACF data for product ${product.id}:`, error);
          
          // Return product without ACF data as fallback
          return {
            id: product.id.toString(),
            slug: product.slug,
            title: product.name,
            price: product.price ? `€${product.price}` : '€0,00',
            image: product.images?.[0]?.src || null,
            description: product.short_description || product.description || '',
            scents: ['Fris', 'Bloemig'], // Fallback scents when ACF data fails
            stock_status: product.stock_status,
            stock_quantity: product.stock_quantity,
            categories: product.categories?.map(cat => cat.name) || [],
          };
        }
      })
    );

    return NextResponse.json(productsWithACF);
  } catch (error) {
    console.error('Error in products-with-acf API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
