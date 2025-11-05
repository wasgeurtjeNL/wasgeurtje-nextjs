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

interface LineItem {
  id: string;
  quantity: number;
}

interface Customer {
  customerId?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName?: string;
  vatNumber?: string;
  businessOrder: boolean;
  address: string;
  houseNumber: string;
  houseAddition?: string;
  city: string;
  postcode: string;
  useShippingAddress?: boolean;
  shippingAddress?: string;
  shippingHouseNumber?: string;
  shippingHouseAddition?: string;
  shippingCity?: string;
  shippingPostcode?: string;
}

interface AppliedDiscount {
  coupon_code: string;
  discount_type: string;
  discount_amount: number;
}

async function createWooCommerceOrder(
  paymentIntentId: string,
  lineItems: LineItem[],
  customer: Customer,
  appliedDiscount?: AppliedDiscount,
  totals?: {
    subtotal: number;
    discountAmount: number;
    volumeDiscount: number;
    shippingCost: number;
    finalTotal: number;
  }
) {
  try {
    // Prepare line items for WooCommerce
    const wcLineItems = lineItems.map(item => ({
      product_id: parseInt(item.id),
      quantity: item.quantity,
    }));

    // Prepare billing address
    const billingAddress = {
      first_name: customer.firstName,
      last_name: customer.lastName,
      company: customer.companyName || '',
      address_1: `${customer.address} ${customer.houseNumber}${customer.houseAddition || ''}`,
      address_2: '',
      city: customer.city,
      state: '',
      postcode: customer.postcode,
      country: 'NL',
      email: customer.email,
      phone: customer.phone,
    };

    // Prepare shipping address (use billing if not different)
    const shippingAddress = customer.useShippingAddress ? {
      first_name: customer.firstName,
      last_name: customer.lastName,
      company: customer.companyName || '',
      address_1: `${customer.shippingAddress} ${customer.shippingHouseNumber}${customer.shippingHouseAddition || ''}`,
      address_2: '',
      city: customer.shippingCity,
      state: '',
      postcode: customer.shippingPostcode,
      country: 'NL',
    } : billingAddress;

    // Prepare coupon lines if discount applied
    const couponLines = [];
    if (appliedDiscount) {
      couponLines.push({
        code: appliedDiscount.coupon_code,
      });
    }

    // Prepare fee lines for volume discount
    const feeLines = [];
    if (totals && totals.volumeDiscount > 0) {
      feeLines.push({
        name: 'Volume korting (10%)',
        amount: (-totals.volumeDiscount).toString(),
      });
    }

    // Prepare shipping lines
    const shippingLines = [];
    if (totals && totals.shippingCost > 0) {
      shippingLines.push({
        method_id: 'flat_rate',
        method_title: 'Standaard verzending',
        total: totals.shippingCost.toString(),
      });
    } else {
      shippingLines.push({
        method_id: 'free_shipping',
        method_title: 'Gratis verzending',
        total: '0.00',
      });
    }

    // Create WooCommerce order
    const orderData = {
      payment_method: 'stripe',
      payment_method_title: 'Stripe',
      set_paid: true,
      transaction_id: paymentIntentId,
      billing: billingAddress,
      shipping: shippingAddress,
      line_items: wcLineItems,
      coupon_lines: couponLines,
      fee_lines: feeLines,
      shipping_lines: shippingLines,
      meta_data: [
        {
          key: '_stripe_payment_intent_id',
          value: paymentIntentId,
        },
        {
          key: '_business_order',
          value: customer.businessOrder ? 'yes' : 'no',
        },
        {
          key: '_vat_number',
          value: customer.vatNumber || '',
        },
      ],
    };

    console.log('🏪 Creating WooCommerce order with data:', JSON.stringify(orderData, null, 2));

    const response = await fetch(`${WC_API_URL}/orders`, {
      method: 'POST',
      headers: {
        ...wcHeaders(),
        'Idempotency-Key': `woo-${paymentIntentId}`, // Prevent duplicate orders
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ WooCommerce order creation failed:', response.status, errorText);
      throw new Error(`WooCommerce API error: ${response.status} - ${errorText}`);
    }

    const order = await response.json();
    console.log('✅ WooCommerce order created successfully:', order.id);

    return order;

  } catch (error) {
    console.error('💥 Error creating WooCommerce order:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const isSimulation = request.headers.get('X-Webhook-Simulation') === 'true';
    const webhookStartTime = Date.now();
    
    console.log(`🎭 [STEP 2] Processing ${isSimulation ? 'SIMULATED' : 'REAL'} webhook`);

    const body = await request.json();
    const event = body;

    console.log('📡 [STEP 2] Received webhook event:', event.type, event.data?.object?.id);
    console.log('⏱️ [STEP 2] Webhook processing started at:', new Date().toISOString());

    // Handle payment_intent.succeeded event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;

      console.log('💳 Processing successful payment:', paymentIntent.id);

      try {
        // Extract metadata
        const metadata = paymentIntent.metadata;
        
        if (!metadata || !metadata.cart || !metadata.customer_data) {
          console.error('❌ Missing required metadata in PaymentIntent');
          console.error('Available metadata keys:', Object.keys(metadata || {}));
          return NextResponse.json(
            { 
              error: 'Missing order data',
              available_metadata: Object.keys(metadata || {}),
              simulation: isSimulation
            },
            { status: 400 }
          );
        }

        const lineItems: LineItem[] = JSON.parse(metadata.cart);
        const customer: Customer = JSON.parse(metadata.customer_data);
        const appliedDiscount: AppliedDiscount | undefined = metadata.applied_discount 
          ? JSON.parse(metadata.applied_discount) 
          : undefined;

        // Parse totals from metadata
        const totals = {
          subtotal: parseFloat(metadata.subtotal || '0'),
          discountAmount: parseFloat(metadata.discount_amount || '0'),
          volumeDiscount: parseFloat(metadata.volume_discount || '0'),
          shippingCost: parseFloat(metadata.shipping_cost || '0'),
          finalTotal: parseFloat(metadata.final_total || '0'),
        };

        console.log('📦 [STEP 2] Parsed webhook data:', {
          lineItems: lineItems.length,
          customerEmail: customer.email,
          appliedDiscount: appliedDiscount?.coupon_code,
          totals,
          paymentIntentId: paymentIntent.id
        });

        // 🛡️ STEP 2: Enhanced duplicate detection
        console.log('🔍 [STEP 2] Checking for existing orders to prevent duplicates...');
        
        const duplicateCheckStart = Date.now();
        const existingOrderCheck = await fetch(
          `${WC_API_URL}/orders?meta_key=_stripe_payment_intent_id&meta_value=${paymentIntent.id}&per_page=5`,
          {
            method: 'GET',
            headers: wcHeaders(),
          }
        );
        
        const duplicateCheckTime = Date.now() - duplicateCheckStart;
        console.log(`⏱️ [STEP 2] Duplicate check completed in ${duplicateCheckTime}ms`);
        
        if (existingOrderCheck.ok) {
          const existingOrders = await existingOrderCheck.json();
          const orderCount = existingOrders?.length || 0;
          
          console.log(`🔍 [STEP 2] Found ${orderCount} existing orders for PaymentIntent ${paymentIntent.id}`);
          
          if (orderCount > 0) {
            const existingOrder = existingOrders[0];
            const totalProcessingTime = Date.now() - webhookStartTime;
            
            // Log all existing orders for debugging
            existingOrders.forEach((order: any, index: number) => {
              console.log(`  ${index + 1}. Order #${order.number} (ID: ${order.id}) - Status: ${order.status} - Total: €${order.total}`);
            });
            
            console.log(`✅ [STEP 2] Returning existing order #${existingOrder.number} to prevent duplicate (processed in ${totalProcessingTime}ms)`);
            
            return NextResponse.json({
              success: true,
              orderId: existingOrder.id,
              orderNumber: existingOrder.number,
              paymentIntentId: paymentIntent.id,
              simulation: isSimulation,
              processingTime: totalProcessingTime,
              duplicateCheckTime,
              message: `Existing order #${existingOrder.number} found - duplicate prevented in ${totalProcessingTime}ms`,
              approach: 'duplicate_prevention',
              existingOrderCount: orderCount
            });
          }
        } else {
          console.log(`⚠️ [STEP 2] Could not check for existing orders (${existingOrderCheck.status}), proceeding with creation`);
        }

        // 🏪 STEP 2: Create new WooCommerce order with enhanced logging
        console.log('🏪 [STEP 2] Creating new WooCommerce order...');
        const orderCreationStart = Date.now();
        
        const order = await createWooCommerceOrder(
          paymentIntent.id,
          lineItems,
          customer,
          appliedDiscount,
          totals
        );

        const orderCreationTime = Date.now() - orderCreationStart;
        console.log(`✅ [STEP 2] WooCommerce order created: #${order.number} (ID: ${order.id}) in ${orderCreationTime}ms`);

        // Update PaymentIntent with WooCommerce order number
        try {
          const stripe = initializeStripe();
          const retrievedPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntent.id);
          
          await stripe.paymentIntents.update(paymentIntent.id, {
            description: `Order #${order.number} - Wasgeurtje`,
            metadata: {
              ...retrievedPaymentIntent.metadata,
              order_id: order.id.toString(),
              order_number: order.number.toString(),
            },
          });
          console.log('✅ PaymentIntent updated - Order #' + order.number + ' linked to PaymentIntent');
        } catch (updateError) {
          console.error('⚠️ Failed to update PaymentIntent:', updateError);
          // Don't fail the whole process if this update fails
        }

        const totalProcessingTime = Date.now() - webhookStartTime;
        const paymentIntentUpdateTime = Date.now() - orderCreationStart - orderCreationTime;
        
        console.log('🎉 [STEP 2] Order processing completed successfully:', {
          paymentIntentId: paymentIntent.id,
          wooCommerceOrderId: order.id,
          orderNumber: order.number,
          totalProcessingTime: `${totalProcessingTime}ms`,
          orderCreationTime: `${orderCreationTime}ms`,
          paymentIntentUpdateTime: `${paymentIntentUpdateTime}ms`,
          simulation: isSimulation
        });

        return NextResponse.json({
          success: true,
          orderId: order.id,
          orderNumber: order.number,
          paymentIntentId: paymentIntent.id,
          simulation: isSimulation,
          processingTime: totalProcessingTime,
          orderCreationTime,
          duplicateCheckTime,
          approach: 'new_order_creation',
          message: `Order #${order.number} created successfully ${isSimulation ? '(simulated)' : '(real webhook)'} in ${totalProcessingTime}ms`
        });

      } catch (error) {
        console.error('💥 Error processing payment webhook:', error);
        
        return NextResponse.json({
          success: false,
          error: 'Order creation failed',
          details: error instanceof Error ? error.message : 'Unknown error',
          paymentIntentId: paymentIntent.id,
          simulation: isSimulation
        });
      }
    }

    // Handle other event types if needed
    console.log('⚠️ Unhandled webhook event type:', event.type);
    return NextResponse.json({ 
      received: true, 
      message: `Event type ${event.type} received but not handled`,
      simulation: isSimulation
    });

  } catch (error) {
    console.error('💥 Webhook processing error:', error);
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

