// Script to manually create the missing WooCommerce order
// Order details from Stripe Payment Intent: pi_1SPi0zJdU1452TfM1sEC2YsZ

const WC_API_URL = "https://api.wasgeurtje.nl/wp-json/wc/v3";
const CK = process.env.WOOCOMMERCE_CONSUMER_KEY;
const CS = process.env.WOOCOMMERCE_CONSUMER_SECRET;

function wcHeaders() {
  const token = Buffer.from(`${CK}:${CS}`).toString("base64");
  return {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json",
  };
}

async function createOrder() {
  const orderData = {
    payment_method: "stripe_ideal",
    payment_method_title: "iDEAL",
    set_paid: true, // Mark as paid since Stripe payment succeeded
    transaction_id: "pi_1SPi0zJdU1452TfM1sEC2YsZ",
    billing: {
      first_name: "Mandy",
      last_name: "ten Brink",
      address_1: "Bamboepad 25",
      address_2: "",
      city: "Purmerend",
      state: "",
      postcode: "1448 BL",
      country: "NL",
      email: "tenbrinkie@yahoo.com",
      phone: "06 28097810",
    },
    shipping: {
      first_name: "Mandy",
      last_name: "ten Brink",
      address_1: "Bamboepad 25",
      address_2: "",
      city: "Purmerend",
      state: "",
      postcode: "1448 BL",
      country: "NL",
      phone: "06 28097810",
    },
    line_items: [
      {
        product_id: 334999, // Wasparfum – Luxe Aroma (Proefpakket)
        quantity: 1,
      },
      {
        product_id: 267628, // Nieuwe geurcollectie proefpakket
        quantity: 1,
      },
    ],
    shipping_lines: [
      {
        method_id: "flat_rate",
        method_title: "PostNL Track&Trace",
        total: "4.95",
      },
    ],
    meta_data: [
      {
        key: "_payment_intent_id",
        value: "pi_1SPi0zJdU1452TfM1sEC2YsZ",
      },
      {
        key: "_stripe_currency",
        value: "EUR",
      },
      {
        key: "_wc_stripe_mode",
        value: "live",
      },
      {
        key: "_wc_stripe_charge_status",
        value: "succeeded",
      },
      {
        key: "_created_via_recovery",
        value: "Manual recovery - webhook failed",
      },
      {
        key: "_recovery_date",
        value: new Date().toISOString(),
      },
    ],
  };

  console.log("Creating WooCommerce order...");
  console.log(JSON.stringify(orderData, null, 2));

  try {
    const response = await fetch(`${WC_API_URL}/orders`, {
      method: "POST",
      headers: wcHeaders(),
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WooCommerce API error: ${response.status} - ${errorText}`);
    }

    const order = await response.json();
    console.log("\n✅ Order created successfully!");
    console.log(`Order ID: ${order.id}`);
    console.log(`Order Number: ${order.number}`);
    console.log(`Status: ${order.status}`);
    console.log(`Total: €${order.total}`);
    console.log(`Customer: ${order.billing.first_name} ${order.billing.last_name}`);
    console.log(`Email: ${order.billing.email}`);
    console.log(`\nView order: https://wasgeurtje.nl/wp-admin/post.php?post=${order.id}&action=edit`);

    return order;
  } catch (error) {
    console.error("\n❌ Error creating order:", error);
    throw error;
  }
}

// Run the script
createOrder()
  .then(() => {
    console.log("\n✅ Recovery completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Recovery failed:", error);
    process.exit(1);
  });
