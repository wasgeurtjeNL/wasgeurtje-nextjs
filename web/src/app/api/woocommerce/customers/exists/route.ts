import { NextRequest, NextResponse } from 'next/server';

const WORDPRESS_API_URL = process.env.NEXT_PUBLIC_WORDPRESS_API_URL || 'https://wasgeurtje.nl/wp-json';
const WOOCOMMERCE_CONSUMER_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY!;
const WOOCOMMERCE_CONSUMER_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET!;

// Create WooCommerce authentication header
const getWooCommerceAuthHeader = () => {
  if (!WOOCOMMERCE_CONSUMER_KEY || !WOOCOMMERCE_CONSUMER_SECRET) {
    throw new Error('WooCommerce API credentials are not configured');
  }
  
  const authHeader = 'Basic ' + Buffer.from(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`).toString('base64');
  return authHeader;
};

/**
 * Check if a user/customer exists by email
 * This endpoint checks both WooCommerce customers AND WordPress users
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Checking if email exists:', email);

    // First try WooCommerce customers API
    try {
      const wcResponse = await fetch(
        `https://wasgeurtje.nl/wp-json/wc/v3/customers?email=${encodeURIComponent(email)}`,
        {
          headers: {
            'Authorization': getWooCommerceAuthHeader(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (wcResponse.ok) {
        const customers = await wcResponse.json();
        if (customers && customers.length > 0) {
          console.log('✅ Found as WooCommerce customer:', email);
          return NextResponse.json({
            exists: true,
            type: 'woocommerce_customer',
            user: {
              id: customers[0].id,
              email: customers[0].email,
              first_name: customers[0].first_name,
              last_name: customers[0].last_name
            }
          });
        }
      }
    } catch (error) {
      console.log('WooCommerce customer check failed:', error);
    }

    // If not found as WooCommerce customer, check WordPress users
    // We'll use the WP REST API to check if a user exists
    try {
      // Try to fetch user by email using WordPress REST API
      // Note: This requires authentication, so we use WooCommerce credentials
      const wpResponse = await fetch(
        `${WORDPRESS_API_URL}/wp/v2/users?search=${encodeURIComponent(email)}`,
        {
          headers: {
            'Authorization': getWooCommerceAuthHeader(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (wpResponse.ok) {
        const users = await wpResponse.json();
        // Check if any user has this exact email (case-insensitive)
        const matchingUser = users.find((u: any) => 
          u.email && u.email.toLowerCase() === email.toLowerCase()
        );
        
        if (matchingUser) {
          console.log('✅ Found as WordPress user:', email);
          return NextResponse.json({
            exists: true,
            type: 'wordpress_user',
            user: {
              id: matchingUser.id,
              email: matchingUser.email,
              name: matchingUser.name,
              username: matchingUser.slug
            }
          });
        }
      }
    } catch (error) {
      console.log('WordPress user check failed:', error);
    }

    console.log('❌ Email not found:', email);
    return NextResponse.json({
      exists: false
    });

  } catch (error) {
    console.error('Email existence check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

