/**
 * Bundle Offer API - Get personalized bundle for customer
 * Uses Supabase to fetch bundle offers based on fingerprint or email
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customer_email = searchParams.get('customer_email');
    const fingerprint = searchParams.get('fingerprint');

    if (!customer_email && !fingerprint) {
      return NextResponse.json(
        { success: false, message: 'Email or fingerprint required' },
        { status: 400 }
      );
    }

    // Step 1: Find customer by email or fingerprint
    let customerEmail = customer_email;
    
    if (!customerEmail && fingerprint) {
      // Look up customer by fingerprint
      const deviceResult = await db.device_tracking.findByFingerprint(fingerprint);
      if (deviceResult) {
        customerEmail = deviceResult.customer_email;
      }
    }

    if (!customerEmail) {
      return NextResponse.json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Step 2: Get active bundle offer
    let bundleOffer = await db.bundle_offers.findActiveByEmail(customerEmail);
    
    // Step 2b: If no bundle exists, try to generate one via WordPress
    if (!bundleOffer) {
      console.log(`[Bundle API] No bundle found for ${customerEmail}, attempting to generate via WordPress...`);
      
      try {
        const wpResponse = await fetch(
          `https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle?customer_email=${encodeURIComponent(customerEmail)}`,
          {
            method: 'GET',
            cache: 'no-store'
          }
        );

        if (wpResponse.ok) {
          const wpData = await wpResponse.json();
          
          if (wpData.success) {
            console.log(`[Bundle API] ✅ Bundle generated successfully via WordPress for ${customerEmail}`);
            
            // Wait a moment for Supabase sync to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try to fetch the newly created bundle from Supabase
            bundleOffer = await db.bundle_offers.findActiveByEmail(customerEmail);
            
            if (!bundleOffer) {
              console.warn(`[Bundle API] ⚠️ Bundle generated but not yet in Supabase for ${customerEmail}`);
            }
          } else {
            console.log(`[Bundle API] WordPress cannot generate bundle: ${wpData.message}`);
          }
        } else {
          console.error(`[Bundle API] WordPress bundle generation failed: ${wpResponse.status}`);
        }
      } catch (wpError) {
        console.error('[Bundle API] Error calling WordPress to generate bundle:', wpError);
      }
    }
    
    // If still no bundle after generation attempt, return not found
    if (!bundleOffer) {
      return NextResponse.json({
        success: false,
        message: 'No active bundle offer available for this customer'
      });
    }

    // Step 3: Get customer intelligence profile
    const profile = await db.customer_intelligence.findByEmail(customerEmail);

    // Step 4: Format response to match existing structure
    const response = {
      success: true,
      offer_id: bundleOffer.id,
      bundle: bundleOffer.bundle_products,
      pricing: {
        base_price: bundleOffer.base_price,
        discount_amount: bundleOffer.discount_amount,
        final_price: bundleOffer.final_price
      },
      bonus_points: bundleOffer.bonus_points || 0,
      target_quantity: bundleOffer.total_quantity,
      message: generateOfferMessage(profile),
      customer: {
        first_name: profile?.first_name || '',
        last_name: profile?.last_name || '',
        email: customerEmail
      },
      profile: profile ? {
        total_orders: profile.total_orders,
        days_since_last_order: profile.days_since_last_order,
        favorite_products: profile.favorite_products || []
      } : null
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Bundle API] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate personalized message based on customer profile
 */
function generateOfferMessage(profile: any): string {
  if (!profile) {
    return 'Deze bundel is speciaal voor jou samengesteld!';
  }

  const { total_orders, days_since_last_order } = profile;

  if (total_orders === 0) {
    return 'Welkom! Deze bundel is perfect om Wasgeurtje te ontdekken.';
  }

  if (days_since_last_order && days_since_last_order > 60) {
    return `We hebben je gemist! Deze bundel is speciaal voor jou als welkom terug.`;
  }

  if (total_orders >= 5) {
    return `Als trouwe klant krijg je deze exclusieve bundel aanbieding!`;
  }

  return `Gebaseerd op je eerdere bestellingen hebben we deze bundel speciaal voor jou gemaakt.`;
}

/**
 * Get customer first name from WordPress API
 * (We still use WordPress for customer name as it's the source of truth)
 */
async function getCustomerFirstName(email: string): Promise<string> {
  try {
    const response = await fetch(
      `https://wasgeurtje.nl/wp-json/wg/v1/customer/name?email=${encodeURIComponent(email)}`,
      { cache: 'no-store' }
    );
    
    if (response.ok) {
      const data = await response.json();
      return data.first_name || '';
    }
  } catch (error) {
    console.error('[Bundle API] Error fetching customer name:', error);
  }
  return '';
}

