import { NextRequest, NextResponse } from 'next/server';

// WooCommerce credentials
const WC_API_URL = process.env.WOOCOMMERCE_API_URL || 'https://api.wasgeurtje.nl/wp-json/wc/v3';
const CK = process.env.WOOCOMMERCE_CONSUMER_KEY!;
const CS = process.env.WOOCOMMERCE_CONSUMER_SECRET!;

function wcHeaders() {
  const token = Buffer.from(`${CK}:${CS}`).toString('base64');
  return {
    Authorization: `Basic ${token}`,
    'Content-Type': 'application/json',
  } as Record<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    const { orderId, paymentIntentId } = await request.json();
    
    if (!orderId || !paymentIntentId) {
      return NextResponse.json({
        success: false,
        error: 'Order ID and PaymentIntent ID are required'
      }, { status: 400 });
    }
    
    console.log(`🔧 Fixing order #${orderId} with PaymentIntent ${paymentIntentId}`);
    
    // Update the order to completed status
    const updateResponse = await fetch(`${WC_API_URL}/orders/${orderId}`, {
      method: 'PUT',
      headers: wcHeaders(),
      body: JSON.stringify({
        status: 'completed',
        set_paid: true,
        transaction_id: paymentIntentId,
        payment_method: 'stripe',
        payment_method_title: 'Stripe (Manual Fix)',
        date_paid: new Date().toISOString(),
        meta_data: [
          {
            key: '_stripe_payment_intent_id',
            value: paymentIntentId,
          },
          {
            key: '_payment_completed_at',
            value: new Date().toISOString(),
          },
          {
            key: '_manual_fix_applied',
            value: 'true',
          },
          {
            key: '_manual_fix_timestamp',
            value: new Date().toISOString(),
          }
        ]
      })
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      return NextResponse.json({
        success: false,
        error: `Failed to update order: ${updateResponse.status} - ${errorText}`
      }, { status: 500 });
    }
    
    const updatedOrder = await updateResponse.json();
    
    console.log(`✅ Order #${orderId} successfully fixed and marked as completed`);
    
    return NextResponse.json({
      success: true,
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.number,
      previousStatus: 'pending',
      newStatus: updatedOrder.status,
      paymentIntentId,
      message: `Order #${updatedOrder.number} successfully marked as completed`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fixing order:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Order Fix API - Use POST with orderId and paymentIntentId to fix pending orders',
    usage: {
      method: 'POST',
      body: {
        orderId: 'WooCommerce order ID (e.g., 348769)',
        paymentIntentId: 'Stripe PaymentIntent ID (e.g., pi_3...)'
      }
    }
  });
}
