<?php
/**
 * Personalized Bundle Generator
 */

if (!defined('ABSPATH')) {
    exit;
}

class WG_Bundle_Generator {
    
    /**
     * Generate personalized bundle offer for customer
     */
    public static function generate_bundle($customer_email, $customer_id = null) {
        global $wpdb;
        
        // Get customer profile
        $profile = WG_Purchase_Analyzer::get_profile($customer_email);
        
        if (!$profile) {
            return [
                'success' => false,
                'message' => 'Customer profile not found. Please recalculate profile first.'
            ];
        }
        
        // Check if customer is in prime window
        $in_prime_window = self::is_in_prime_window($profile);
        
        if (!$in_prime_window) {
            return [
                'success' => false,
                'message' => 'Customer not in prime buying window yet',
                'next_window' => $profile['next_prime_window_start']
            ];
        }
        
        // Get favorite products
        $favorites = $profile['favorite_products'];
        
        if (empty($favorites)) {
            return [
                'success' => false,
                'message' => 'No favorite products identified'
            ];
        }
        
        // Check if customer has ONLY excluded products (1893, 334999)
        $excluded_ids = [1893, 334999];
        $has_valid_products = false;
        foreach ($favorites as $fav) {
            if (!in_array($fav['product_id'], $excluded_ids)) {
                $has_valid_products = true;
                break;
            }
        }
        
        if (!$has_valid_products) {
            return [
                'success' => false,
                'message' => 'Customer only purchased excluded products, no bundle offer allowed'
            ];
        }
        
        // Build bundle based on peak spending + 1
        $target_quantity = $profile['peak_spending_quantity'] + 1;
        
        // Minimum 4 items for bundle eligibility
        if ($target_quantity < 4) {
            return [
                'success' => false,
                'message' => 'Customer peak spending too low for bundle offer'
            ];
        }
        
        // Create bundle composition
        $bundle = self::create_bundle_composition($favorites, $target_quantity);
        
        // Calculate pricing
        $pricing = self::calculate_bundle_pricing($bundle, $profile);
        
        // Get loyalty points bonus
        $bonus_points = self::calculate_bonus_points($pricing['final_price'], $profile);
        
        // Save bundle offer to database
        $offer_data = [
            'customer_id' => $customer_id,
            'customer_email' => $customer_email,
            'bundle_products' => $bundle,
            'total_quantity' => $target_quantity,
            'base_price' => $pricing['base_price'],
            'discount_amount' => $pricing['discount_amount'],
            'final_price' => $pricing['final_price'],
            'bonus_points' => $bonus_points,
            'trigger_reason' => 'prime_window'
        ];
        
        // 🚀 WRITE DIRECTLY TO SUPABASE (no MySQL)
        $offer_id = WG_Supabase_Sync::sync_bundle_offer($offer_data);
        
        if (!$offer_id) {
            error_log("[Bundle Generator] ❌ Failed to save bundle to Supabase for: {$profile['customer_email']}");
            return null;
        }
        
        // Get customer name from WooCommerce
        // Priority: 
        // 1. From WC_Customer if customer_id exists (logged in user)
        // 2. From WordPress user if email is registered
        // 3. From most recent order (guest checkout)
        $customer_first_name = '';
        $customer_last_name = '';
        
        if ($customer_id) {
            // If we have customer_id, use it directly
            $wc_customer = new WC_Customer($customer_id);
            $customer_first_name = $wc_customer->get_first_name();
            $customer_last_name = $wc_customer->get_last_name();
        } else if ($customer_email) {
            // Try to find customer by email in WordPress users table
            $user = get_user_by('email', $customer_email);
            if ($user) {
                $wc_customer = new WC_Customer($user->ID);
                $customer_first_name = $wc_customer->get_first_name();
                $customer_last_name = $wc_customer->get_last_name();
            }
            
            // If still no name, get from most recent order (guest checkout)
            if (empty($customer_first_name) && $customer_email) {
                $orders = wc_get_orders([
                    'customer' => $customer_email,
                    'limit' => 1,
                    'orderby' => 'date',
                    'order' => 'DESC',
                    'return' => 'objects'
                ]);
                
                if (!empty($orders)) {
                    $order = $orders[0];
                    $customer_first_name = $order->get_billing_first_name();
                    $customer_last_name = $order->get_billing_last_name();
                    
                    error_log("[WG Bundle] Retrieved name from order for guest: $customer_first_name $customer_last_name");
                }
            }
        }
        
        return [
            'success' => true,
            'offer_id' => $offer_id,
            'bundle' => $bundle,
            'pricing' => $pricing,
            'bonus_points' => $bonus_points,
            'target_quantity' => $target_quantity,
            'message' => self::generate_offer_message($bundle, $pricing, $bonus_points),
            'customer' => [
                'first_name' => $customer_first_name,
                'last_name' => $customer_last_name,
                'email' => $customer_email
            ],
            'profile' => [
                'total_orders' => $profile['total_orders'],
                'days_since_last_order' => $profile['days_since_last_order'],
                'favorite_products' => array_slice($favorites, 0, 3) // Top 3 favorites
            ]
        ];
    }
    
    /**
     * Check if customer is in prime buying window
     * 
     * LOGIC:
     * - If last order > 14 days ago AND customer is on site = PRIME (re-engagement!)
     * - If last order < 14 days = use calculated window (purchase cycle based)
     */
    private static function is_in_prime_window($profile) {
        $now = new DateTime();
        $days_since_last = intval($profile['days_since_last_order']);
        
        // CASE 1: Customer hasn't ordered in 14+ days
        // If they're on the site now, they're in buying mode!
        if ($days_since_last >= 14) {
            return true;
        }
        
        // CASE 2: Recent customer (< 14 days)
        // Use predicted purchase cycle window
        if (!$profile['next_prime_window_start'] || !$profile['next_prime_window_end']) {
            return false;
        }
        
        $window_start = new DateTime($profile['next_prime_window_start']);
        $window_end = new DateTime($profile['next_prime_window_end']);
        
        return ($now >= $window_start && $now <= $window_end);
    }
    
    /**
     * Create bundle composition from favorite products
     */
    private static function create_bundle_composition($favorites, $target_quantity) {
        $bundle = [];
        
        // Excluded product IDs (never include in bundles)
        $excluded_ids = [1893, 334999];
        
        // Filter out excluded products
        $valid_favorites = array_filter($favorites, function($fav) use ($excluded_ids) {
            return !in_array($fav['product_id'], $excluded_ids);
        });
        
        // Re-index array after filter
        $valid_favorites = array_values($valid_favorites);
        
        // Get top 2 favorites (meest gekocht)
        $top_favorites = array_slice($valid_favorites, 0, 2);
        
        if (count($top_favorites) < 2) {
            // If only 1 favorite, use it for entire bundle
            $product_id = $top_favorites[0]['product_id'];
            $bundle[] = [
                'product_id' => $product_id,
                'name' => $top_favorites[0]['name'],
                'slug' => $top_favorites[0]['slug'],
                'quantity' => $target_quantity
            ];
            return $bundle;
        }
        
        // Split quantity between top 2 favorites
        // Primary favorite gets slightly more (60/40 split for odd numbers)
        $primary_qty = ceil($target_quantity * 0.6);
        $secondary_qty = $target_quantity - $primary_qty;
        
        $bundle[] = [
            'product_id' => $top_favorites[0]['product_id'],
            'name' => $top_favorites[0]['name'],
            'slug' => $top_favorites[0]['slug'],
            'quantity' => $primary_qty
        ];
        
        $bundle[] = [
            'product_id' => $top_favorites[1]['product_id'],
            'name' => $top_favorites[1]['name'],
            'slug' => $top_favorites[1]['slug'],
            'quantity' => $secondary_qty
        ];
        
        return $bundle;
    }
    
    /**
     * Calculate bundle pricing with dynamic discount
     */
    private static function calculate_bundle_pricing($bundle, $profile) {
        $base_price = 0.00;
        
        // Get product prices
        foreach ($bundle as &$item) {
            $product = wc_get_product($item['product_id']);
            
            if (!$product) {
                continue;
            }
            
            $unit_price = floatval($product->get_price());
            $item['unit_price'] = $unit_price;
            $item['subtotal'] = $unit_price * $item['quantity'];
            
            $base_price += $item['subtotal'];
        }
        
        // Calculate discount based on profile score and quantity
        $discount_percentage = self::calculate_discount_percentage($profile, array_sum(array_column($bundle, 'quantity')));
        
        $discount_amount = $base_price * ($discount_percentage / 100);
        $final_price = $base_price - $discount_amount;
        
        return [
            'base_price' => round($base_price, 2),
            'discount_percentage' => $discount_percentage,
            'discount_amount' => round($discount_amount, 2),
            'final_price' => round($final_price, 2),
            'bundle_items' => $bundle
        ];
    }
    
    /**
     * Calculate dynamic discount percentage
     */
    private static function calculate_discount_percentage($profile, $quantity) {
        $base_discount = 0;
        
        // Quantity-based discount
        if ($quantity >= 7) {
            $base_discount = 15;
        } elseif ($quantity >= 5) {
            $base_discount = 12;
        } elseif ($quantity >= 4) {
            $base_discount = 10;
        }
        
        // Profile score bonus (high-value customers get extra discount)
        if ($profile['profile_score'] >= 80) {
            $base_discount += 3;
        } elseif ($profile['profile_score'] >= 60) {
            $base_discount += 2;
        }
        
        return min(20, $base_discount); // Max 20% discount
    }
    
    /**
     * Calculate loyalty points bonus
     */
    private static function calculate_bonus_points($final_price, $profile) {
        // Base points: 1 point per euro
        $base_points = floor($final_price);
        
        // Bonus multiplier for high-value customers
        if ($profile['profile_score'] >= 80) {
            $base_points = $base_points * 1.5;
        } elseif ($profile['profile_score'] >= 60) {
            $base_points = $base_points * 1.25;
        }
        
        return floor($base_points);
    }
    
    /**
     * Save bundle offer to database
     */
    private static function save_bundle_offer($offer_data) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'wg_bundle_offers';
        
        // Set expiration (7 days from now)
        $expires_at = new DateTime();
        $expires_at->modify('+7 days');
        
        $wpdb->insert(
            $table,
            [
                'customer_id' => $offer_data['customer_id'],
                'customer_email' => $offer_data['customer_email'],
                'bundle_products' => json_encode($offer_data['bundle_products']),
                'total_quantity' => $offer_data['total_quantity'],
                'base_price' => $offer_data['base_price'],
                'discount_amount' => $offer_data['discount_amount'],
                'final_price' => $offer_data['final_price'],
                'bonus_points' => $offer_data['bonus_points'],
                'trigger_reason' => $offer_data['trigger_reason'],
                'status' => 'pending',
                'offered_at' => current_time('mysql'),
                'expires_at' => $expires_at->format('Y-m-d H:i:s')
            ],
            ['%d', '%s', '%s', '%d', '%f', '%f', '%f', '%d', '%s', '%s', '%s', '%s']
        );
        
        return $wpdb->insert_id;
    }
    
    /**
     * Generate offer message
     */
    private static function generate_offer_message($bundle, $pricing, $bonus_points) {
        $products_text = [];
        foreach ($bundle as $item) {
            $products_text[] = "{$item['quantity']}x {$item['name']}";
        }
        
        $message = sprintf(
            "🎁 Speciale aanbieding! Bestel %s voor slechts €%.2f (normaal €%.2f) en ontvang %d loyaliteitspunten!",
            implode(' + ', $products_text),
            $pricing['final_price'],
            $pricing['base_price'],
            $bonus_points
        );
        
        return $message;
    }
    
    /**
     * Get active bundle offers for customer
     */
    public static function get_active_offers($customer_email) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'wg_bundle_offers';
        
        $offers = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table 
             WHERE customer_email = %s 
             AND status IN ('pending', 'viewed') 
             AND expires_at > NOW()
             ORDER BY offered_at DESC",
            $customer_email
        ), ARRAY_A);
        
        // Decode JSON fields
        foreach ($offers as &$offer) {
            $offer['bundle_products'] = json_decode($offer['bundle_products'], true);
        }
        
        return $offers;
    }
    
    /**
     * Update offer status
     */
    public static function update_offer_status($offer_id, $status, $conversion_value = null) {
        // 🚀 UPDATE DIRECTLY IN SUPABASE (no MySQL)
        $supabase_url = 'https://dqddlmniyacbiviovgfw.supabase.co';
        $supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZGRsbW5peWFjYml2aW92Z2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyODA4NDMsImV4cCI6MjA2Mzg1Njg0M30.6VPmb9C-q1W5vzdXmZSxEE4RQR4ayXqlqn7m8fPeTb0';
        
        $update_data = [
            'status' => $status,
            'responded_at' => gmdate('Y-m-d\TH:i:s\Z'),
            'updated_at' => gmdate('Y-m-d\TH:i:s\Z')
        ];
        
        // Add viewed_at timestamp if status is 'viewed'
        if ($status === 'viewed') {
            $update_data['viewed_at'] = gmdate('Y-m-d\TH:i:s\Z');
        }
        
        // Add conversion value if provided
        if ($conversion_value !== null) {
            $update_data['conversion_value'] = floatval($conversion_value);
        }
        
        $response = wp_remote_request(
            $supabase_url . '/rest/v1/bundle_offers?id=eq.' . urlencode($offer_id),
            [
                'method' => 'PATCH',
                'headers' => [
                    'Content-Type' => 'application/json',
                    'apikey' => $supabase_key,
                    'Authorization' => 'Bearer ' . $supabase_key,
                    'Prefer' => 'return=representation'
                ],
                'body' => json_encode($update_data),
                'timeout' => 15
            ]
        );
        
        if (is_wp_error($response)) {
            error_log("[Bundle Generator] ❌ Failed to update bundle status in Supabase: " . $response->get_error_message());
            return false;
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        
        if ($status_code === 200) {
            error_log("[Bundle Generator] ✅ Bundle status updated in Supabase: {$offer_id} → {$status}");
            return true;
        } else {
            $body = wp_remote_retrieve_body($response);
            error_log("[Bundle Generator] ⚠️ Failed to update bundle status: $status_code, Body: $body");
            return false;
        }
    }
}

