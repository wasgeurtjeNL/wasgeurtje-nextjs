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
    console.log('🚨 [BULK FIX] Starting bulk fix of pending orders...');
    
    // Get all pending orders from today
    const today = new Date().toISOString().split('T')[0];
    const pendingOrdersResponse = await fetch(
      `${WC_API_URL}/orders?status=pending&after=${today}T00:00:00&per_page=50`,
      {
        method: 'GET',
        headers: wcHeaders(),
      }
    );
    
    if (!pendingOrdersResponse.ok) {
      throw new Error(`Failed to fetch pending orders: ${pendingOrdersResponse.status}`);
    }
    
    const pendingOrders = await pendingOrdersResponse.json();
    console.log(`🔍 [BULK FIX] Found ${pendingOrders.length} pending orders from today`);
    
    const results = [];
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const order of pendingOrders) {
      try {
        // Skip if not a Stripe order
        if (!order.payment_method?.includes('stripe')) {
          console.log(`⏭️ [BULK FIX] Skipping order #${order.number} (not Stripe payment)`);
          continue;
        }
        
        console.log(`🔧 [BULK FIX] Processing order #${order.number}...`);
        
        // Try to find associated PaymentIntent
        let paymentIntentId = null;
        
        // Check meta data for PaymentIntent ID
        const stripeMetaData = order.meta_data?.find((meta: any) => 
          meta.key === '_stripe_payment_intent_id'
        );
        
        if (stripeMetaData) {
          paymentIntentId = stripeMetaData.value;
        } else if (order.transaction_id) {
          paymentIntentId = order.transaction_id;
        }
        
        if (!paymentIntentId) {
          console.log(`⚠️ [BULK FIX] No PaymentIntent ID found for order #${order.number}`);
          results.push({
            orderId: order.id,
            orderNumber: order.number,
            success: false,
            error: 'No PaymentIntent ID found'
          });
          errorCount++;
          continue;
        }
        
        // Check if payment was successful in Stripe
        const paymentCheckResponse = await fetch(`/api/stripe/payment-status?payment_intent=${paymentIntentId}`);
        
        if (!paymentCheckResponse.ok) {
          console.log(`⚠️ [BULK FIX] Could not verify payment status for order #${order.number}`);
          results.push({
            orderId: order.id,
            orderNumber: order.number,
            success: false,
            error: 'Could not verify payment status'
          });
          errorCount++;
          continue;
        }
        
        const paymentData = await paymentCheckResponse.json();
        
        if (paymentData.status !== 'succeeded') {
          console.log(`⚠️ [BULK FIX] Payment not succeeded for order #${order.number} (status: ${paymentData.status})`);
          results.push({
            orderId: order.id,
            orderNumber: order.number,
            success: false,
            error: `Payment status: ${paymentData.status}`
          });
          errorCount++;
          continue;
        }
        
        // Fix the order
        const fixResponse = await fetch('/api/debug/fix-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.id.toString(),
            paymentIntentId: paymentIntentId
          })
        });
        
        const fixResult = await fixResponse.json();
        
        if (fixResult.success) {
          console.log(`✅ [BULK FIX] Fixed order #${order.number}`);
          results.push({
            orderId: order.id,
            orderNumber: order.number,
            success: true,
            paymentIntentId: paymentIntentId,
            changes: fixResult.changes
          });
          fixedCount++;
        } else {
          console.error(`❌ [BULK FIX] Failed to fix order #${order.number}:`, fixResult.error);
          results.push({
            orderId: order.id,
            orderNumber: order.number,
            success: false,
            error: fixResult.error
          });
          errorCount++;
        }
        
      } catch (orderError) {
        console.error(`❌ [BULK FIX] Error processing order #${order.number}:`, orderError);
        results.push({
          orderId: order.id,
          orderNumber: order.number,
          success: false,
          error: orderError instanceof Error ? orderError.message : 'Unknown error'
        });
        errorCount++;
      }
    }
    
    console.log(`🎉 [BULK FIX] Completed: ${fixedCount} fixed, ${errorCount} errors`);
    
    return NextResponse.json({
      success: true,
      summary: {
        totalOrders: pendingOrders.length,
        fixedOrders: fixedCount,
        errorOrders: errorCount,
        successRate: `${Math.round((fixedCount / pendingOrders.length) * 100)}%`
      },
      results: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('💥 [BULK FIX] Bulk fix error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Bulk Fix API for Pending Orders',
    usage: 'POST to fix all pending Stripe orders from today',
    warning: 'Use with caution - this will update multiple orders'
  });
}
