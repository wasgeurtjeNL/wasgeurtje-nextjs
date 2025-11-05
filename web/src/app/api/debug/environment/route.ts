import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Collect environment variables (server-side only)
    const envVars = {
      // API Configuration
      API_BASE_URL: process.env.API_BASE_URL || 'NOT SET',
      WOOCOMMERCE_API_URL: process.env.WOOCOMMERCE_API_URL || 'NOT SET',
      
      // Client-side variables (these should be available)
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'NOT SET',
      NEXT_PUBLIC_WORDPRESS_API_URL: process.env.NEXT_PUBLIC_WORDPRESS_API_URL || 'NOT SET',
      NEXT_PUBLIC_WOOCOMMERCE_API_URL: process.env.NEXT_PUBLIC_WOOCOMMERCE_API_URL || 'NOT SET',
      
      // Node environment
      NODE_ENV: process.env.NODE_ENV || 'NOT SET',
      VERCEL: process.env.VERCEL || 'NOT SET',
      VERCEL_ENV: process.env.VERCEL_ENV || 'NOT SET',
      
      // Check if sensitive keys exist (without exposing them)
      HAS_WOOCOMMERCE_CONSUMER_KEY: !!process.env.WOOCOMMERCE_CONSUMER_KEY,
      HAS_WOOCOMMERCE_CONSUMER_SECRET: !!process.env.WOOCOMMERCE_CONSUMER_SECRET,
      HAS_STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
      
      // Timestamp
      timestamp: new Date().toISOString()
    };

    // Test API connectivity
    const apiTests = {
      direct_api_reachable: false,
      direct_api_response_time: 0,
      direct_api_error: null
    };

    try {
      const startTime = Date.now();
      const response = await fetch('https://api.wasgeurtje.nl/wp-json/wp/v2/', {
        method: 'HEAD',
        timeout: 5000
      });
      apiTests.direct_api_reachable = response.ok;
      apiTests.direct_api_response_time = Date.now() - startTime;
    } catch (error) {
      apiTests.direct_api_error = error instanceof Error ? error.message : 'Unknown error';
    }

    return NextResponse.json({
      success: true,
      environment: envVars,
      api_connectivity: apiTests,
      recommendations: generateRecommendations(envVars, apiTests)
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

function generateRecommendations(envVars: any, apiTests: any) {
  const recommendations = [];

  // Check for missing environment variables
  if (envVars.API_BASE_URL === 'NOT SET') {
    recommendations.push({
      type: 'error',
      message: 'API_BASE_URL is not set. This is required for server-side API calls.'
    });
  }

  if (envVars.NEXT_PUBLIC_API_BASE_URL === 'NOT SET') {
    recommendations.push({
      type: 'warning', 
      message: 'NEXT_PUBLIC_API_BASE_URL is not set. Client-side components may fall back to hardcoded URLs.'
    });
  }

  // Check API connectivity
  if (!apiTests.direct_api_reachable) {
    recommendations.push({
      type: 'error',
      message: `Cannot reach api.wasgeurtje.nl directly. Error: ${apiTests.direct_api_error}`
    });
  } else if (apiTests.direct_api_response_time > 2000) {
    recommendations.push({
      type: 'warning',
      message: `API response time is slow (${apiTests.direct_api_response_time}ms). Consider using proxy for better performance.`
    });
  }

  // Check for missing credentials
  if (!envVars.HAS_WOOCOMMERCE_CONSUMER_KEY || !envVars.HAS_WOOCOMMERCE_CONSUMER_SECRET) {
    recommendations.push({
      type: 'error',
      message: 'WooCommerce API credentials are missing. This will cause authentication failures.'
    });
  }

  // Environment-specific recommendations
  if (envVars.NODE_ENV === 'production' && envVars.API_BASE_URL !== 'https://api.wasgeurtje.nl') {
    recommendations.push({
      type: 'warning',
      message: 'In production, API_BASE_URL should point to https://api.wasgeurtje.nl'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'success',
      message: 'All environment variables and API connectivity look good!'
    });
  }

  return recommendations;
}
