import { NextRequest, NextResponse } from 'next/server';

const WC_API_URL = 'https://wasgeurtje.nl';
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const ids = searchParams.get('ids');
    const per_page = searchParams.get('per_page') || '10';
    
    if (!CK || !CS) {
      console.error('[WooCommerce API] Credentials not configured');
      return NextResponse.json(
        { error: 'WooCommerce credentials not configured' },
        { status: 500 }
      );
    }

    // Build WooCommerce API URL
    const url = new URL(`${WC_API_URL}/wp-json/wc/v3/products`);
    url.searchParams.append('per_page', per_page);
    url.searchParams.append('status', 'publish');
    
    if (search) {
      url.searchParams.append('search', search);
    }
    
    // Support fetching by IDs (comma-separated)
    if (ids) {
      url.searchParams.append('include', ids);
    }

    console.log('[WooCommerce API] Fetching products:', { search, ids, per_page });

    const response = await fetch(url.toString(), {
      headers: wcHeaders(),
      next: {
        revalidate: 60, // Cache for 60 seconds
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[WooCommerce API] Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        url: url.toString()
      });
      return NextResponse.json(
        { 
          error: 'Failed to fetch products',
          details: {
            status: response.status,
            message: response.statusText
          }
        },
        { status: response.status }
      );
    }

    const products = await response.json();
    
    console.log('[WooCommerce API] ✅ Products fetched:', products.length);

    return NextResponse.json(products);
  } catch (error) {
    console.error('[WooCommerce API] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
