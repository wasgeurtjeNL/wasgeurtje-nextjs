import { NextResponse } from 'next/server';

// WooCommerce credentials
const WC_API_URL = process.env.WOOCOMMERCE_API_URL || 'https://api.wasgeurtje.nl/wp-json/wc/v3';
const CK = process.env.WOOCOMMERCE_CONSUMER_KEY;
const CS = process.env.WOOCOMMERCE_CONSUMER_SECRET;

function wcHeaders() {
  if (!CK || !CS) {
    throw new Error('WooCommerce credentials not configured');
  }
  const token = Buffer.from(`${CK}:${CS}`).toString('base64');
  return {
    Authorization: `Basic ${token}`,
    'Content-Type': 'application/json',
  } as Record<string, string>;
}

export async function GET() {
  try {
    console.log('🔍 Testing WooCommerce connection...');
    console.log('API URL:', WC_API_URL);
    console.log('Consumer Key exists:', !!CK);
    console.log('Consumer Secret exists:', !!CS);

    if (!CK || !CS) {
      return NextResponse.json({
        success: false,
        error: 'WooCommerce credentials not configured',
        details: {
          WOOCOMMERCE_API_URL: !!process.env.WOOCOMMERCE_API_URL,
          WOOCOMMERCE_CONSUMER_KEY: !!CK,
          WOOCOMMERCE_CONSUMER_SECRET: !!CS,
        }
      }, { status: 500 });
    }

    // Test connection by fetching orders
    const response = await fetch(`${WC_API_URL}/orders?per_page=1`, {
      method: 'GET',
      headers: wcHeaders(),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WooCommerce API error:', errorText);
      
      return NextResponse.json({
        success: false,
        error: 'WooCommerce API connection failed',
        status: response.status,
        statusText: response.statusText,
        details: errorText,
      }, { status: response.status });
    }

    const orders = await response.json();
    
    return NextResponse.json({
      success: true,
      message: 'WooCommerce connection successful',
      ordersCount: orders.length,
      apiUrl: WC_API_URL,
      sampleOrder: orders[0] ? {
        id: orders[0].id,
        number: orders[0].number,
        status: orders[0].status,
        total: orders[0].total,
      } : null,
    });

  } catch (error) {
    console.error('Error testing WooCommerce connection:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Connection test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
