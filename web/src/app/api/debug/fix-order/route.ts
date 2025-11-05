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
    
    // STEP 1: Get current order data to preserve existing meta_data
    console.log(`📋 Fetching current order data for #${orderId}...`);
    const currentOrderResponse = await fetch(`${WC_API_URL}/orders/${orderId}`, {
      method: 'GET',
      headers: wcHeaders()
    });
    
    if (!currentOrderResponse.ok) {
      throw new Error(`Cannot fetch current order: ${currentOrderResponse.status}`);
    }
    
    const currentOrder = await currentOrderResponse.json();
    console.log(`📋 Current order status: ${currentOrder.status}, payment_method: ${currentOrder.payment_method}`);
    
    // STEP 2: Merge existing meta_data with new payment data
    const existingMetaData = currentOrder.meta_data || [];
    const newMetaData = [
      ...existingMetaData.filter((meta: any) => 
        !['_stripe_payment_intent_id', '_payment_completed_at', '_paid_date', '_transaction_id', '_manual_fix_applied', '_manual_fix_timestamp'].includes(meta.key)
      ),
      {
        key: '_stripe_payment_intent_id',
        value: paymentIntentId,
      },
      {
        key: '_payment_completed_at',
        value: new Date().toISOString(),
      },
      {
        key: '_paid_date',
        value: Math.floor(Date.now() / 1000).toString(), // Unix timestamp for WooCommerce
      },
      {
        key: '_transaction_id',
        value: paymentIntentId,
      },
      {
        key: '_manual_fix_applied',
        value: 'true',
      },
      {
        key: '_manual_fix_timestamp',
        value: new Date().toISOString(),
      }
    ];
    
    // STEP 3: Complete order update with all required fields
    const updateData = {
      status: 'processing',
      set_paid: true,
      payment_method: 'stripe', // ✅ CRITICAL: Remove '_pending' suffix
      payment_method_title: 'Stripe',
      transaction_id: paymentIntentId, // ✅ CRITICAL: Link PaymentIntent
      date_paid: new Date().toISOString(), // ✅ CRITICAL: Set paid date
      date_completed: null, // Keep null for processing status
      meta_data: newMetaData // ✅ CRITICAL: Merged meta data
    };
    
    console.log(`🔧 Updating order with complete data:`, JSON.stringify(updateData, null, 2));
    
    const updateResponse = await fetch(`${WC_API_URL}/orders/${orderId}`, {
      method: 'PUT',
      headers: wcHeaders(),
      body: JSON.stringify(updateData)
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
      previousStatus: currentOrder.status,
      newStatus: updatedOrder.status,
      paymentIntentId,
      message: `Order #${updatedOrder.number} completely fixed with all WooCommerce fields`,
      changes: {
        status: `${currentOrder.status} → ${updatedOrder.status}`,
        payment_method: `${currentOrder.payment_method} → ${updatedOrder.payment_method}`,
        transaction_id: `"${currentOrder.transaction_id || 'empty'}" → "${updatedOrder.transaction_id}"`,
        date_paid: `${currentOrder.date_paid || 'null'} → ${updatedOrder.date_paid}`,
        set_paid: `${currentOrder.set_paid || false} → ${updatedOrder.set_paid || true}`
      },
      order: {
        id: updatedOrder.id,
        number: updatedOrder.number,
        status: updatedOrder.status,
        payment_method: updatedOrder.payment_method,
        transaction_id: updatedOrder.transaction_id,
        date_paid: updatedOrder.date_paid,
        total: updatedOrder.total,
        meta_data_count: newMetaData.length
      },
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
