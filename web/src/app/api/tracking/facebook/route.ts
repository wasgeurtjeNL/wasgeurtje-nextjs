import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Facebook Conversions API (Server-Side Tracking)
 * 
 * This API route sends events directly to Facebook from the server,
 * bypassing ad blockers and iOS 14+ restrictions.
 * 
 * Requires: FACEBOOK_CONVERSION_API_ACCESS_TOKEN in environment variables
 */

const FACEBOOK_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '834004417164714';
const ACCESS_TOKEN = process.env.FACEBOOK_CONVERSION_API_ACCESS_TOKEN;
const FACEBOOK_API_VERSION = 'v21.0';
const FACEBOOK_API_URL = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${FACEBOOK_PIXEL_ID}/events`;

/**
 * Hash user data for privacy (required by Facebook)
 */
function hashData(data: string | undefined | null): string | undefined {
  if (!data) return undefined;
  return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string | undefined {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  if (realIp) {
    return realIp.trim();
  }
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }
  
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    // Check if Access Token is configured
    if (!ACCESS_TOKEN) {
      console.error('[FB Conversions API] Access Token not configured');
      return NextResponse.json(
        { error: 'Facebook Conversions API not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { 
      eventName, 
      eventData, 
      userData = {}, 
      customData = {},
      testEventCode // For testing in Facebook Events Manager
    } = body;

    if (!eventName) {
      return NextResponse.json(
        { error: 'Event name is required' },
        { status: 400 }
      );
    }

    // Get client information
    const clientIp = getClientIP(request);
    const userAgent = request.headers.get('user-agent');

    // Build user_data with hashed PII (Privacy-Enhanced Match - required by Facebook)
    const user_data: Record<string, any> = {
      client_ip_address: clientIp,
      client_user_agent: userAgent,
    };

    // Add hashed email if provided
    if (userData.email) {
      user_data.em = hashData(userData.email);
    }

    // Add hashed phone if provided
    if (userData.phone) {
      user_data.ph = hashData(userData.phone);
    }

    // Add hashed first name if provided
    if (userData.firstName) {
      user_data.fn = hashData(userData.firstName);
    }

    // Add hashed last name if provided
    if (userData.lastName) {
      user_data.ln = hashData(userData.lastName);
    }

    // Add hashed city if provided
    if (userData.city) {
      user_data.ct = hashData(userData.city);
    }

    // Add hashed state if provided
    if (userData.state) {
      user_data.st = hashData(userData.state);
    }

    // Add hashed zip code if provided
    if (userData.zipCode) {
      user_data.zp = hashData(userData.zipCode);
    }

    // Add hashed country if provided
    if (userData.country) {
      user_data.country = hashData(userData.country);
    }

    // Add Facebook Click ID (fbclid) if available
    if (userData.fbc) {
      user_data.fbc = userData.fbc;
    }

    // Add Facebook Browser ID (fbp) if available
    if (userData.fbp) {
      user_data.fbp = userData.fbp;
    }

    // Build event data
    const eventTime = Math.floor(Date.now() / 1000); // Unix timestamp
    const eventId = eventData?.eventId || `${eventName}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const eventSourceUrl = eventData?.eventSourceUrl || request.headers.get('referer') || 'https://wasgeurtje-nextjs.vercel.app';

    const event = {
      event_name: eventName,
      event_time: eventTime,
      event_id: eventId, // Deduplication ID (same as client-side)
      event_source_url: eventSourceUrl,
      action_source: 'website', // Required: where the event occurred
      user_data: user_data,
      custom_data: customData,
    };

    // Build Facebook Conversions API payload
    const payload: Record<string, any> = {
      data: [event],
      access_token: ACCESS_TOKEN,
    };

    // Add test event code if provided (for testing in Facebook Events Manager)
    if (testEventCode) {
      payload.test_event_code = testEventCode;
    }

    // Send to Facebook Conversions API
    const response = await fetch(FACEBOOK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[FB Conversions API] Error:', result);
      return NextResponse.json(
        { error: 'Failed to send event to Facebook', details: result },
        { status: response.status }
      );
    }

    console.log('[FB Conversions API] Event sent successfully:', {
      eventName,
      eventId,
      events_received: result.events_received,
      fbtrace_id: result.fbtrace_id,
    });

    return NextResponse.json({
      success: true,
      eventId,
      events_received: result.events_received,
      fbtrace_id: result.fbtrace_id,
    });

  } catch (error) {
    console.error('[FB Conversions API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

