import { NextResponse } from 'next/server';

const WOOCOMMERCE_API_URL = process.env.WOOCOMMERCE_API_URL || 'https://api.wasgeurtje.nl/wp-json/wc/v3';
const WOOCOMMERCE_CONSUMER_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY!;
const WOOCOMMERCE_CONSUMER_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET!;

export async function GET() {
  try {
    const authHeader = 'Basic ' + Buffer.from(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`).toString('base64');

    const response = await fetch(
      `${WOOCOMMERCE_API_URL}/orders?per_page=100&page=1`,
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'API failed', status: response.status }, { status: 500 });
    }

    const orders = await response.json();

    // Extract phone numbers
    const phoneData = orders.map((order: any) => ({
      orderId: order.id,
      orderNumber: order.number,
      name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
      phone: order.billing?.phone || 'NO_PHONE',
      normalized: normalizePhone(order.billing?.phone || ''),
    }));

    return NextResponse.json({
      totalOrders: orders.length,
      phones: phoneData,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function normalizePhone(phoneStr: string) {
  if (!phoneStr) return '';
  return phoneStr
    .replace(/[\s\-\(\)]/g, '')
    .replace(/^\+31/, '0')
    .replace(/^0031/, '0');
}

