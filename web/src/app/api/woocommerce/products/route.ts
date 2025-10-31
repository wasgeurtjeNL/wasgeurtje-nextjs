import { NextRequest, NextResponse } from 'next/server';

const WC_API_URL = 'https://wasgeurtje.nl/wp-json/wc/v3';
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

// Product ID mapping from cart IDs to WooCommerce IDs
function mapCartIdToWooCommerceId(cartId: string): string {
  const idMapping: Record<string, string> = {
    'trial-pack': '1893', // Proefpakket - 5 Geuren
    'full-moon': '1425',  // Full Moon
    'blossom-drip': '1410', // Blossom Drip
    'flower-rain': '274', // Flower Rain (if needed)
    'sweet-fog': '275', // Sweet Fog (if needed)
  };
  
  // Return mapped ID if exists, otherwise return original ID
  return idMapping[cartId] || cartId;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');
    
    let apiUrl: string;
    
    if (!ids) {
      // Fetch all products if no IDs specified
      console.log(`🔄 Products API: Fetching all products`);
      apiUrl = `${WC_API_URL}/products?per_page=100&status=publish`;
    } else {
      // Map cart IDs to WooCommerce IDs
      const cartIds = ids.split(',');
      const mappedIds = cartIds.map(id => mapCartIdToWooCommerceId(id.trim()));
      
      console.log(`🔄 Products API: Mapping cart IDs [${cartIds.join(', ')}] to WooCommerce IDs [${mappedIds.join(', ')}]`);
      apiUrl = `${WC_API_URL}/products?include=${mappedIds.join(',')}&per_page=20`;
    }

    // Fetch products from WooCommerce
    const response = await fetch(apiUrl, {
      headers: wcHeaders(),
      cache: 'no-store', // Don't cache for fresh product data
    });

    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.status}`);
    }

    const products = await response.json();
    
    // Transform WooCommerce product data to our format
    const transformedProducts = products.map((product: any) => ({
      id: product.id.toString(),
      name: product.name,
      title: product.name,
      slug: product.slug,
      price: parseFloat(product.price),
      regular_price: product.regular_price ? parseFloat(product.regular_price) : null,
      sale_price: product.sale_price ? parseFloat(product.sale_price) : null,
      image: product.images && product.images.length > 0 ? product.images[0].src : '/figma/products/default-product.png',
      images: product.images || [],
      description: product.short_description ? product.short_description.replace(/<[^>]*>/g, '') : '', // Strip HTML
      on_sale: product.on_sale,
      stock_status: product.stock_status,
      sku: product.sku,
      average_rating: product.average_rating || "0",
      rating_count: product.rating_count || 0,
      categories: product.categories || []
    }));

    return NextResponse.json(transformedProducts);

  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { message: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

