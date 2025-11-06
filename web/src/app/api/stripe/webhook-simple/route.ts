import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe
function initializeStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not configured');
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil',
  });
}

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

// 🚀 SIMPLE & RELIABLE: Update order to processing status
async function updateOrderToProcessing(orderId: string, paymentIntentId: string) {
  try {
    console.log(`🔄 [SIMPLE] Updating order #${orderId} to processing status`);
    
    const updateData = {
      status: 'processing',
      set_paid: true,
      payment_method: 'stripe',
      payment_method_title: 'Stripe',
      transaction_id: paymentIntentId,
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
          key: '_paid_date',
          value: Math.floor(Date.now() / 1000).toString(),
        }
      ]
    };
    
    const response = await fetch(`${WC_API_URL}/orders/${orderId}`, {
      method: 'PUT',
      headers: wcHeaders(),
      body: JSON.stringify(updateData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WooCommerce update failed: ${response.status} - ${errorText}`);
    }
    
    const updatedOrder = await response.json();
    console.log(`✅ [SIMPLE] Order #${orderId} updated to processing successfully`);
    
    return updatedOrder;
    
  } catch (error) {
    console.error(`❌ [SIMPLE] Failed to update order #${orderId}:`, error);
    throw error;
  }
}

// 🔍 SIMPLE: Find order by PaymentIntent ID
async function findOrderByPaymentIntent(paymentIntentId: string) {
  try {
    console.log(`🔍 [SIMPLE] Searching for order with PaymentIntent: ${paymentIntentId}`);
    
    const response = await fetch(
      `${WC_API_URL}/orders?meta_key=_stripe_payment_intent_id&meta_value=${paymentIntentId}&per_page=1`,
      {
        method: 'GET',
        headers: wcHeaders(),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Order search failed: ${response.status}`);
    }
    
    const orders = await response.json();
    return orders && orders.length > 0 ? orders[0] : null;
    
  } catch (error) {
    console.error(`❌ [SIMPLE] Error searching for order:`, error);
    return null;
  }
}

// 🏪 SIMPLE: Create new order from PaymentIntent metadata
async function createOrderFromMetadata(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log(`🏪 [SIMPLE] Creating order from PaymentIntent metadata`);
    
    const metadata = paymentIntent.metadata;
    const lineItems = JSON.parse(metadata.cart || '[]');
    const customer = JSON.parse(metadata.customer_data || '{}');
    
    // Simple order creation
    const orderData = {
      status: 'processing',
      set_paid: true,
      payment_method: 'stripe',
      payment_method_title: 'Stripe',
      transaction_id: paymentIntent.id,
      date_paid: new Date().toISOString(),
      billing: {
        first_name: customer.firstName || '',
        last_name: customer.lastName || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address_1: `${customer.address || ''} ${customer.houseNumber || ''}`,
        city: customer.city || '',
        postcode: customer.postcode || '',
        country: customer.country || 'NL',
      },
      line_items: lineItems.map((item: any) => ({
        product_id: parseInt(item.id),
        quantity: item.quantity,
      })),
      shipping_lines: [
        {
          method_id: 'free_shipping',
          method_title: 'Gratis verzending',
          total: '0.00',
        }
      ],
      meta_data: [
        {
          key: '_stripe_payment_intent_id',
          value: paymentIntent.id,
        },
        {
          key: '_payment_completed_at',
          value: new Date().toISOString(),
        },
        {
          key: '_paid_date',
          value: Math.floor(Date.now() / 1000).toString(),
        }
      ]
    };
    
    const response = await fetch(`${WC_API_URL}/orders`, {
      method: 'POST',
      headers: {
        ...wcHeaders(),
        'Idempotency-Key': `simple-${paymentIntent.id}`,
      },
      body: JSON.stringify(orderData),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Order creation failed: ${response.status} - ${errorText}`);
    }
    
    const order = await response.json();
    console.log(`✅ [SIMPLE] Order #${order.number} created successfully`);
    
    return order;
    
  } catch (error) {
    console.error(`❌ [SIMPLE] Error creating order:`, error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const webhookStart = Date.now();
  
  try {
    console.log(`🎭 [SIMPLE WEBHOOK] Processing webhook at ${new Date().toISOString()}`);
    
    const isSimulation = request.headers.get('X-Webhook-Simulation') === 'true';
    
    if (!isSimulation) {
      // Verify webhook signature for real webhooks
      const body = await request.text();
      const signature = request.headers.get('stripe-signature');
      
      if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
        console.error('❌ [SIMPLE] Missing webhook signature or secret');
        return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 });
      }
      
      const stripe = initializeStripe();
      
      try {
        const event = stripe.webhooks.constructEvent(
          body,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET
        );
        
        if (event.type !== 'payment_intent.succeeded') {
          console.log(`⚠️ [SIMPLE] Unhandled event type: ${event.type}`);
          return NextResponse.json({ received: true });
        }
        
        var paymentIntent = event.data.object as Stripe.PaymentIntent;
        
      } catch (err) {
        console.error('❌ [SIMPLE] Webhook signature verification failed:', err);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    } else {
      // For simulations, get data from body
      const body = await request.json();
      var paymentIntent = body.data.object;
    }
    
    console.log(`💳 [SIMPLE] Processing payment: ${paymentIntent.id}`);
    
    // STEP 1: Check if we have pre-created order info in metadata
    const metadata = paymentIntent.metadata;
    const preCreatedOrderId = metadata?.woocommerce_order_id;
    
    if (preCreatedOrderId) {
      // 🎯 PRE-CREATED ORDER: Just update status
      console.log(`🔄 [SIMPLE] Found pre-created order ID: ${preCreatedOrderId}`);
      
      try {
        const updatedOrder = await updateOrderToProcessing(preCreatedOrderId, paymentIntent.id);
        
        const processingTime = Date.now() - webhookStart;
        console.log(`✅ [SIMPLE] Pre-created order updated in ${processingTime}ms`);
        
        return NextResponse.json({
          success: true,
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.number,
          paymentIntentId: paymentIntent.id,
          approach: 'pre_order_update',
          processingTime,
          simulation: isSimulation
        });
        
      } catch (updateError) {
        console.error(`⚠️ [SIMPLE] Pre-order update failed, creating new order:`, updateError);
        // Fall through to create new order
      }
    }
    
    // STEP 2: Check if order already exists
    const existingOrder = await findOrderByPaymentIntent(paymentIntent.id);
    
    if (existingOrder) {
      console.log(`✅ [SIMPLE] Found existing order #${existingOrder.number}, updating status`);
      
      try {
        const updatedOrder = await updateOrderToProcessing(existingOrder.id, paymentIntent.id);
        
        const processingTime = Date.now() - webhookStart;
        
        return NextResponse.json({
          success: true,
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.number,
          paymentIntentId: paymentIntent.id,
          approach: 'existing_order_update',
          processingTime,
          simulation: isSimulation
        });
        
      } catch (updateError) {
        console.error(`⚠️ [SIMPLE] Existing order update failed:`, updateError);
        // Continue to create new order
      }
    }
    
    // STEP 3: Create new order from metadata
    console.log(`🏪 [SIMPLE] No existing order found, creating new order`);
    
    try {
      const newOrder = await createOrderFromMetadata(paymentIntent);
      
      const processingTime = Date.now() - webhookStart;
      
      return NextResponse.json({
        success: true,
        orderId: newOrder.id,
        orderNumber: newOrder.number,
        paymentIntentId: paymentIntent.id,
        approach: 'new_order_creation',
        processingTime,
        simulation: isSimulation
      });
      
    } catch (createError) {
      console.error(`❌ [SIMPLE] Order creation failed:`, createError);
      
      return NextResponse.json({
        success: false,
        error: 'All order processing methods failed',
        paymentIntentId: paymentIntent.id,
        details: createError instanceof Error ? createError.message : 'Unknown error',
        simulation: isSimulation
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('💥 [SIMPLE] Webhook processing error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Simple Stripe Webhook Handler',
    status: 'active',
    timestamp: new Date().toISOString()
  });
}
