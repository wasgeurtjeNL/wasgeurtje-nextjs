import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// Initialize Stripe
function initializeStripe() {
  const secretKey =
    process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_for_development";

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

  return idMapping[cartId] || cartId;
}

export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId, lineItems, customer, appliedDiscount, totals } = (await request.json()) as {
      paymentIntentId: string;
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

    if (!paymentIntentId) {
      console.error("❌ No payment intent ID provided");
      return NextResponse.json(
        { error: "Payment Intent ID is verplicht" },
        { status: 400 }
      );
    }

    if (!lineItems || lineItems.length === 0) {
      console.error("❌ No line items provided");
      return NextResponse.json(
        { error: "Geen producten in winkelwagen" },
        { status: 400 }
      );
    }

    // Initialize Stripe
    const stripe = initializeStripe();

    // If totals are provided by frontend, use them (preferred method)
    if (totals && totals.finalTotal) {
      console.log("✅ Using totals from frontend for update:", totals);
      
      const finalTotal = totals.finalTotal;
      const amountInCents = Math.round(finalTotal * 100);
      
      console.log(`💳 Updating PaymentIntent ${paymentIntentId} with amount: ${amountInCents} cents (€${finalTotal})`);
      
      // Prepare mapped line items for metadata
      const mappedLineItems = lineItems.map((item) => ({
        id: mapCartIdToWooCommerceId(item.id),
        originalId: item.id,
        quantity: item.quantity,
      }));

      // Retrieve existing PaymentIntent to get order_reference if it exists
      const existingPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const orderReference = existingPaymentIntent.metadata.order_reference || 
                             `WG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      console.log("📝 Using order reference:", orderReference);

      // Update PaymentIntent with frontend totals
      const paymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
        amount: amountInCents,
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
          order_reference: orderReference,
        },
        description: `Wasgeurtje - Bestelling ${orderReference}`,
        receipt_email: customer.email,
      });

      console.log("✅ PaymentIntent updated successfully");
      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: finalTotal,
        currency: "eur",
      });
    }

    console.log("⚠️ No totals provided, falling back to backend calculation");

    if (!customer.email) {
      console.error("❌ No customer email provided");
      return NextResponse.json(
        { error: "E-mailadres is verplicht" },
        { status: 400 }
      );
    }

    // Check if Stripe is properly configured
    const secretKey = process.env.STRIPE_SECRET_KEY;

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

    // stripe is already initialized at line 115, no need to declare again

    // Calculate total amount by fetching product prices from WooCommerce
    let subtotal = 0;
    const productDetails = [];

    for (const item of lineItems) {
      try {
        const wooCommerceId = mapCartIdToWooCommerceId(item.id);

        const response = await fetch(
          `${WC_API_URL}/products/${wooCommerceId}`,
          {
            method: "GET",
            headers: wcHeaders(),
          }
        );

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

        const price = parseFloat(product.price);
        const itemTotal = price * item.quantity;
        subtotal += itemTotal;

        productDetails.push({
          id: wooCommerceId,
          originalId: item.id,
          name: product.name,
          price: price,
          quantity: item.quantity,
          total: itemTotal,
        });
      } catch (error) {
        console.error(`❌ Error fetching product ${item.id}:`, error);
      }
    }

    // Apply discount if present
    let discountAmount = 0;
    if (appliedDiscount) {
      discountAmount = appliedDiscount.discount_amount;
    }

    // Apply volume discount (10% if subtotal >= €75)
    let volumeDiscount = 0;
    if (subtotal >= 75) {
      volumeDiscount = subtotal * 0.1;
    }

    // Calculate shipping (free if subtotal >= €29)
    const shippingCost = subtotal >= 29 ? 0 : 1.95;

    // Calculate final total
    const finalTotal =
      subtotal - discountAmount - volumeDiscount + shippingCost;

    // Convert to cents for Stripe
    const amountInCents = Math.round(finalTotal * 100);
    console.log(
      `🔄 Updating PaymentIntent ${paymentIntentId} with amount: ${amountInCents} cents (€${finalTotal})`
    );

    // Prepare mapped line items for metadata
    const mappedLineItems = lineItems.map((item) => ({
      id: mapCartIdToWooCommerceId(item.id),
      originalId: item.id,
      quantity: item.quantity,
    }));

    // Retrieve existing PaymentIntent to get order_reference if it exists
    const existingPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const orderReference = existingPaymentIntent.metadata.order_reference || 
                           `WG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    console.log("📝 Using order reference:", orderReference);

    // Update PaymentIntent
    const paymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
      amount: amountInCents,
      metadata: {
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

    console.log("✅ PaymentIntent updated successfully");
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: finalTotal,
      currency: "eur",
    });
  } catch (error) {
    console.error("❌ === ERROR IN UPDATE-INTENT API ===");
    console.error("❌ Error type:", error.constructor.name);
    console.error("❌ Error message:", error.message);
    console.error("❌ Error stack:", error.stack);

    if (error.type) {
      console.error("❌ Stripe error type:", error.type);
      console.error("❌ Stripe error code:", error.code);
      console.error("❌ Stripe error param:", error.param);
    }

    return NextResponse.json(
      {
        error: "Er is een fout opgetreden bij het updaten van de betaling",
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

