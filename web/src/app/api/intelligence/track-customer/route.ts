/**
 * Customer Intelligence - Track Customer Session (Supabase)
 * 
 * Automatically tracks customer when:
 * - Email entered in checkout
 * - User logs in
 * - Returning visitor detected
 * 
 * Now using Supabase instead of WordPress for storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import crypto from 'crypto';

const WORDPRESS_API = process.env.NEXT_PUBLIC_WORDPRESS_API_URL || 'https://wasgeurtje.nl';

/**
 * Hash IP address for privacy (SHA-256)
 */
function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, customer_id, event_type = 'session_track', fingerprint } = body;

    // Get client IP from request headers
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const ipHash = hashIP(ip);
    
    console.log(`[Tracking] 🔍 Detected IP: ${ip} → Hash: ${ipHash.substring(0, 20)}...`);

    // STEP 1: Try to recognize customer by fingerprint or IP
    let recognizedEmail = email;
    let recognizedCustomerId = customer_id;

    if (!recognizedEmail && fingerprint) {
      // Check if this fingerprint is known (check both tables)
      const knownProfile = await db.customer_intelligence.findByFingerprint(fingerprint);
      if (knownProfile) {
        recognizedEmail = knownProfile.customer_email;
        recognizedCustomerId = knownProfile.customer_id;
        console.log(`[Tracking] ✅ Fingerprint recognized: ${recognizedEmail}`);
      } else {
        // Fallback: check device_tracking table
        const knownDevice = await db.device_tracking.findByFingerprint(fingerprint);
        if (knownDevice) {
          recognizedEmail = knownDevice.customer_email;
          recognizedCustomerId = knownDevice.customer_id;
          console.log(`[Tracking] ✅ Fingerprint recognized (device): ${recognizedEmail}`);
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

    // STEP 4: Log important events only (whitelist)
    const importantEvents = [
      'checkout_start',
      'checkout_email_entered',
      'bundle_viewed',
      'bundle_accepted',
      'bundle_rejected',
      'order_completed'
    ];

    if (event_type && importantEvents.includes(event_type)) {
      try {
        await db.behavioral_events.create({
          session_id: crypto.randomUUID(),
          customer_id: recognizedCustomerId || null,
          customer_email: recognizedEmail || null,
          ip_hash: ipHash,
          browser_fingerprint: fingerprint || null,
          event_type,
          event_data: {
            timestamp: new Date().toISOString(),
            user_agent: request.headers.get('user-agent')
          },
          page_url: request.headers.get('referer') || '/'
        });
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
    return NextResponse.json(
      { success: false, message: 'Failed to track customer' },
      { status: 500 }
    );
  }
}

