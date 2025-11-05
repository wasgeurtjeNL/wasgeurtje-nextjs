import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// Initialize Stripe
function initializeStripe() {
  const secretKey =
    process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_for_development";

  // For development, use a placeholder that will cause a controlled error
  if (secretKey === "sk_test_placeholder_for_development") {
    console.warn(
      "⚠️  Using placeholder Stripe key. Please configure STRIPE_SECRET_KEY in .env.local"
    );
  }

  return new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil",
  });
}

// WooCommerce credentials
const WC_API_URL =
  process.env.WC_API_URL || "https://api.wasgeurtje.nl/wp-json/wc/v3";
const CK = process.env.WOOCOMMERCE_CONSUMER_KEY!;
const CS = process.env.WOOCOMMERCE_CONSUMER_SECRET!;

function wcHeaders() {
  const token = Buffer.from(`${CK}:${CS}`).toString("base64");
  return {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json",
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
  country: string;
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

// Product ID mapping from cart IDs to WooCommerce IDs
function mapCartIdToWooCommerceId(cartId: string): string {
  const idMapping: Record<string, string> = {
    "trial-pack": "334999", // Proefpakket - 5 Geuren
    "full-moon": "1425", // Full Moon
    "blossom-drip": "1410", // Blossom Drip
    "flower-rain": "274", // Flower Rain (if needed)
    "sweet-fog": "275", // Sweet Fog (if needed)
  };

  // Return mapped ID if exists, otherwise return original ID
  return idMapping[cartId] || cartId;
}

// 🏪 STEP 3: Create pending WooCommerce order before payment
async function createPendingWooCommerceOrder(orderData: {
  lineItems: Array<{ id: string; originalId: string; quantity: number }>;
  customer: Customer;
  appliedDiscount?: AppliedDiscount;
  totals: {
    subtotal: number;
    discountAmount: number;
    volumeDiscount: number;
    bundleDiscount?: number;
    shippingCost: number;
    finalTotal: number;
  };
}) {
  try {
    const { lineItems, customer, appliedDiscount, totals } = orderData;

    console.log('🏪 [STEP 3] Preparing pending order data...');

    // Prepare billing address
    const billingAddress = {
      first_name: customer.firstName,
      last_name: customer.lastName,
      company: customer.companyName || '',
      address_1: `${customer.address} ${customer.houseNumber}${customer.houseAddition ? ' ' + customer.houseAddition : ''}`,
      address_2: '',
      city: customer.city,
      state: '',
      postcode: customer.postcode,
      country: customer.country?.toUpperCase() || 'NL',
      email: customer.email,
      phone: customer.phone,
    };

    // Prepare shipping address
    const shippingAddress = customer.useShippingAddress ? {
      first_name: customer.firstName,
      last_name: customer.lastName,
      company: customer.companyName || '',
      address_1: `${customer.shippingAddress} ${customer.shippingHouseNumber}${customer.shippingHouseAddition ? ' ' + customer.shippingHouseAddition : ''}`,
      address_2: '',
      city: customer.shippingCity,
      state: '',
      postcode: customer.shippingPostcode,
      country: customer.country?.toUpperCase() || 'NL',
    } : billingAddress;

    // Prepare line items
    const wcLineItems = lineItems.map(item => ({
      product_id: parseInt(item.id),
      quantity: item.quantity,
    }));

    // Prepare coupon lines
    const couponLines = [];
    if (appliedDiscount) {
      couponLines.push({
        code: appliedDiscount.coupon_code,
      });
    }

    // Prepare fee lines for discounts
    const feeLines = [];
    if (totals.volumeDiscount > 0) {
      feeLines.push({
        name: "Volume korting (10%)",
        total: (-totals.volumeDiscount).toString(),
      });
    }
    if (totals.bundleDiscount && totals.bundleDiscount > 0) {
      feeLines.push({
        name: "Bundle korting",
        total: (-totals.bundleDiscount).toString(),
      });
    }

    // Prepare shipping lines
    const shippingLines = [];
    if (totals.shippingCost > 0) {
      shippingLines.push({
        method_id: "flat_rate",
        method_title: "Standaard verzending",
        total: totals.shippingCost.toString(),
      });
    } else {
      shippingLines.push({
        method_id: "free_shipping",
        method_title: "Gratis verzending",
        total: "0.00",
      });
    }

    // Create pending WooCommerce order
    const pendingOrderData = {
      status: 'pending', // 🎯 PENDING until payment confirmed
      payment_method: 'stripe',
      payment_method_title: 'Stripe (Pending Payment)',
      set_paid: false, // 🎯 NOT PAID yet
      billing: billingAddress,
      shipping: shippingAddress,
      line_items: wcLineItems,
      coupon_lines: couponLines,
      fee_lines: feeLines,
      shipping_lines: shippingLines,
      meta_data: [
        {
          key: '_payment_method',
          value: 'stripe_pending',
        },
        {
          key: '_order_created_via',
          value: 'pre_payment_creation',
        },
        {
          key: '_order_created_at',
          value: new Date().toISOString(),
        },
      ],
    };

    console.log("🏪 [STEP 3] Creating pending order in WooCommerce...");
    const response = await fetch(`${WC_API_URL}/orders`, {
      method: 'POST',
      headers: wcHeaders(),
      body: JSON.stringify(pendingOrderData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [STEP 3] Failed to create pending order:', response.status, errorText);
      throw new Error(`WooCommerce pending order creation failed: ${response.status} - ${errorText}`);
    }

    const order = await response.json();
    console.log(`✅ [STEP 3] Pending order created successfully: #${order.number} (ID: ${order.id})`);
    
    return order;

  } catch (error) {
    console.error('💥 [STEP 3] Error creating pending WooCommerce order:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lineItems, customer, appliedDiscount, totals } = (await request.json()) as {
      lineItems: LineItem[];
      customer: Customer;
      appliedDiscount?: AppliedDiscount;
      totals?: {
        subtotal: number;
        discountAmount: number;
        volumeDiscount: number;
        bundleDiscount?: number;
        shippingCost: number;
        finalTotal: number;
      };
    };

    // DEBUG: Request data - lineItemsCount, lineItems, customerEmail, appliedDiscount

    if (!lineItems || lineItems.length === 0) {
      console.error("❌ No line items provided");
      return NextResponse.json(
        { error: "Geen producten in winkelwagen" },
        { status: 400 }
      );
    }

    if (!customer.email) {
      console.error("❌ No customer email provided");
      return NextResponse.json(
        { error: "E-mailadres is verplicht" },
        { status: 400 }
      );
    }

    // If totals are provided by frontend, use them (preferred method)
    if (totals && totals.finalTotal) {
      console.log("✅ Using totals from frontend:", totals);
      
      const finalTotal = totals.finalTotal;
      const amountInCents = Math.round(finalTotal * 100);
      
      console.log(`💳 Amount for Stripe: ${amountInCents} cents (€${finalTotal})`);
      
      // Prepare mapped line items for metadata
      const mappedLineItems = lineItems.map((item) => ({
        id: mapCartIdToWooCommerceId(item.id),
        originalId: item.id,
        quantity: item.quantity,
      }));

      // 🏪 STEP 3: Create pending WooCommerce order BEFORE payment
      console.log("🏪 [STEP 3] Creating pending WooCommerce order before payment...");
      const preOrderStart = Date.now();
      
      const pendingOrder = await createPendingWooCommerceOrder({
        lineItems: mappedLineItems,
        customer,
        appliedDiscount,
        totals
      });
      
      const preOrderTime = Date.now() - preOrderStart;
      console.log(`✅ [STEP 3] Pending order created: #${pendingOrder.number} (ID: ${pendingOrder.id}) in ${preOrderTime}ms`);

      // Initialize Stripe
      const stripe = initializeStripe();

      // Create PaymentIntent with frontend totals
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "eur",
        payment_method_types: ["ideal", "card", "bancontact"],
        automatic_payment_methods: {
          enabled: false,
        },
        metadata: {
          cart: JSON.stringify(mappedLineItems),
          customer_email: customer.email,
          customer_name: `${customer.firstName} ${customer.lastName}`,
          customer_data: JSON.stringify(customer),
          applied_discount: appliedDiscount
            ? JSON.stringify(appliedDiscount)
            : "",
          subtotal: totals.subtotal.toString(),
          discount_amount: totals.discountAmount.toString(),
          volume_discount: totals.volumeDiscount.toString(),
          shipping_cost: totals.shippingCost.toString(),
          final_total: totals.finalTotal.toString(),
          // 🎯 STEP 3: Include WooCommerce order info for instant access
          woocommerce_order_id: pendingOrder.id.toString(),
          woocommerce_order_number: pendingOrder.number.toString(),
          order_status: 'pending_payment',
          order_created_at: new Date().toISOString(),
          pre_order_creation_time: preOrderTime.toString(),
        },
        description: `Order #${pendingOrder.number} - Wasgeurtje`,
        receipt_email: customer.email,
      });

      console.log("📤 [STEP 3] Returning success response with pre-created order info...");
      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: finalTotal,
        currency: "eur",
        // 🎯 STEP 3: Return order info immediately
        orderNumber: pendingOrder.number,
        orderId: pendingOrder.id,
        orderStatus: 'pending_payment',
        preOrderCreationTime: preOrderTime,
        message: `Order #${pendingOrder.number} created and ready for payment (${preOrderTime}ms)`
      });
    }

    console.log("⚠️ No totals provided, falling back to backend calculation");

    // Check if Stripe is properly configured
    // DEBUG: 🔑 Checking Stripe configuration...');
    const secretKey = process.env.STRIPE_SECRET_KEY;
    // DEBUG: 🔑 STRIPE_SECRET_KEY present:', !!secretKey);
    // DEBUG: 🔑 STRIPE_SECRET_KEY value (first 20 chars):', secretKey?.substring(0, 20) || 'NOT SET');

    if (!secretKey || secretKey === "sk_test_placeholder_for_development") {
      console.error("❌ Stripe not configured properly");
      return NextResponse.json(
        {
          error:
            "Stripe is niet geconfigureerd. Voeg STRIPE_SECRET_KEY toe aan .env.local",
          setup_required: true,
        },
        { status: 500 }
      );
    }

    // DEBUG: ✅ Stripe initialized successfully');
    const stripe = initializeStripe();

    // Calculate total amount by fetching product prices from WooCommerce
    // DEBUG: 🛍️ Starting product fetching and price calculation...');
    let subtotal = 0;
    const productDetails = [];

    for (const item of lineItems) {
      try {
        // Map cart ID to WooCommerce ID
        const wooCommerceId = mapCartIdToWooCommerceId(item.id);
        // DEBUG: 🔄 Mapping cart ID '${item.id}' to WooCommerce ID '${wooCommerceId}'`);

        // DEBUG: 📡 Fetching product ${wooCommerceId} from WooCommerce...`);
        const response = await fetch(
          `${WC_API_URL}/products/${wooCommerceId}`,
          {
            method: "GET",
            headers: wcHeaders(),
          }
        );

        // DEBUG: 📡 WooCommerce response for product ${wooCommerceId}:`, response.status, response.statusText);

        if (!response.ok) {
          console.error(
            `❌ Failed to fetch product ${wooCommerceId} (original: ${item.id}):`,
            response.status
          );
          const errorText = await response.text();
          console.error(`❌ Error response body:`, errorText);
          continue;
        }

        const product = await response.json();
        // DEBUG: Product fetched successfully - name, price, status

        const price = parseFloat(product.price);
        const itemTotal = price * item.quantity;
        subtotal += itemTotal;

        productDetails.push({
          id: wooCommerceId, // Use WooCommerce ID for further processing
          originalId: item.id, // Keep original cart ID for reference
          name: product.name,
          price: price,
          quantity: item.quantity,
          total: itemTotal,
        });

        // DEBUG: 💰 Product ${wooCommerceId} added: €${price} x ${item.quantity} = €${itemTotal}`);
      } catch (error) {
        console.error(`❌ Error fetching product ${item.id}:`, error);
        console.error(`❌ Error details:`, error.message, error.stack);
      }
    }

    // DEBUG: 💰 Products processing complete. Subtotal: €${subtotal}`);
    // DEBUG: 📦 Product details:`, productDetails);

    // Apply discount if present
    // DEBUG: 🎟️ Processing discounts...');
    // DEBUG: 🎟️ Applied discount object:', appliedDiscount);
    let discountAmount = 0;
    if (appliedDiscount) {
      discountAmount = appliedDiscount.discount_amount;
      // DEBUG: 🎟️ Applied discount: ${appliedDiscount.coupon_code} = €${discountAmount}`);
      // DEBUG: 🎟️ Discount type: ${appliedDiscount.discount_type}`);
    } else {
      // DEBUG: 🎟️ No discount applied');
    }

    // Apply volume discount (10% if subtotal >= €75)
    let volumeDiscount = 0;
    if (subtotal >= 75) {
      volumeDiscount = subtotal * 0.1;
      // DEBUG: 📦 Volume discount applied: €${volumeDiscount} (10%)`);
    } else {
      // DEBUG: 📦 No volume discount (subtotal €${subtotal} < €75)`);
    }

    // Calculate shipping (free if subtotal >= €40)
    const shippingCost = subtotal >= 40 ? 0 : 4.95;
    console.log(
      `🚚 Shipping cost: €${shippingCost} (${subtotal >= 40 ? "FREE" : "PAID"})`
    );

    // Calculate final total
    const finalTotal =
      subtotal - discountAmount - volumeDiscount + shippingCost;
    // DEBUG: 💰 Final calculation: €${subtotal} - €${discountAmount} - €${volumeDiscount} + €${shippingCost} = €${finalTotal}`);

    // Convert to cents for Stripe
    const amountInCents = Math.round(finalTotal * 100);
    console.log(
      `💳 Amount for Stripe: ${amountInCents} cents (€${finalTotal})`
    );

    // DEBUG: Complete order calculation - subtotal, discountAmount, volumeDiscount, shippingCost, finalTotal, amountInCents

    // Prepare mapped line items for metadata (using WooCommerce IDs)
    // DEBUG: 📋 Preparing metadata...');
    const mappedLineItems = lineItems.map((item) => ({
      id: mapCartIdToWooCommerceId(item.id),
      originalId: item.id,
      quantity: item.quantity,
    }));

    // DEBUG: 📋 Mapped line items for metadata:', mappedLineItems);

    // Generate a unique order reference for tracking
    const orderReference = `WG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    console.log("📝 Generated order reference:", orderReference);

    // Create PaymentIntent
    console.log("💳 Creating Stripe PaymentIntent...");
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "eur",
      payment_method_types: ["ideal", "card", "bancontact"], // Prioritize iDEAL
      automatic_payment_methods: {
        enabled: false, // Disable automatic payment methods to prevent unwanted methods
      },
      metadata: {
        // Store order data in metadata for webhook processing (using mapped WooCommerce IDs)
        cart: JSON.stringify(mappedLineItems),
        customer_email: customer.email,
        customer_name: `${customer.firstName} ${customer.lastName}`,
        customer_data: JSON.stringify(customer),
        applied_discount: appliedDiscount
          ? JSON.stringify(appliedDiscount)
          : "",
        subtotal: subtotal.toString(),
        discount_amount: discountAmount.toString(),
        volume_discount: volumeDiscount.toString(),
        shipping_cost: shippingCost.toString(),
        final_total: finalTotal.toString(),
        order_reference: orderReference,
      },
      description: `Wasgeurtje - Bestelling ${orderReference}`,
      receipt_email: customer.email,
    });

    // DEBUG: PaymentIntent created successfully - id, client_secret, amount, currency, status

    console.log("📤 Returning success response...");
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: finalTotal,
      currency: "eur",
    });
  } catch (error) {
    console.error("❌ === ERROR IN CREATE-INTENT API ===");
    console.error("❌ Error type:", error.constructor.name);
    console.error("❌ Error message:", error.message);
    console.error("❌ Error stack:", error.stack);

    // Log specific error details if it's a Stripe error
    if (error.type) {
      console.error("❌ Stripe error type:", error.type);
      console.error("❌ Stripe error code:", error.code);
      console.error("❌ Stripe error param:", error.param);
    }

    // Log more details about the error
    console.error("❌ Full error object:", error);

    return NextResponse.json(
      {
        error: "Er is een fout opgetreden bij het verwerken van de betaling",
        debug:
          process.env.NODE_ENV === "development"
            ? {
                message: error.message,
                type: error.constructor.name,
                stripeType: error.type || "N/A",
                stripeCode: error.code || "N/A",
              }
            : undefined,
      },
      { status: 500 }
    );
  }
}
