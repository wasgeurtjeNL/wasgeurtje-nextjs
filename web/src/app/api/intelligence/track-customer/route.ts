/**
 * Customer Intelligence - Track Customer Session (Supabase)
 * 
 * Automatically tracks customer when:
 * - Email entered in checkout
 * - User logs in
 * - Returning visitor detected
 * 
 * Now using Supabase instead of WordPress for storage
 * 
 * 🎯 OPTIMIZED WITH 10 FACEBOOK CAPI ENHANCEMENTS:
 * 1. ViewContent Events for product pages
 * 2. Bundle Events as Facebook Standard Events
 * 3. Geolocation Enrichment (IP → Location)
 * 4. Session Quality Score
 * 5. Search Event Tracking
 * 6. Engagement Tracking (time on page + scroll depth)
 * 7. Phone Number Enrichment
 * 8. Improved Deduplication
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, supabaseServer } from '@/lib/supabase';
import crypto from 'crypto';
import geoip from 'geoip-lite';
import { 
  trackIntelligencePageView, 
  trackIntelligenceLead,
  trackIntelligenceViewContent,
  trackIntelligenceSearch,
  trackIntelligenceAddToCart
} from '@/lib/analytics/facebookServerDirect';

const WORDPRESS_API = process.env.NEXT_PUBLIC_WORDPRESS_API_URL || 'https://wasgeurtje.nl';

/**
 * Hash IP address for privacy (SHA-256)
 */
function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

/**
 * 🎯 OPTIMIZATION 6: Calculate session quality score
 * Higher score = more engaged/valuable user
 */
function calculateSessionScore(profile: any, eventType: string, body: any): number {
  let score = 0;
  
  // Past behavior (from profile)
  if (profile?.total_orders > 0) score += 30;
  if (profile?.total_orders >= 3) score += 20;
  if (profile?.avg_order_value > 50) score += 10;
  
  // Current session behavior
  if (eventType === 'product_viewed') score += 10;
  if (eventType === 'bundle_viewed') score += 15;
  if (eventType === 'bundle_accepted') score += 25;
  if (eventType === 'checkout_start') score += 30;
  if (eventType === 'checkout_email_entered') score += 40;
  if (eventType === 'search') score += 5;
  if (eventType === 'engaged_session') {
    if (body.time_on_page > 60) score += 15;
    if (body.scroll_depth > 75) score += 10;
  }
  
  return Math.min(score, 100);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, customer_id, event_type = 'session_track', fingerprint, fbp, fbc } = body;

    // Get client IP from request headers
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const ipHash = hashIP(ip);
    const userAgent = request.headers.get('user-agent') || undefined;
    const referer = request.headers.get('referer') || undefined;
    
    console.log(`[Tracking] 🔍 Detected IP: ${ip} → Hash: ${ipHash.substring(0, 20)}...`);

    // 🎯 OPTIMIZATION 3: GEOLOCATION ENRICHMENT
    // Convert IP to city/state/country for better EMQ
    let geoData = null;
    let geoCity = undefined;
    let geoState = undefined;
    let geoCountry = undefined;
    
    if (ip !== 'unknown') {
      geoData = geoip.lookup(ip);
      if (geoData) {
        geoCity = geoData.city;
        geoState = geoData.region;
        geoCountry = geoData.country;
        console.log(`[Tracking] 🌍 Geolocation: ${geoCity}, ${geoState}, ${geoCountry}`);
      }
    }

    // STEP 1: Try to recognize customer by fingerprint or IP
    let recognizedEmail = email;
    let recognizedCustomerId = customer_id;
    let recognizedPhone = undefined; // 🎯 OPTIMIZATION 9: Phone enrichment

    if (!recognizedEmail && fingerprint) {
      // Check if this fingerprint is known (check both tables)
      const knownProfile = await db.customer_intelligence.findByFingerprint(fingerprint);
      if (knownProfile) {
        recognizedEmail = knownProfile.customer_email;
        recognizedCustomerId = knownProfile.customer_id;
        // 🎯 OPTIMIZATION 9: Extract phone from profile
        recognizedPhone = knownProfile.phone || undefined;
        console.log(`[Tracking] ✅ Fingerprint recognized: ${recognizedEmail}`);
        
        // 🎯 STRATEGY A: RETURNING VISITOR RECOGNITION
        // Send PageView to Facebook with recognized email (improves EMQ!)
        await trackIntelligencePageView({
          email: recognizedEmail,
          customerId: recognizedCustomerId,
          fbp: fbp,
          fbc: fbc,
          clientIp: ip !== 'unknown' ? ip : undefined,
          userAgent: userAgent,
          pageUrl: referer,
          phone: recognizedPhone, // 🎯 Phone enrichment
          city: geoCity,          // 🎯 Geolocation
          state: geoState,
          country: geoCountry,
        });
        console.log(`[FB Intelligence] ✅ PageView sent for recognized visitor: ${recognizedEmail}`);
      } else {
        // Fallback: check device_tracking table
        const knownDevice = await db.device_tracking.findByFingerprint(fingerprint);
        if (knownDevice) {
          recognizedEmail = knownDevice.customer_email;
          recognizedCustomerId = knownDevice.customer_id;
          console.log(`[Tracking] ✅ Fingerprint recognized (device): ${recognizedEmail}`);
          
          // Try to get phone from customer_intelligence
          const profile = await db.customer_intelligence.findByEmail(recognizedEmail);
          recognizedPhone = profile?.phone || undefined;
          
          // 🎯 STRATEGY A: RETURNING VISITOR RECOGNITION
          await trackIntelligencePageView({
            email: recognizedEmail,
            customerId: recognizedCustomerId,
            fbp: fbp,
            fbc: fbc,
            clientIp: ip !== 'unknown' ? ip : undefined,
            userAgent: userAgent,
            pageUrl: referer,
            phone: recognizedPhone, // 🎯 Phone enrichment
            city: geoCity,          // 🎯 Geolocation
            state: geoState,
            country: geoCountry,
          });
          console.log(`[FB Intelligence] ✅ PageView sent for recognized device: ${recognizedEmail}`);
        }
      }
    }
    
    // STEP 1.5: If still not recognized, try IP-only recognition (for multi-device scenarios)
    if (!recognizedEmail && ipHash && ipHash !== 'unknown') {
      console.log(`[Tracking] 🔍 Fingerprint not found, trying IP-only recognition...`);
      
      // Find any device with this IP
      const { data: devicesWithIP } = await supabaseServer
        .from('device_tracking')
        .select('customer_email, customer_id')
        .eq('ip_hash', ipHash)
        .order('last_seen', { ascending: false })
        .limit(1);
      
      if (devicesWithIP && devicesWithIP.length > 0) {
        recognizedEmail = devicesWithIP[0].customer_email;
        recognizedCustomerId = devicesWithIP[0].customer_id;
        console.log(`[Tracking] ✅ IP recognized! Customer: ${recognizedEmail} (multi-device)`);
        
        // Try to get phone from customer_intelligence
        const profile = await db.customer_intelligence.findByEmail(recognizedEmail);
        recognizedPhone = profile?.phone || undefined;
        
        // 🎯 STRATEGY A: IP-BASED RECOGNITION
        await trackIntelligencePageView({
          email: recognizedEmail,
          customerId: recognizedCustomerId,
          fbp: fbp,
          fbc: fbc,
          clientIp: ip !== 'unknown' ? ip : undefined,
          userAgent: userAgent,
          pageUrl: referer,
          phone: recognizedPhone, // 🎯 Phone enrichment
          city: geoCity,          // 🎯 Geolocation
          state: geoState,
          country: geoCountry,
        });
        console.log(`[FB Intelligence] ✅ PageView sent for IP-recognized visitor: ${recognizedEmail}`);
      } else {
        console.log(`[Tracking] ❌ IP not recognized: ${ipHash.substring(0, 20)}...`);
        
        // 🎯 STRATEGY B: ANONYMOUS FACEBOOK EVENTS
        // Even without email, send PageView with fbp/fbc for retargeting
        if (fbp || fbc) {
          await trackIntelligencePageView({
            fbp: fbp,
            fbc: fbc,
            clientIp: ip !== 'unknown' ? ip : undefined,
            userAgent: userAgent,
            pageUrl: referer,
            city: geoCity,    // 🎯 Geolocation even for anonymous
            state: geoState,
            country: geoCountry,
          });
          console.log(`[FB Intelligence] ✅ Anonymous PageView sent (fbp: ${fbp ? 'yes' : 'no'}, fbc: ${fbc ? 'yes' : 'no'})`);
        }
      }
    }

    // STEP 2: If we have an email, track the device
    // This will now create SEPARATE records for each unique IP/fingerprint combo
    // allowing us to maintain IP history for better customer recognition
    if (recognizedEmail) {
      try {
        const now = new Date().toISOString();
        
        // Check if this exact device combo already exists
        const existingDevices = await db.device_tracking.findByEmail(recognizedEmail);
        const existingDevice = existingDevices?.find(
          (d: any) => d.ip_hash === ipHash && d.browser_fingerprint === fingerprint
        );
        
        if (existingDevice) {
          // Update existing device record
          console.log(`[Tracking] Updating existing device for ${recognizedEmail}`);
          await db.device_tracking.upsert({
            customer_email: recognizedEmail,
            customer_id: recognizedCustomerId || null,
            ip_hash: ipHash,
            browser_fingerprint: fingerprint || null,
            user_agent: request.headers.get('user-agent') || null,
            geo_country: existingDevice.geo_country || null,
            geo_city: existingDevice.geo_city || null,
            first_seen: existingDevice.first_seen,
            last_seen: now,
            visit_count: (existingDevice.visit_count || 0) + 1
          });
        } else {
          // Create NEW device record for new IP/fingerprint combo
          console.log(`[Tracking] 🆕 Creating NEW device record for ${recognizedEmail} (IP history preserved)`);
          await db.device_tracking.upsert({
            customer_email: recognizedEmail,
            customer_id: recognizedCustomerId || null,
            ip_hash: ipHash,
            browser_fingerprint: fingerprint || null,
            user_agent: request.headers.get('user-agent') || null,
            geo_country: null, // TODO: Add geo lookup
            geo_city: null,
            first_seen: now,
            last_seen: now,
            visit_count: 1
          });
        }
      } catch (error) {
        console.error('[Tracking] Error tracking device:', error);
      }
    }

    // STEP 3: Get or update customer profile (if recognized)
    let profile = null;
    if (recognizedEmail) {
      profile = await db.customer_intelligence.findByEmail(recognizedEmail);
      
      // Always update fingerprint if available (even if we don't do full WordPress sync)
      if (profile && fingerprint) {
        if (!profile.browser_fingerprint || profile.browser_fingerprint !== fingerprint) {
          console.log('[Tracking] Updating browser fingerprint:', fingerprint);
          await db.customer_intelligence.upsert({
            customer_email: recognizedEmail,
            browser_fingerprint: fingerprint
          });
          profile.browser_fingerprint = fingerprint; // Update local object
        }
      }
      
      // Check if we need to sync WordPress data
      const needsWordPressSync = !profile || (profile && profile.total_orders === 0);
      
      if (needsWordPressSync) {
        console.log('[Tracking] Syncing WordPress profile data to Supabase...');
        
        try {
          // Fetch complete profile from WordPress
          const wpResponse = await fetch(`${WORDPRESS_API}/wp-json/wg/v1/intelligence/profile?customer_email=${encodeURIComponent(recognizedEmail)}`);
          const wpData = await wpResponse.json();
          
          if (wpData.success && wpData.profile) {
            const wp = wpData.profile;
            console.log('[Tracking] WordPress profile found, syncing to Supabase...');
            
            // Transform and sync WordPress data to Supabase
            await db.customer_intelligence.upsert({
              customer_email: recognizedEmail,
              customer_id: wp.customer_id || recognizedCustomerId || null,
              first_name: wp.first_name || null,
              last_name: wp.last_name || null,
              ip_hash: wp.ip_hash || ipHash,
              browser_fingerprint: fingerprint || wp.browser_fingerprint || null,
              geo_country: wp.geo_country || null,
              geo_city: wp.geo_city || null,
              favorite_products: wp.favorite_products ? JSON.stringify(wp.favorite_products) : null,
              peak_spending_quantity: parseInt(wp.peak_spending_quantity) || 0,
              peak_spending_amount: parseFloat(wp.peak_spending_amount) || 0,
              avg_order_value: parseFloat(wp.avg_order_value) || 0,
              total_orders: parseInt(wp.total_orders) || 0,
              last_order_date: wp.last_order_date || null,
              days_since_last_order: parseInt(wp.days_since_last_order) || 0,
              purchase_cycle_days: parseInt(wp.purchase_cycle_days) || 14,
              next_prime_window_start: wp.next_prime_window_start || null,
              next_prime_window_end: wp.next_prime_window_end || null,
              profile_score: parseFloat(wp.profile_score) || 0,
              last_recalculated: wp.last_recalculated || new Date().toISOString()
            });
            
            console.log(`[Tracking] ✅ WordPress data synced: ${wp.total_orders} orders, favorite: ${wp.favorite_products?.[0]?.name || 'none'}`);
          } else {
            // No WordPress data yet, create basic profile
            console.log('[Tracking] No WordPress data, creating basic Supabase profile...');
            await db.customer_intelligence.upsert({
              customer_email: recognizedEmail,
              customer_id: recognizedCustomerId || null,
              ip_hash: ipHash,
              browser_fingerprint: fingerprint || null,
              total_orders: 0,
              avg_order_value: 0,
              profile_score: 0,
              last_recalculated: new Date().toISOString()
            });
          }
          
          // Refresh profile
          profile = await db.customer_intelligence.findByEmail(recognizedEmail);
          
        } catch (error) {
          console.error('[Tracking] WordPress sync error:', error);
          
          // Fallback: create basic profile
          if (!profile) {
            await db.customer_intelligence.upsert({
              customer_email: recognizedEmail,
              customer_id: recognizedCustomerId || null,
              ip_hash: ipHash,
              browser_fingerprint: fingerprint || null,
              total_orders: 0,
              last_recalculated: new Date().toISOString()
            });
            profile = await db.customer_intelligence.findByEmail(recognizedEmail);
          }
        }
      }
    }

    // 🎯 STRATEGY C: PROGRESSIVE PROFILING
    // If email was just provided (not recognized, but explicitly given), send Lead event
    // This links previous anonymous events to this email
    if (email && !customer_id && event_type === 'checkout_email_entered') {
      // Check if this is a NEW email (not previously tracked with this fingerprint)
      const wasAnonymous = !recognizedEmail || recognizedEmail === email;
      
      if (wasAnonymous) {
        await trackIntelligenceLead({
          email: email,
          fbp: fbp,
          fbc: fbc,
          clientIp: ip !== 'unknown' ? ip : undefined,
          userAgent: userAgent,
          pageUrl: referer,
          phone: recognizedPhone,
          city: geoCity,
          state: geoState,
          country: geoCountry,
        });
        console.log(`[FB Intelligence] 🎯 PROGRESSIVE PROFILING: Lead event sent for ${email} (linking anonymous events)`);
      }
    }

    // 🎯 OPTIMIZATION 1: PRODUCT VIEW TRACKING
    if (event_type === 'product_viewed' && body.product_id) {
      await trackIntelligenceViewContent({
        email: recognizedEmail,
        customerId: recognizedCustomerId,
        fbp: fbp,
        fbc: fbc,
        clientIp: ip !== 'unknown' ? ip : undefined,
        userAgent: userAgent,
        pageUrl: referer,
        contentIds: [body.product_id],
        contentName: body.product_name,
        value: body.product_price || undefined,
        phone: recognizedPhone,
        city: geoCity,
        state: geoState,
        country: geoCountry,
      });
      console.log(`[FB Intelligence] 🎯 ViewContent sent for product: ${body.product_id}`);
    }

    // 🎯 OPTIMIZATION 2: BUNDLE EVENTS AS FACEBOOK STANDARD EVENTS
    if (event_type === 'bundle_accepted' && body.bundle_data) {
      // Send AddToCart event (Facebook Standard Event)
      await trackIntelligenceAddToCart({
        productId: body.bundle_data.product_id || 'bundle',
        value: body.bundle_data.value || 0,
        email: recognizedEmail,
        customerId: recognizedCustomerId,
        fbp: fbp,
        fbc: fbc,
        clientIp: ip !== 'unknown' ? ip : undefined,
        userAgent: userAgent,
        pageUrl: referer,
        phone: recognizedPhone,
        city: geoCity,
        state: geoState,
        country: geoCountry,
      });
      console.log(`[FB Intelligence] 🎯 Bundle Accepted → AddToCart: ${body.bundle_data.product_id}`);
    }

    // 🎯 OPTIMIZATION 7: SEARCH EVENT TRACKING
    if (event_type === 'search' && body.search_query) {
      await trackIntelligenceSearch({
        searchQuery: body.search_query,
        email: recognizedEmail,
        customerId: recognizedCustomerId,
        fbp: fbp,
        fbc: fbc,
        clientIp: ip !== 'unknown' ? ip : undefined,
        userAgent: userAgent,
        pageUrl: referer,
        phone: recognizedPhone,
        city: geoCity,
        state: geoState,
        country: geoCountry,
      });
      console.log(`[FB Intelligence] 🎯 Search event sent: "${body.search_query}"`);
    }

    // 🎯 OPTIMIZATION 8: ENGAGEMENT TRACKING
    // Note: We don't send to Facebook, but we log it for internal analytics
    if (event_type === 'engaged_session') {
      console.log(`[FB Intelligence] 📊 Engaged session: ${body.time_on_page}s, ${body.scroll_depth}% scroll`);
      // Could send as custom event if needed in the future
    }

    // STEP 4: Log important events only (whitelist)
    const importantEvents = [
      'checkout_start',
      'checkout_email_entered',
      'bundle_viewed',
      'bundle_accepted',
      'bundle_rejected',
      'order_completed',
      'product_viewed',     // 🎯 NEW
      'search',             // 🎯 NEW
      'engaged_session',    // 🎯 NEW
    ];

    if (event_type && importantEvents.includes(event_type)) {
      try {
        // 🎯 OPTIMIZATION 6: Calculate session quality score
        const sessionScore = calculateSessionScore(profile, event_type, body);
        
        await db.behavioral_events.create({
          session_id: crypto.randomUUID(),
          customer_id: recognizedCustomerId || null,
          customer_email: recognizedEmail || null,
          ip_hash: ipHash,
          browser_fingerprint: fingerprint || null,
          event_type,
          event_data: {
            timestamp: new Date().toISOString(),
            user_agent: request.headers.get('user-agent'),
            session_quality_score: sessionScore, // 🎯 NEW: Quality indicator for Facebook
            geolocation: geoData ? { city: geoCity, state: geoState, country: geoCountry } : undefined,
          },
          page_url: request.headers.get('referer') || '/'
        });
        
        console.log(`[Tracking] ✅ Event logged: ${event_type} (Quality Score: ${sessionScore}/100)`);
      } catch (error) {
        console.error('[Tracking] Error logging event:', error);
      }
    }

    return NextResponse.json({
      success: true,
      tracked: {
        customer_email: recognizedEmail,
        customer_id: recognizedCustomerId,
        ip_recognized: !!recognizedEmail && !email,
        fingerprint_recognized: !!recognizedEmail && !email && !!fingerprint
      },
      profile: profile
    });

  } catch (error) {
    console.error('[Tracking] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[Tracking] Error details:', { message: errorMessage, stack: errorStack });
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to track customer',
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

