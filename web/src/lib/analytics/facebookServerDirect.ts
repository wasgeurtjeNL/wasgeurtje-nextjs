/**
 * Server-side Facebook Conversions API - Direct from Backend
 * 
 * This module allows sending Facebook events directly from Next.js API routes
 * without going through the client. Perfect for Intelligence tracking!
 * 
 * Use cases:
 * - Returning visitor recognition (send email when recognized)
 * - Anonymous event tracking (fbp/fbc only)
 * - Progressive profiling (retroactive linking)
 */

import crypto from 'crypto';

const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '834004417164714';
const ACCESS_TOKEN = process.env.FACEBOOK_CONVERSION_API_ACCESS_TOKEN;
const TEST_EVENT_CODE = process.env.NEXT_PUBLIC_FB_TEST_EVENT_CODE;

/**
 * Hash data using SHA-256 (for PII)
 */
function hashData(data: string): string {
  return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhone(phone: string, countryCode: string = '31'): string {
  let normalized = phone.replace(/[\s\-\(\)\.]/g, '');
  
  if (!normalized.startsWith('+')) {
    if (normalized.startsWith('0')) {
      normalized = normalized.substring(1);
    }
    normalized = `${countryCode}${normalized}`;
  } else {
    normalized = normalized.substring(1);
  }
  
  return normalized;
}

/**
 * Normalize country code to ISO 3166-1 alpha-2 (lowercase)
 */
function normalizeCountry(country: string): string {
  const countryMap: Record<string, string> = {
    'nederland': 'nl',
    'netherlands': 'nl',
    'nld': 'nl',
    'belgium': 'be',
    'belgie': 'be',
    'belgië': 'be',
    'germany': 'de',
    'duitsland': 'de',
  };
  
  const lower = country.toLowerCase().trim();
  return countryMap[lower] || (lower.length === 2 ? lower : 'nl');
}

/**
 * Normalize zip code
 */
function normalizeZipCode(zipCode: string, country?: string): string {
  let normalized = zipCode.replace(/[\s\-]/g, '').toLowerCase();
  
  if (country === 'us' || country === 'usa') {
    normalized = normalized.substring(0, 5);
  }
  
  return normalized;
}

interface FacebookEventOptions {
  eventName: string;
  eventId?: string;
  eventSourceUrl?: string;
  
  // User Data (will be hashed)
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  externalId?: string | number; // Customer ID
  
  // Facebook identifiers (not hashed)
  fbp?: string; // Facebook Browser ID (_fbp cookie)
  fbc?: string; // Facebook Click ID
  
  // Client info (not hashed)
  clientIpAddress?: string;
  clientUserAgent?: string;
  
  // Custom data
  value?: number;
  currency?: string;
  contentIds?: string[];
  contentType?: string;
  numItems?: number;
  
  // Additional custom data
  customData?: Record<string, any>;
}

/**
 * Send event directly to Facebook Conversions API
 * This is called from server-side routes (not from client)
 */
export async function sendFacebookEventDirect(options: FacebookEventOptions): Promise<boolean> {
  if (!ACCESS_TOKEN) {
    console.warn('[FB CAPI Direct] Access Token not configured, skipping');
    return false;
  }

  try {
    const {
      eventName,
      eventId,
      eventSourceUrl,
      email,
      phone,
      firstName,
      lastName,
      city,
      state,
      zipCode,
      country,
      externalId,
      fbp,
      fbc,
      clientIpAddress,
      clientUserAgent,
      value,
      currency = 'EUR',
      contentIds,
      contentType,
      numItems,
      customData = {},
    } = options;

    // Build user_data
    const user_data: Record<string, any> = {};

    // Add client info (not hashed)
    if (clientIpAddress) user_data.client_ip_address = clientIpAddress;
    if (clientUserAgent) user_data.client_user_agent = clientUserAgent;
    if (fbp) user_data.fbp = fbp;
    if (fbc) user_data.fbc = fbc;

    // Normalize country first (needed for phone and zip)
    const normalizedCountry = country ? normalizeCountry(country) : 'nl';
    user_data.country = hashData(normalizedCountry);

    // Add hashed PII
    if (email) user_data.em = hashData(email);
    if (phone) user_data.ph = hashData(normalizePhone(phone, normalizedCountry === 'nl' ? '31' : '1'));
    if (firstName) user_data.fn = hashData(firstName);
    if (lastName) user_data.ln = hashData(lastName);
    if (city) user_data.ct = hashData(city);
    if (state) user_data.st = hashData(state);
    if (zipCode) user_data.zp = hashData(normalizeZipCode(zipCode, normalizedCountry));
    if (externalId) user_data.external_id = hashData(String(externalId));

    // Build custom_data
    const custom_data: Record<string, any> = {
      ...customData,
    };

    if (value !== undefined) custom_data.value = value;
    if (currency) custom_data.currency = currency;
    if (contentIds) custom_data.content_ids = contentIds;
    if (contentType) custom_data.content_type = contentType;
    if (numItems !== undefined) custom_data.num_items = numItems;

    // Build event
    // 🎯 OPTIMIZATION 5: Improved deduplication with timestamp-based event ID
    const event = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000), // Use seconds (not milliseconds) for better deduplication
      event_id: eventId || `${eventName}_${Math.floor(Date.now() / 1000)}_${Math.random().toString(36).substring(7)}`,
      event_source_url: eventSourceUrl || 'https://wasgeurtje-nextjs.vercel.app',
      action_source: 'website',
      user_data,
      custom_data,
    };

    // Build request payload
    const payload = {
      data: [event],
      test_event_code: TEST_EVENT_CODE,
    };

    // Send to Facebook
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[FB CAPI Direct] Error response:', errorData);
      return false;
    }

    const result = await response.json();
    
    console.log('[FB CAPI Direct] ✅ Event sent:', {
      eventName,
      eventId: event.event_id,
      hasEmail: !!email,
      hasExternalId: !!externalId,
      fbpId: fbp ? fbp.substring(0, 20) + '...' : 'none',
      eventsReceived: result.events_received,
    });

    return true;
  } catch (error) {
    console.error('[FB CAPI Direct] Error sending event:', error);
    return false;
  }
}

/**
 * Track PageView from Intelligence System
 */
export async function trackIntelligencePageView(options: {
  email?: string;
  customerId?: string | number;
  fbp?: string;
  fbc?: string;
  clientIp?: string;
  userAgent?: string;
  pageUrl?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
}) {
  return sendFacebookEventDirect({
    eventName: 'PageView',
    eventSourceUrl: options.pageUrl,
    email: options.email,
    externalId: options.customerId,
    fbp: options.fbp,
    fbc: options.fbc,
    clientIpAddress: options.clientIp,
    clientUserAgent: options.userAgent,
    phone: options.phone,
    city: options.city,
    state: options.state,
    country: options.country,
  });
}

/**
 * Track ViewContent from Intelligence System
 */
export async function trackIntelligenceViewContent(options: {
  email?: string;
  customerId?: string | number;
  fbp?: string;
  fbc?: string;
  clientIp?: string;
  userAgent?: string;
  pageUrl?: string;
  contentIds?: string[];
  contentName?: string;
  value?: number;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
}) {
  return sendFacebookEventDirect({
    eventName: 'ViewContent',
    eventSourceUrl: options.pageUrl,
    email: options.email,
    externalId: options.customerId,
    fbp: options.fbp,
    fbc: options.fbc,
    clientIpAddress: options.clientIp,
    clientUserAgent: options.userAgent,
    contentIds: options.contentIds,
    contentType: 'product',
    value: options.value,
    currency: 'EUR',
    phone: options.phone,
    city: options.city,
    state: options.state,
    country: options.country,
  });
}

/**
 * Track Lead from Intelligence System (email recognized/entered)
 */
export async function trackIntelligenceLead(options: {
  email: string;
  customerId?: string | number;
  fbp?: string;
  fbc?: string;
  clientIp?: string;
  userAgent?: string;
  pageUrl?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
}) {
  return sendFacebookEventDirect({
    eventName: 'Lead',
    eventSourceUrl: options.pageUrl,
    email: options.email,
    externalId: options.customerId,
    fbp: options.fbp,
    fbc: options.fbc,
    clientIpAddress: options.clientIp,
    clientUserAgent: options.userAgent,
    phone: options.phone,
    city: options.city,
    state: options.state,
    country: options.country,
  });
}

/**
 * Track Search event from Intelligence System
 */
export async function trackIntelligenceSearch(options: {
  searchQuery: string;
  email?: string;
  customerId?: string | number;
  fbp?: string;
  fbc?: string;
  clientIp?: string;
  userAgent?: string;
  pageUrl?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
}) {
  return sendFacebookEventDirect({
    eventName: 'Search',
    eventSourceUrl: options.pageUrl,
    email: options.email,
    externalId: options.customerId,
    fbp: options.fbp,
    fbc: options.fbc,
    clientIpAddress: options.clientIp,
    clientUserAgent: options.userAgent,
    phone: options.phone,
    city: options.city,
    state: options.state,
    country: options.country,
    customData: {
      search_string: options.searchQuery,
    },
  });
}

/**
 * Track AddToCart from bundle acceptance
 */
export async function trackIntelligenceAddToCart(options: {
  productId: string;
  value: number;
  email?: string;
  customerId?: string | number;
  fbp?: string;
  fbc?: string;
  clientIp?: string;
  userAgent?: string;
  pageUrl?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
}) {
  return sendFacebookEventDirect({
    eventName: 'AddToCart',
    eventSourceUrl: options.pageUrl,
    email: options.email,
    externalId: options.customerId,
    fbp: options.fbp,
    fbc: options.fbc,
    clientIpAddress: options.clientIp,
    clientUserAgent: options.userAgent,
    phone: options.phone,
    city: options.city,
    state: options.state,
    country: options.country,
    contentIds: [options.productId],
    contentType: 'product',
    value: options.value,
    currency: 'EUR',
  });
}

