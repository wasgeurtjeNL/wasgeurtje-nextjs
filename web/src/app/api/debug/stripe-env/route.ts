import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Collect environment variables without exposing sensitive data
    const envCheck = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      vercel_env: process.env.VERCEL_ENV,
      
      // Stripe Configuration
      stripe: {
        secret_key_exists: !!process.env.STRIPE_SECRET_KEY,
        secret_key_prefix: process.env.STRIPE_SECRET_KEY?.substring(0, 7) || 'NOT_SET',
        secret_key_length: process.env.STRIPE_SECRET_KEY?.length || 0,
        publishable_key_exists: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        publishable_key_prefix: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.substring(0, 7) || 'NOT_SET',
        webhook_secret_exists: !!process.env.STRIPE_WEBHOOK_SECRET,
        webhook_secret_length: process.env.STRIPE_WEBHOOK_SECRET?.length || 0,
      },
      
      // WooCommerce Configuration
      woocommerce: {
        api_url: process.env.WOOCOMMERCE_API_URL || process.env.WC_API_URL || 'NOT_SET',
        consumer_key_exists: !!process.env.WOOCOMMERCE_CONSUMER_KEY,
        consumer_key_prefix: process.env.WOOCOMMERCE_CONSUMER_KEY?.substring(0, 7) || 'NOT_SET',
        consumer_key_length: process.env.WOOCOMMERCE_CONSUMER_KEY?.length || 0,
        consumer_secret_exists: !!process.env.WOOCOMMERCE_CONSUMER_SECRET,
        consumer_secret_length: process.env.WOOCOMMERCE_CONSUMER_SECRET?.length || 0,
      },
      
      // API Configuration
      api: {
        base_url: process.env.API_BASE_URL || 'NOT_SET',
        public_api_base_url: process.env.NEXT_PUBLIC_API_BASE_URL || 'NOT_SET',
        wordpress_api_url: process.env.NEXT_PUBLIC_WORDPRESS_API_URL || 'NOT_SET',
      },
      
      // Test API connectivity
      connectivity_tests: {
        can_access_stripe: false,
        can_access_woocommerce: false,
        stripe_error: null,
        woocommerce_error: null
      }
    };

    // Test Stripe connectivity
    try {
      if (process.env.STRIPE_SECRET_KEY) {
        const Stripe = require('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: '2025-08-27.basil',
        });
        
        // Simple API call to test connectivity
        await stripe.paymentIntents.list({ limit: 1 });
        envCheck.connectivity_tests.can_access_stripe = true;
      }
    } catch (stripeError) {
      envCheck.connectivity_tests.stripe_error = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error';
    }

    // Test WooCommerce connectivity
    try {
      if (process.env.WOOCOMMERCE_CONSUMER_KEY && process.env.WOOCOMMERCE_CONSUMER_SECRET) {
        const wcApiUrl = process.env.WOOCOMMERCE_API_URL || process.env.WC_API_URL;
        const authHeader = 'Basic ' + Buffer.from(
          `${process.env.WOOCOMMERCE_CONSUMER_KEY}:${process.env.WOOCOMMERCE_CONSUMER_SECRET}`
        ).toString('base64');
        
        const response = await fetch(`${wcApiUrl}/orders?per_page=1`, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          envCheck.connectivity_tests.can_access_woocommerce = true;
        } else {
          envCheck.connectivity_tests.woocommerce_error = `HTTP ${response.status}: ${response.statusText}`;
        }
      }
    } catch (wcError) {
      envCheck.connectivity_tests.woocommerce_error = wcError instanceof Error ? wcError.message : 'Unknown WooCommerce error';
    }

    // Generate recommendations
    const recommendations = generateEnvironmentRecommendations(envCheck);

    return NextResponse.json({
      success: true,
      environment_check: envCheck,
      recommendations,
      summary: {
        stripe_ready: envCheck.stripe.secret_key_exists && envCheck.connectivity_tests.can_access_stripe,
        woocommerce_ready: envCheck.woocommerce.consumer_key_exists && envCheck.connectivity_tests.can_access_woocommerce,
        overall_status: determineOverallStatus(envCheck)
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

function generateEnvironmentRecommendations(envCheck: any) {
  const recommendations = [];

  // Stripe checks
  if (!envCheck.stripe.secret_key_exists) {
    recommendations.push({
      type: 'error',
      category: 'stripe',
      message: 'STRIPE_SECRET_KEY is missing. Add this to Vercel environment variables.'
    });
  } else if (envCheck.stripe.secret_key_prefix === 'sk_test') {
    recommendations.push({
      type: 'warning',
      category: 'stripe',
      message: 'Using Stripe TEST key. Switch to live key for production.'
    });
  } else if (!envCheck.connectivity_tests.can_access_stripe) {
    recommendations.push({
      type: 'error',
      category: 'stripe',
      message: `Stripe API not accessible: ${envCheck.connectivity_tests.stripe_error}`
    });
  }

  if (!envCheck.stripe.webhook_secret_exists) {
    recommendations.push({
      type: 'error',
      category: 'stripe',
      message: 'STRIPE_WEBHOOK_SECRET is missing. This will cause webhook verification to fail.'
    });
  }

  // WooCommerce checks
  if (!envCheck.woocommerce.consumer_key_exists) {
    recommendations.push({
      type: 'error',
      category: 'woocommerce',
      message: 'WOOCOMMERCE_CONSUMER_KEY is missing. Add this to Vercel environment variables.'
    });
  } else if (!envCheck.connectivity_tests.can_access_woocommerce) {
    recommendations.push({
      type: 'error',
      category: 'woocommerce',
      message: `WooCommerce API not accessible: ${envCheck.connectivity_tests.woocommerce_error}`
    });
  }

  // API URL checks
  if (envCheck.api.base_url === 'NOT_SET') {
    recommendations.push({
      type: 'warning',
      category: 'api',
      message: 'API_BASE_URL not set. Using default fallback.'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'success',
      category: 'general',
      message: 'All environment variables are properly configured!'
    });
  }

  return recommendations;
}

function determineOverallStatus(envCheck: any) {
  const hasStripe = envCheck.stripe.secret_key_exists && envCheck.connectivity_tests.can_access_stripe;
  const hasWooCommerce = envCheck.woocommerce.consumer_key_exists && envCheck.connectivity_tests.can_access_woocommerce;
  
  if (hasStripe && hasWooCommerce) {
    return 'ready';
  } else if (hasStripe || hasWooCommerce) {
    return 'partial';
  } else {
    return 'not_ready';
  }
}
