import { NextRequest, NextResponse } from 'next/server';

const WORDPRESS_API_URL = process.env.WORDPRESS_API_URL || 'https://wasgeurtje.nl/wp-json/wc/v3';
const WC_CONSUMER_KEY = process.env.WC_CONSUMER_KEY;
const WC_CONSUMER_SECRET = process.env.WC_CONSUMER_SECRET;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const per_page = searchParams.get('per_page') || '10';

    if (!WC_CONSUMER_KEY || !WC_CONSUMER_SECRET) {
      return NextResponse.json(
        { error: 'WooCommerce credentials not configured' },
        { status: 500 }
      );
    }

    // Build WooCommerce API URL
    const url = new URL(`${WORDPRESS_API_URL}/products`);
    url.searchParams.append('consumer_key', WC_CONSUMER_KEY);
    url.searchParams.append('consumer_secret', WC_CONSUMER_SECRET);
    url.searchParams.append('per_page', per_page);
    url.searchParams.append('status', 'publish');
    
    if (search) {
      url.searchParams.append('search', search);
    }

    console.log('[WooCommerce API] Fetching products:', { search, per_page });

    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
      next: {
        revalidate: 60, // Cache for 60 seconds
      },
    });

    if (!response.ok) {
      console.error('[WooCommerce API] Error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch products' },
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
