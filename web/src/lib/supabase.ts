/**
 * Supabase Client Configuration
 * 
 * This file provides configured Supabase clients for:
 * - Browser (client-side)
 * - Server (server-side, API routes)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check .env.local');
}

/**
 * Browser-side Supabase client
 * Use this in React components and client-side code
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We handle auth via WordPress
  }
});

/**
 * Server-side Supabase client
 * Use this in API routes and server components
 */
export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  }
});

/**
 * Database Helper Functions
 * Convenient wrappers for common database operations
 */
export const db = {
  // Customer Intelligence
  customer_intelligence: {
    async findByEmail(email: string) {
      const { data, error } = await supabase
        .from('customer_intelligence')
        .select('*')
        .eq('customer_email', email)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('[Supabase] Error fetching customer intelligence:', error);
      }
      return data;
    },

    async findByFingerprint(fingerprint: string) {
      const { data, error } = await supabase
        .from('customer_intelligence')
        .select('*')
        .eq('browser_fingerprint', fingerprint)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('[Supabase] Error fetching customer by fingerprint:', error);
      }
      return data;
    },

    async upsert(profile: any) {
      const { data, error } = await supabase
        .from('customer_intelligence')
        .upsert(profile, { onConflict: 'customer_email' })
        .select()
        .single();
      
      if (error) {
        console.error('[Supabase] Error upserting customer intelligence:', error);
        return null;
      }
      return data;
    }
  },

  // Device Tracking
  device_tracking: {
    async findByFingerprint(fingerprint: string) {
      const { data, error } = await supabase
        .from('device_tracking')
        .select('*')
        .eq('browser_fingerprint', fingerprint)
        .order('last_seen', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('[Supabase] Error fetching device tracking:', error);
      }
      return data;
    },

    async findByIPHash(ipHash: string) {
      const { data, error } = await supabase
        .from('device_tracking')
        .select('*')
        .eq('ip_hash', ipHash)
        .order('last_seen', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('[Supabase] Error fetching device by IP:', error);
      }
      return data;
    },

    async findByEmail(email: string) {
      const { data, error } = await supabase
        .from('device_tracking')
        .select('*')
        .eq('customer_email', email)
        .order('last_seen', { ascending: false });
      
      if (error) {
        console.error('[Supabase] Error fetching devices for customer:', error);
        return [];
      }
      return data || [];
    },

    async upsert(device: any) {
      // CRITICAL FIX: Match the UNIQUE constraint!
      // The constraint is on (customer_email, ip_hash, browser_fingerprint)
      const { data, error } = await supabase
        .from('device_tracking')
        .upsert(device, { 
          onConflict: 'customer_email,ip_hash,browser_fingerprint',
          ignoreDuplicates: false 
        })
        .select()
        .single();
      
      if (error) {
        console.error('[Supabase] Error upserting device tracking:', error);
        console.error('[Supabase] Device data:', device);
        return null;
      }
      
      console.log(`[Supabase] ✅ Device tracked for ${device.customer_email}`);
      return data;
    }
  },

  // Bundle Offers
  bundle_offers: {
    async findActiveByEmail(email: string) {
      const { data, error } = await supabase
        .from('bundle_offers')
        .select('*')
        .eq('customer_email', email)
        .eq('status', 'pending')
        .order('offered_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('[Supabase] Error fetching bundle offer:', error);
      }
      return data;
    },

    async updateStatus(offerId: string, status: string) {
      const { data, error } = await supabase
        .from('bundle_offers')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', offerId)
        .select()
        .single();
      
      if (error) {
        console.error('[Supabase] Error updating bundle status:', error);
        return null;
      }
      return data;
    },

    async create(offer: any) {
      const { data, error } = await supabase
        .from('bundle_offers')
        .insert(offer)
        .select()
        .single();
      
      if (error) {
        console.error('[Supabase] Error creating bundle offer:', error);
        return null;
      }
      return data;
    }
  },

  // Behavioral Events
  behavioral_events: {
    async create(event: any) {
      const { data, error } = await supabase
        .from('behavioral_events')
        .insert({
          ...event,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error('[Supabase] Error creating behavioral event:', error);
        return null;
      }
      return data;
    }
  }
};

/**
 * Database Types for TypeScript
 */
export interface CustomerIntelligence {
  id: string;
  customer_id: number | null;
  customer_email: string;
  ip_hash: string;
  browser_fingerprint: string | null;
  geo_country: string | null;
  geo_city: string | null;
  favorite_products: any | null;
  peak_spending_quantity: number;
  peak_spending_amount: number;
  avg_order_value: number;
  total_orders: number;
  last_order_date: string | null;
  days_since_last_order: number;
  purchase_cycle_days: number;
  next_prime_window_start: string | null;
  next_prime_window_end: string | null;
  profile_score: number;
  last_recalculated: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceTracking {
  id: string;
  customer_email: string;
  customer_id: number | null;
  ip_hash: string;
  browser_fingerprint: string | null;
  first_seen: string;
  last_seen: string;
  visit_count: number;
  user_agent: string | null;
  geo_country: string | null;
  geo_city: string | null;
}

export interface BundleOffer {
  id: string;
  customer_id: number | null;
  customer_email: string;
  bundle_products: any;
  total_quantity: number;
  base_price: number;
  discount_amount: number;
  final_price: number;
  bonus_points: number;
  trigger_reason: string;
  cart_snapshot: any | null;
  status: 'pending' | 'viewed' | 'added_to_cart' | 'purchased' | 'expired' | 'rejected';
  offered_at: string;
  viewed_at: string | null;
  responded_at: string | null;
  expires_at: string | null;
  conversion_value: number | null;
}

export interface BehavioralEvent {
  id: string;
  session_id: string;
  customer_id: number | null;
  customer_email: string | null;
  ip_hash: string;
  browser_fingerprint: string | null;
  event_type: string;
  event_data: any | null;
  timestamp: string;
}


