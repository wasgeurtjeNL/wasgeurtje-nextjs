import { NextRequest, NextResponse } from 'next/server';

const WOOCOMMERCE_API_URL = process.env.WOOCOMMERCE_API_URL || 'https://wasgeurtje.nl/wp-json/wc/v3';
const WOOCOMMERCE_CONSUMER_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY!;
const WOOCOMMERCE_CONSUMER_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET!;

/**
 * GET /api/woocommerce/orders/by-phone
 * Retrieves the most recent order for a given phone number
 * Query params: phone (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone || !phone.trim()) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Normalize phone number for comparison (remove spaces, dashes, etc.)
    const normalizePhone = (phoneStr: string) => {
      return phoneStr
        .replace(/[\s\-\(\)]/g, '')
        .replace(/^\+31/, '0')
        .replace(/^0031/, '0');
    };

    const normalizedSearchPhone = normalizePhone(phone);
    console.log('🔍 Searching orders for phone:', phone, '(normalized:', normalizedSearchPhone, ')');

    // Create Basic Auth header
    const authHeader = 'Basic ' + Buffer.from(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`).toString('base64');

    // Fetch multiple pages for better coverage (200 orders = ~3-6 months)
    // Note: WooCommerce doesn't support direct phone search, so we need to fetch and filter
    const fetchOrders = async (page: number) => {
      const response = await fetch(
        `${WOOCOMMERCE_API_URL}/orders?per_page=100&page=${page}`,
        {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      return response.json();
    };

    // Fetch first 2 pages (200 orders total)
    const [page1Orders, page2Orders] = await Promise.all([
      fetchOrders(1),
      fetchOrders(2),
    ]);

    const orders = [...page1Orders, ...page2Orders];

    if (!orders || orders.length === 0) {
      console.log('📭 No orders found in database');
      return NextResponse.json({ found: false, order: null });
    }

    console.log(`📦 Retrieved ${orders.length} orders from WooCommerce`);

    // Filter orders by phone number with detailed logging
    const matchingOrders = orders.filter((order: any) => {
      const orderPhone = order.billing?.phone;
      if (!orderPhone) {
        console.log(`Order #${order.id}: NO PHONE NUMBER`);
        return false;
      }
      
      const normalizedOrderPhone = normalizePhone(orderPhone);
      const matches = normalizedOrderPhone === normalizedSearchPhone;
      
      // Debug: Log ALL comparisons to see what's happening
      console.log(`Order #${order.id}: "${orderPhone}" -> "${normalizedOrderPhone}" vs "${normalizedSearchPhone}" ${matches ? '✅ MATCH' : '❌'}`);
      
      return matches;
    });

    console.log(`🔍 Found ${matchingOrders.length} matching orders for normalized phone: ${normalizedSearchPhone}`);

    if (matchingOrders.length === 0) {
      console.log('📭 No orders found for this phone number');
      return NextResponse.json({ found: false, order: null });
    }

    // Get the most recent order (first one, since we sorted by date DESC)
    const mostRecentOrder = matchingOrders[0];
    
    console.log('✅ Found order for phone:', mostRecentOrder.id);

    // Extract relevant address information
    const addressInfo = {
      orderId: mostRecentOrder.id,
      orderNumber: mostRecentOrder.number,
      orderDate: mostRecentOrder.date_created,
      billing: {
        firstName: mostRecentOrder.billing?.first_name || '',
        lastName: mostRecentOrder.billing?.last_name || '',
        phone: mostRecentOrder.billing?.phone || '',
        email: mostRecentOrder.billing?.email || '',
        address1: mostRecentOrder.billing?.address_1 || '',
        address2: mostRecentOrder.billing?.address_2 || '',
        city: mostRecentOrder.billing?.city || '',
        postcode: mostRecentOrder.billing?.postcode || '',
        country: mostRecentOrder.billing?.country || '',
        fullAddress: `${mostRecentOrder.billing?.address_1 || ''} ${mostRecentOrder.billing?.address_2 || ''}`.trim(),
      },
    };

    return NextResponse.json({
      found: true,
      order: addressInfo,
    });
  } catch (error: any) {
    console.error('Error fetching orders by phone:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders', details: error.message },
      { status: 500 }
    );
  }
}

