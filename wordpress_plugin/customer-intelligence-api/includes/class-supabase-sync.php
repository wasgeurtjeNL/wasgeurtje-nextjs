<?php
/**
 * Supabase Sync Bridge
 * 
 * Syncs customer intelligence data from WordPress to Supabase
 */

if (!defined('ABSPATH')) {
    exit;
}

class WG_Supabase_Sync {
    
    private static $supabase_url = 'https://dqddlmniyacbiviovgfw.supabase.co';
    private static $supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZGRsbW5peWFjYml2aW92Z2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyODA4NDMsImV4cCI6MjA2Mzg1Njg0M30.6VPmb9C-q1W5vzdXmZSxEE4RQR4ayXqlqn7m8fPeTb0';
    
    /**
     * Sync customer intelligence profile to Supabase
     */
    public static function sync_profile($customer_email, $profile_data) {
        try {
            // Transform WordPress data to Supabase format
            $supabase_data = [
                'customer_id' => isset($profile_data['customer_id']) ? intval($profile_data['customer_id']) : null,
                'customer_email' => $customer_email,
                'first_name' => $profile_data['first_name'] ?? null,
                'last_name' => $profile_data['last_name'] ?? null,
                'ip_hash' => $profile_data['ip_hash'] ?? '',
                'browser_fingerprint' => $profile_data['browser_fingerprint'] ?? null,
                'geo_country' => $profile_data['geo_country'] ?? null,
                'geo_city' => $profile_data['geo_city'] ?? null,
                'favorite_products' => $profile_data['favorite_products'] ?? null,
                'peak_spending_quantity' => intval($profile_data['peak_spending_quantity'] ?? 0),
                'peak_spending_amount' => floatval($profile_data['peak_spending_amount'] ?? 0),
                'avg_order_value' => floatval($profile_data['avg_order_value'] ?? 0),
                'total_orders' => intval($profile_data['total_orders'] ?? 0),
                'last_order_date' => $profile_data['last_order_date'] ?? null,
                'days_since_last_order' => intval($profile_data['days_since_last_order'] ?? 0),
                'purchase_cycle_days' => intval($profile_data['purchase_cycle_days'] ?? 14),
                'next_prime_window_start' => $profile_data['next_prime_window_start'] ?? null,
                'next_prime_window_end' => $profile_data['next_prime_window_end'] ?? null,
                'profile_score' => floatval($profile_data['profile_score'] ?? 0),
                'last_recalculated' => current_time('mysql', true)
            ];
            
            // Upsert to Supabase (update if exists, insert if not)
            $response = wp_remote_post(
                self::$supabase_url . '/rest/v1/customer_intelligence',
                [
                    'method' => 'POST',
                    'headers' => [
                        'Content-Type' => 'application/json',
                        'apikey' => self::$supabase_key,
                        'Authorization' => 'Bearer ' . self::$supabase_key,
                        'Prefer' => 'resolution=merge-duplicates,return=representation'
                    ],
                    'body' => json_encode($supabase_data),
                    'timeout' => 15
                ]
            );
            
            if (is_wp_error($response)) {
                error_log('[WG Supabase] Error syncing profile: ' . $response->get_error_message());
                return false;
            }
            
            $status_code = wp_remote_retrieve_response_code($response);
            $body = wp_remote_retrieve_body($response);
            
            if ($status_code === 201 || $status_code === 200) {
                error_log("[WG Supabase] ✅ Profile synced successfully for: $customer_email");
                return true;
            } else {
                error_log("[WG Supabase] ⚠️ Unexpected status code: $status_code, Body: $body");
                return false;
            }
            
        } catch (Exception $e) {
            error_log('[WG Supabase] ❌ Exception: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Sync bundle offer to Supabase (DIRECT WRITE - no MySQL)
     * 
     * @return string|false Supabase offer_id on success, false on failure
     */
    public static function sync_bundle_offer($offer_data) {
        try {
            // Calculate expiration (7 days from now)
            $expires_at = new DateTime('now', new DateTimeZone('UTC'));
            $expires_at->modify('+7 days');
            
            $supabase_data = [
                'customer_id' => isset($offer_data['customer_id']) ? intval($offer_data['customer_id']) : null,
                'customer_email' => $offer_data['customer_email'],
                'bundle_products' => $offer_data['bundle_products'],
                'total_quantity' => intval($offer_data['total_quantity']),
                'base_price' => floatval($offer_data['base_price']),
                'discount_amount' => floatval($offer_data['discount_amount']),
                'final_price' => floatval($offer_data['final_price']),
                'bonus_points' => intval($offer_data['bonus_points'] ?? 0),
                'trigger_reason' => $offer_data['trigger_reason'] ?? 'prime_window',
                'cart_snapshot' => $offer_data['cart_snapshot'] ?? null,
                'status' => $offer_data['status'] ?? 'pending',
                'offered_at' => gmdate('Y-m-d\TH:i:s\Z'), // ISO 8601 UTC
                'expires_at' => $expires_at->format('Y-m-d\TH:i:s\Z')
            ];
            
            $response = wp_remote_post(
                self::$supabase_url . '/rest/v1/bundle_offers',
                [
                    'method' => 'POST',
                    'headers' => [
                        'Content-Type' => 'application/json',
                        'apikey' => self::$supabase_key,
                        'Authorization' => 'Bearer ' . self::$supabase_key,
                        'Prefer' => 'return=representation'
                    ],
                    'body' => json_encode($supabase_data),
                    'timeout' => 15
                ]
            );
            
            if (is_wp_error($response)) {
                error_log('[WG Supabase] Error syncing bundle offer: ' . $response->get_error_message());
                return false;
            }
            
            $status_code = wp_remote_retrieve_response_code($response);
            $body = wp_remote_retrieve_body($response);
            
            if ($status_code === 201) {
                $data = json_decode($body, true);
                $offer_id = $data[0]['id'] ?? null;
                
                if ($offer_id) {
                    error_log("[WG Supabase] ✅ Bundle offer created in Supabase: $offer_id");
                    return $offer_id;
                } else {
                    error_log('[WG Supabase] ⚠️ Bundle created but no ID returned');
                    return false;
                }
            } else {
                error_log("[WG Supabase] ⚠️ Bundle sync failed: $status_code, Body: $body");
                return false;
            }
            
        } catch (Exception $e) {
            error_log('[WG Supabase] ❌ Exception: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Get WordPress profile data and prepare it for Supabase
     */
    public static function get_profile_data($customer_email) {
        global $wpdb;
        $table = $wpdb->prefix . 'wg_customer_intelligence';
        
        $profile = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE customer_email = %s",
            $customer_email
        ), ARRAY_A);
        
        if (!$profile) {
            return null;
        }
        
        // Get first_name and last_name from WooCommerce
        $customer_id = $profile['customer_id'] ?? null;
        
        if ($customer_id) {
            // Customer is logged in WordPress user
            $wc_customer = new WC_Customer($customer_id);
            $profile['first_name'] = $wc_customer->get_first_name();
            $profile['last_name'] = $wc_customer->get_last_name();
        } else {
            // Try to get from most recent order
            $args = array(
                'customer' => $customer_email,
                'limit' => 1,
                'orderby' => 'date',
                'order' => 'DESC',
                'status' => array('completed', 'processing')
            );
            $orders = wc_get_orders($args);
            if (!empty($orders)) {
                $latest_order = $orders[0];
                $profile['first_name'] = $latest_order->get_billing_first_name();
                $profile['last_name'] = $latest_order->get_billing_last_name();
            }
        }
        
        return $profile;
    }
}

