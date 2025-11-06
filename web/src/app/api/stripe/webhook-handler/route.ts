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
    
    // Get current order first to preserve data
    const currentResponse = await fetch(`${WC_API_URL}/orders/${orderId}`, {
      method: 'GET',
      headers: wcHeaders()
    });
    
    let existingMetaData = [];
    if (currentResponse.ok) {
      const currentOrder = await currentResponse.json();
      existingMetaData = currentOrder.meta_data || [];
      console.log(`📋 [SIMPLE] Current status: ${currentOrder.status}, payment_method: ${currentOrder.payment_method}`);
    }
    
    // Merge meta data properly
    const newMetaData = [
      ...existingMetaData.filter((meta: any) => 
        !['_stripe_payment_intent_id', '_payment_completed_at', '_paid_date', '_transaction_id'].includes(meta.key)
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
        value: Math.floor(Date.now() / 1000).toString(),
      },
      {
        key: '_transaction_id',
        value: paymentIntentId,
      }
    ];
    
    const updateData = {
      status: 'processing',
      set_paid: true,
      payment_method: 'stripe',
      payment_method_title: 'Stripe',
      transaction_id: paymentIntentId,
      date_paid: new Date().toISOString(),
      meta_data: newMetaData
    };
    
    console.log(`🔧 [SIMPLE] Updating order with complete data...`);
    
    const response = await fetch(`${WC_API_URL}/orders/${orderId}`, {
      method: 'PUT',
      headers: wcHeaders(),
      body: JSON.stringify(updateData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [SIMPLE] Update failed:`, response.status, errorText);
      throw new Error(`WooCommerce update failed: ${response.status} - ${errorText}`);
    }
    
    const updatedOrder = await response.json();
    console.log(`✅ [SIMPLE] Order #${updatedOrder.number} updated successfully`);
    
    return updatedOrder;
    
  } catch (error) {
    console.error(`❌ [SIMPLE] Failed to update order #${orderId}:`, error);
    throw error;
  }
}

// 🔍 SIMPLE: Find order by PaymentIntent ID or pre-created order ID
async function findOrderForPayment(paymentIntent: Stripe.PaymentIntent) {
  try {
    const paymentIntentId = paymentIntent.id;
    const metadata = paymentIntent.metadata;
    
    // Method 1: Check for pre-created order
    if (metadata?.woocommerce_order_id) {
      console.log(`🔍 [SIMPLE] Checking pre-created order ID: ${metadata.woocommerce_order_id}`);
      
      const response = await fetch(`${WC_API_URL}/orders/${metadata.woocommerce_order_id}`, {
        method: 'GET',
        headers: wcHeaders()
      });
      
      if (response.ok) {
        const order = await response.json();
        console.log(`✅ [SIMPLE] Found pre-created order #${order.number}`);
        return { order, method: 'pre_created' };
      }
    }
    
    // Method 2: Search by PaymentIntent ID in meta data
    console.log(`🔍 [SIMPLE] Searching for existing order with PaymentIntent: ${paymentIntentId}`);
    
    const searchResponse = await fetch(
      `${WC_API_URL}/orders?meta_key=_stripe_payment_intent_id&meta_value=${paymentIntentId}&per_page=1`,
      {
        method: 'GET',
        headers: wcHeaders(),
      }
    );
    
    if (searchResponse.ok) {
      const orders = await searchResponse.json();
      if (orders && orders.length > 0) {
        console.log(`✅ [SIMPLE] Found existing order #${orders[0].number}`);
        return { order: orders[0], method: 'existing_search' };
      }
    }
    
    console.log(`⚠️ [SIMPLE] No existing order found for PaymentIntent ${paymentIntentId}`);
    return null;
    
  } catch (error) {
    console.error(`❌ [SIMPLE] Error finding order:`, error);
    return null;
  }
}

// 🏪 SIMPLE: Create new order from PaymentIntent metadata
async function createOrderFromMetadata(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log(`🏪 [SIMPLE] Creating order from PaymentIntent metadata`);
    
    const metadata = paymentIntent.metadata;
    
    if (!metadata?.cart || !metadata?.customer_data) {
      throw new Error('Missing required metadata: cart or customer_data');
    }
    
    const lineItems = JSON.parse(metadata.cart);
    const customer = JSON.parse(metadata.customer_data);
    const finalTotal = parseFloat(metadata.final_total || '0');
    
    // Simple order creation with all required fields
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
        address_1: `${customer.address || ''} ${customer.houseNumber || ''}`.trim(),
        city: customer.city || '',
        postcode: customer.postcode || '',
        country: customer.country?.toUpperCase() || 'NL',
      },
      shipping: {
        first_name: customer.firstName || '',
        last_name: customer.lastName || '',
        address_1: `${customer.address || ''} ${customer.houseNumber || ''}`.trim(),
        city: customer.city || '',
        postcode: customer.postcode || '',
        country: customer.country?.toUpperCase() || 'NL',
      },
      line_items: lineItems.map((item: any) => ({
        product_id: parseInt(item.id),
        quantity: item.quantity,
      })),
      shipping_lines: finalTotal >= 40 ? [
        {
          method_id: 'free_shipping',
          method_title: 'Gratis verzending',
          total: '0.00',
        }
      ] : [
        {
          method_id: 'flat_rate',
          method_title: 'Standaard verzending',
          total: '4.95',
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
        },
        {
          key: '_transaction_id',
          value: paymentIntent.id,
        },
        {
          key: '_order_created_via',
          value: 'simple_webhook',
        }
      ]
    };
    
    console.log(`🏪 [SIMPLE] Creating order with data:`, JSON.stringify(orderData, null, 2));
    
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
      console.error(`❌ [SIMPLE] Order creation failed:`, response.status, errorText);
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
    
    // Find existing order
    const orderResult = await findOrderForPayment(paymentIntent);
    
    if (orderResult) {
      // Update existing order
      console.log(`🔄 [SIMPLE] Updating existing order #${orderResult.order.number} (method: ${orderResult.method})`);
      
      try {
        const updatedOrder = await updateOrderToProcessing(orderResult.order.id, paymentIntent.id);
        
        const processingTime = Date.now() - webhookStart;
        console.log(`✅ [SIMPLE] Order updated in ${processingTime}ms`);
        
        return NextResponse.json({
          success: true,
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.number,
          paymentIntentId: paymentIntent.id,
          approach: orderResult.method,
          processingTime,
          simulation: isSimulation,
          message: `Order #${updatedOrder.number} updated to processing via ${orderResult.method}`
        });
        
      } catch (updateError) {
        console.error(`⚠️ [SIMPLE] Update failed, will create new order:`, updateError);
        // Fall through to create new order
      }
    }
    
    // 🛡️ FINAL CHECK: One more search before creating new order (prevent duplicates)
    console.log(`🛡️ [SIMPLE] Final duplicate check before creating new order...`);
    
    // Broad search: Check ALL orders with this PaymentIntent (up to 5)
    try {
      const broadSearchResponse = await fetch(
        `${WC_API_URL}/orders?meta_key=_stripe_payment_intent_id&meta_value=${paymentIntent.id}&per_page=5`,
        {
          method: 'GET',
          headers: wcHeaders(),
        }
      );
      
      if (broadSearchResponse.ok) {
        const allOrders = await broadSearchResponse.json();
        if (allOrders && allOrders.length > 0) {
          console.log(`🚨 [SIMPLE] DUPLICATE PREVENTION: Found ${allOrders.length} existing orders!`);
          console.log(`✅ [SIMPLE] Returning first existing order #${allOrders[0].number}`);
          
          const processingTime = Date.now() - webhookStart;
          
          return NextResponse.json({
            success: true,
            orderId: allOrders[0].id,
            orderNumber: allOrders[0].number,
            paymentIntentId: paymentIntent.id,
            approach: 'duplicate_prevention_final',
            processingTime,
            simulation: isSimulation,
            duplicatesFound: allOrders.length,
            message: `Prevented duplicate! Returned existing order #${allOrders[0].number}`
          });
        }
      }
    } catch (finalCheckError) {
      console.error(`⚠️ [SIMPLE] Final duplicate check failed:`, finalCheckError);
    }
    
    // Create new order if no existing order or update failed (ONLY after all checks)
    console.log(`🏪 [SIMPLE] Creating new order from PaymentIntent metadata (no duplicates found)`);
    
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
        simulation: isSimulation,
        message: `Order #${newOrder.number} created successfully in ${processingTime}ms`
      });
      
    } catch (createError) {
      console.error(`❌ [SIMPLE] Order creation failed:`, createError);
      
      return NextResponse.json({
        success: false,
        error: 'Order processing failed',
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
    message: 'Simple & Reliable Stripe Webhook Handler',
    status: 'active',
    version: '2.0-simple',
    timestamp: new Date().toISOString()
  });
}