import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering - disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Get WordPress API base URL (without /wp-json)
const getWordPressBaseUrl = () => {
  const envUrl = process.env.WORDPRESS_API_URL || process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
  
  if (envUrl) {
    // Trim whitespace and remove /wp-json, /wp/v2, and any trailing slashes
    let baseUrl = envUrl.trim();
    
    // Remove various WordPress API path patterns
    baseUrl = baseUrl.replace(/\/wp-json.*$/, ''); // Remove /wp-json and everything after
    baseUrl = baseUrl.replace(/\/wp\/v2.*$/, ''); // Remove /wp/v2 and everything after
    baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    
    console.log('[WordPress URL] Original:', envUrl);
    console.log('[WordPress URL] Cleaned:', baseUrl);
    
    return baseUrl;
  }
  
  return "https://api.wasgeurtje.nl";
};

const WORDPRESS_BASE_URL = getWordPressBaseUrl();

/**
 * Fetch WordPress theme options (ACF Options Page)
 * This endpoint fetches ACF options including checkout_version
 */
export async function GET(request: NextRequest) {
  try {
    // Build the correct URL - uses environment variable or falls back to api.wasgeurtje.nl
    const url = `${WORDPRESS_BASE_URL}/wp-json/wasgeurtje/v1/options`;
    
    console.log('[API /wordpress/options] WordPress base URL:', WORDPRESS_BASE_URL);
    console.log('[API /wordpress/options] Fetching from:', url);
    
    // Always fetch fresh data - no caching for A/B test options
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      cache: 'no-store',
    });

    console.log('[API /wordpress/options] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API /wordpress/options] Failed to fetch WordPress options: ${response.status} ${response.statusText}`);
      console.error(`[API /wordpress/options] Error response:`, errorText);
      return NextResponse.json(
        { error: "Failed to fetch options", details: errorText },
        { status: response.status }
      );
    }

    const options = await response.json();
    console.log('[API /wordpress/options] Received options:', options);
    
    // No caching - always return fresh A/B test options
    return NextResponse.json(options, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("[API /wordpress/options] Error fetching WordPress options:", error);
    console.error("[API /wordpress/options] Error details:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

