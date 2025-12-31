/**
 * Bundle Status API - Update bundle offer status  
 * Uses Supabase to track bundle offer acceptance/rejection/viewing
 * 
 * Valid statuses: pending, viewed, accepted, rejected, completed
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, isSupabaseAvailable } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  console.log('[Bundle Status API] POST request received');
  
  // Check if Supabase is configured
  if (!isSupabaseAvailable()) {
    return NextResponse.json(
      { success: false, message: 'Supabase not configured' },
      { status: 503 }
    );
  }
  
  try {
    const body = await request.json();
    const { offer_id, status, customer_email } = body;

    console.log('[Bundle Status API] Request body:', { offer_id, status, customer_email });

    // Validate required fields
    if (!offer_id || !status) {
      console.error('[Bundle Status API] Missing required fields');
      return NextResponse.json(
        { success: false, message: 'offer_id and status required' },
        { status: 400 }
      );
    }

    // Valid statuses: pending, viewed, accepted, rejected, completed
    const validStatuses = ['pending', 'viewed', 'accepted', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) {
      console.error('[Bundle Status API] Invalid status:', status);
      return NextResponse.json(
        { success: false, message: 'Invalid status. Must be one of: ' + validStatuses.join(', ') },
        { status: 400 }
      );
    }

    // Update bundle offer status
    console.log('[Bundle Status API] Updating bundle offer status...');
    const updated = await db.bundle_offers.updateStatus(offer_id, status);

    if (!updated) {
      console.error('[Bundle Status API] Bundle offer not found:', offer_id);
      return NextResponse.json(
        { success: false, message: 'Bundle offer not found' },
        { status: 404 }
      );
    }

    console.log('[Bundle Status API] Status updated successfully');

    // Log behavioral event
    if (customer_email) {
      let event_type = 'bundle_rejected';
      if (status === 'accepted') event_type = 'bundle_accepted';
      if (status === 'viewed') event_type = 'bundle_viewed';
      
      console.log('[Bundle Status API] Logging behavioral event:', event_type);
      
      await db.behavioral_events.create({
        customer_email,
        event_type,
        event_data: { offer_id, status },
        page_url: body.page_url || '/',
        session_id: body.session_id || null
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Status updated successfully',
      offer_id,
      status
    });

  } catch (error) {
    console.error('[Bundle Status API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
