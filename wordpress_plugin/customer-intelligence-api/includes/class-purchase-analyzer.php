<?php
/**
 * Purchase Pattern Analysis Engine
 */

if (!defined('ABSPATH')) {
    exit;
}

class WG_Purchase_Analyzer {
    
    // Excluded product IDs (should never be offered as favorites or in bundles)
    private static $excluded_product_ids = [1893, 334999];
    
    /**
     * Main function: Recalculate customer profile based on order history
     */
    public static function recalculate_profile($customer_email, $customer_id = null) {
        global $wpdb;
        
        // Get customer orders
        $orders = self::get_customer_orders($customer_email, $customer_id);
        
        if (empty($orders)) {
            return [
                'success' => false,
                'message' => 'No orders found for customer'
            ];
        }
        
        // Extract products from orders
        $products_data = self::extract_products_from_orders($orders);
        
        // Calculate product scores (favoriet bepaling)
        $favorite_products = self::calculate_product_scores($products_data);
        
        // Find peak spending
        $peak_spending = self::find_peak_spending($orders);
        
        // Calculate purchase cycle
        $purchase_cycle = self::calculate_purchase_cycle($orders);
        
        // Calculate average order value
        $avg_order_value = self::calculate_avg_order_value($orders);
        
        // Get last order date
        $last_order = self::get_last_order_info($orders);
        
        // Calculate next prime window
        $prime_window = self::calculate_prime_window($last_order['date'], $purchase_cycle);
        
        // Calculate profile score
        $profile_score = self::calculate_profile_score([
            'total_orders' => count($orders),
            'avg_order_value' => $avg_order_value,
            'peak_spending_amount' => $peak_spending['amount'],
            'days_since_last_order' => $last_order['days_ago']
        ]);
        
        // Update database
        $table = $wpdb->prefix . 'wg_customer_intelligence';
        
        $data = [
            'customer_id' => $customer_id,
            'favorite_products' => json_encode($favorite_products),
            'peak_spending_quantity' => $peak_spending['quantity'],
            'peak_spending_amount' => $peak_spending['amount'],
            'avg_order_value' => $avg_order_value,
            'total_orders' => count($orders),
            'last_order_date' => $last_order['date'],
            'days_since_last_order' => $last_order['days_ago'],
            'purchase_cycle_days' => $purchase_cycle,
            'next_prime_window_start' => $prime_window['start'],
            'next_prime_window_end' => $prime_window['end'],
            'profile_score' => $profile_score,
            'last_recalculated' => current_time('mysql')
        ];
        
        // 🚀 WRITE DIRECTLY TO SUPABASE (no MySQL)
        $data['customer_email'] = $customer_email;
        $success = WG_Supabase_Sync::sync_profile($customer_email, $data);
        
        if (!$success) {
            error_log("[Purchase Analyzer] ❌ Failed to save profile to Supabase for: {$customer_email}");
            return [
                'success' => false,
                'message' => 'Failed to save profile to Supabase'
            ];
        }
        
        error_log("[Purchase Analyzer] ✅ Profile saved to Supabase for: {$customer_email}");
        
        return [
            'success' => true,
            'message' => 'Profile recalculated successfully',
            'data' => [
                'favorite_products' => $favorite_products,
                'peak_spending' => $peak_spending,
                'purchase_cycle' => $purchase_cycle,
                'prime_window' => $prime_window,
                'profile_score' => $profile_score
            ]
        ];
    }
    
    /**
     * Get customer orders from WooCommerce
     */
    private static function get_customer_orders($customer_email, $customer_id = null) {
        $args = [
            'limit' => -1,
            'status' => 'completed',
            'orderby' => 'date',
            'order' => 'DESC'
        ];
        
        if ($customer_id) {
            $args['customer_id'] = $customer_id;
        } else {
            $args['billing_email'] = $customer_email;
        }
        
        $orders = wc_get_orders($args);
        
        $order_data = [];
        foreach ($orders as $order) {
            $order_data[] = [
                'id' => $order->get_id(),
                'order_number' => $order->get_order_number(), // ✅ Customer-facing order number
                'date' => $order->get_date_created()->format('Y-m-d H:i:s'),
                'total' => floatval($order->get_total()),
                'status' => $order->get_status(), // ✅ Show status for verification
                'items' => $order->get_items()
            ];
        }
        
        return $order_data;
    }
    
    /**
     * Extract products from orders (exclude wasparfum, wasstrips, etc.)
     * Now tracks which order numbers each product came from
     */
    private static function extract_products_from_orders($orders) {
        $products = [];
        
        // Only analyze last 3 orders, or last 2 if less than 3
        $recent_orders = array_slice($orders, 0, 3);
        
        foreach ($recent_orders as $order) {
            foreach ($order['items'] as $item) {
                $product = $item->get_product();
                
                if (!$product) {
                    continue;
                }
                
                // Check if product should be excluded
                if (self::is_excluded_product($product)) {
                    continue;
                }
                
                $product_id = $product->get_id();
                $quantity = $item->get_quantity();
                
                if (!isset($products[$product_id])) {
                    $products[$product_id] = [
                        'id' => $product_id,
                        'name' => $product->get_name(),
                        'slug' => $product->get_slug(),
                        'total_quantity' => 0,
                        'appearances' => 0,
                        'last_ordered' => $order['date'],
                        'order_numbers' => [], // ✅ Track order numbers
                        'order_details' => []  // ✅ Track order ID + quantity per order
                    ];
                }
                
                $products[$product_id]['total_quantity'] += $quantity;
                $products[$product_id]['appearances']++;
                
                // ✅ Add order tracking
                if (!in_array($order['order_number'], $products[$product_id]['order_numbers'])) {
                    $products[$product_id]['order_numbers'][] = $order['order_number'];
                }
                
                $products[$product_id]['order_details'][] = [
                    'order_id' => $order['id'],
                    'order_number' => $order['order_number'],
                    'quantity' => $quantity,
                    'date' => $order['date']
                ];
            }
        }
        
        return $products;
    }
    
    /**
     * Check if product should be excluded (only specific product IDs)
     */
    private static function is_excluded_product($product) {
        $product_id = $product->get_id();
        
        // Only exclude specific product IDs (1893, 334999)
        return in_array($product_id, self::$excluded_product_ids);
    }
    
    /**
     * Calculate product scores to determine favorites
     */
    /**
     * Calculate product scores based on frequency and recency
     * ✅ Now includes order tracking for transparency
     */
    private static function calculate_product_scores($products) {
        $scored_products = [];
        
        foreach ($products as $product) {
            // Score = (total_quantity * 2) + (appearances * 3)
            // This gives more weight to products ordered multiple times
            $score = ($product['total_quantity'] * 2) + ($product['appearances'] * 3);
            
            $scored_products[] = [
                'product_id' => $product['id'],
                'name' => $product['name'],
                'slug' => $product['slug'],
                'score' => $score,
                'total_quantity' => $product['total_quantity'],
                'appearances' => $product['appearances'],
                'order_numbers' => $product['order_numbers'], // ✅ Show which orders
                'order_details' => $product['order_details']   // ✅ Detailed breakdown
            ];
        }
        
        // Sort by score descending
        usort($scored_products, function($a, $b) {
            return $b['score'] - $a['score'];
        });
        
        // Return top favorites
        return array_slice($scored_products, 0, 5);
    }
    
    /**
     * Find peak spending (highest quantity and amount ever ordered)
     * ✅ Now tracks which order had the peak spending
     */
    private static function find_peak_spending($orders) {
        $peak_quantity = 0;
        $peak_amount = 0.00;
        $peak_order_id = null;
        $peak_order_number = null;
        $peak_order_date = null;
        
        foreach ($orders as $order) {
            $total_quantity = 0;
            
            foreach ($order['items'] as $item) {
                $product = $item->get_product();
                if ($product && !self::is_excluded_product($product)) {
                    $total_quantity += $item->get_quantity();
                }
            }
            
            if ($total_quantity > $peak_quantity) {
                $peak_quantity = $total_quantity;
                $peak_amount = $order['total'];
                $peak_order_id = $order['id'];
                $peak_order_number = $order['order_number']; // ✅ Track order number
                $peak_order_date = $order['date'];
            }
        }
        
        return [
            'quantity' => $peak_quantity,
            'amount' => $peak_amount,
            'order_id' => $peak_order_id,       // ✅ Show which order
            'order_number' => $peak_order_number, // ✅ Customer-facing number
            'order_date' => $peak_order_date     // ✅ When it happened
        ];
    }
    
    /**
     * Calculate purchase cycle (average days between orders)
     */
    private static function calculate_purchase_cycle($orders) {
        if (count($orders) < 2) {
            return 14; // Default to 14 days
        }
        
        $intervals = [];
        
        for ($i = 0; $i < count($orders) - 1; $i++) {
            $date1 = new DateTime($orders[$i]['date']);
            $date2 = new DateTime($orders[$i + 1]['date']);
            $interval = $date1->diff($date2)->days;
            $intervals[] = $interval;
        }
        
        if (empty($intervals)) {
            return 14;
        }
        
        $avg_interval = array_sum($intervals) / count($intervals);
        
        // Round to nearest integer, minimum 7 days
        return max(7, round($avg_interval));
    }
    
    /**
     * Calculate average order value
     */
    private static function calculate_avg_order_value($orders) {
        if (empty($orders)) {
            return 0.00;
        }
        
        $total = array_sum(array_column($orders, 'total'));
        return $total / count($orders);
    }
    
    /**
     * Get last order info
     */
    private static function get_last_order_info($orders) {
        if (empty($orders)) {
            return [
                'date' => null,
                'days_ago' => 999
            ];
        }
        
        $last_order = $orders[0];
        $last_date = new DateTime($last_order['date']);
        $now = new DateTime();
        $days_ago = $now->diff($last_date)->days;
        
        return [
            'date' => $last_order['date'],
            'days_ago' => $days_ago
        ];
    }
    
    /**
     * Calculate prime window (when customer is likely to buy again)
     */
    private static function calculate_prime_window($last_order_date, $purchase_cycle) {
        if (!$last_order_date) {
            return [
                'start' => null,
                'end' => null
            ];
        }
        
        $last_date = new DateTime($last_order_date);
        
        // Prime window starts at 80% of purchase cycle
        $window_start_days = floor($purchase_cycle * 0.8);
        $window_start = clone $last_date;
        $window_start->modify("+{$window_start_days} days");
        
        // Prime window ends at 120% of purchase cycle
        $window_end_days = ceil($purchase_cycle * 1.2);
        $window_end = clone $last_date;
        $window_end->modify("+{$window_end_days} days");
        
        return [
            'start' => $window_start->format('Y-m-d H:i:s'),
            'end' => $window_end->format('Y-m-d H:i:s')
        ];
    }
    
    /**
     * Calculate overall profile score (0-100)
     */
    private static function calculate_profile_score($metrics) {
        $score = 0;
        
        // Orders weight (0-30 points)
        $score += min(30, $metrics['total_orders'] * 5);
        
        // AOV weight (0-30 points)
        $aov_score = min(30, ($metrics['avg_order_value'] / 10) * 3);
        $score += $aov_score;
        
        // Recency weight (0-40 points)
        $days_ago = $metrics['days_since_last_order'];
        if ($days_ago <= 14) {
            $score += 40;
        } elseif ($days_ago <= 30) {
            $score += 30;
        } elseif ($days_ago <= 60) {
            $score += 20;
        } elseif ($days_ago <= 90) {
            $score += 10;
        }
        
        return min(100, $score);
    }
    
    /**
     * Get customer profile from database
     */
    public static function get_profile($customer_email) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'wg_customer_intelligence';
        
        $profile = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE customer_email = %s",
            $customer_email
        ), ARRAY_A);
        
        if (!$profile) {
            return null;
        }
        
        // Decode JSON fields
        if (isset($profile['favorite_products'])) {
            $profile['favorite_products'] = json_decode($profile['favorite_products'], true);
        }
        
        return $profile;
    }
}

