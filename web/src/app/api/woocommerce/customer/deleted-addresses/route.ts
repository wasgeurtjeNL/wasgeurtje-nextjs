import { NextRequest, NextResponse } from 'next/server';

/**
 * GET endpoint to fetch deleted addresses for a customer
 * 
 * Usage: GET /api/woocommerce/customer/deleted-addresses?email=customer@example.com
 * 
 * This endpoint calls the WordPress REST API to retrieve the list of
 * address IDs that the customer has marked as deleted. This list is
 * stored in WordPress user meta and syncs across all devices.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Email parameter is required',
          data: { deletedAddresses: [] }
        },
        { status: 400 }
      );
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid email format',
          data: { deletedAddresses: [] }
        },
        { status: 400 }
      );
    }
    
    // Get WordPress API base URL
    const baseUrl = process.env.WOOCOMMERCE_API_URL?.replace('/wp-json/wc/v3', '') 
                    || process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
    
    if (!baseUrl) {
      console.error('WOOCOMMERCE_API_URL or NEXT_PUBLIC_WORDPRESS_API_URL is not configured');
      return NextResponse.json(
        { 
          success: false,
          error: 'WordPress API URL is not configured',
          data: { deletedAddresses: [] }
        },
        { status: 500 }
      );
    }
    
    console.log('🔗 Using base URL for WordPress API:', baseUrl);
    console.log('📧 Fetching deleted addresses for:', email);
    
    // Construct endpoint URL
    const endpoint = `${baseUrl}/wp-json/custom/v1/deleted-addresses?email=${encodeURIComponent(email)}`;
    
    console.log('🔗 Calling endpoint:', endpoint);
    
    // Call WordPress REST API
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout
      signal: AbortSignal.timeout(5000),
    });
    
    console.log('📡 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ WordPress API error:', errorText);
      
      // Return empty array on error (graceful degradation)
      return NextResponse.json(
        { 
          success: false,
          error: `WordPress API returned ${response.status}`,
          message: 'Failed to fetch deleted addresses from server',
          data: { 
            deletedAddresses: [],
            fallback: true
          }
        },
        { status: 200 } // Return 200 so frontend doesn't error
      );
    }
    
    const result = await response.json();
    
    console.log('✅ Successfully fetched deleted addresses:', result);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('🚨 Error fetching deleted addresses:', error);
    
    // Check if it's a timeout error
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Request timeout',
          message: 'WordPress API did not respond in time',
          data: { 
            deletedAddresses: [],
            fallback: true
          }
        },
        { status: 200 } // Return 200 for graceful degradation
      );
    }
    
    // Return empty array on any error (graceful degradation)
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        data: { 
          deletedAddresses: [],
          fallback: true
        }
      },
      { status: 200 } // Return 200 so frontend doesn't break
    );
  }
}

