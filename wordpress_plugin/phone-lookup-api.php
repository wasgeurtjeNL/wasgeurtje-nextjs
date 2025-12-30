    <?php
    /**
     * Plugin Name: WooCommerce Phone Lookup API
     * Description: Adds a REST API endpoint to search orders by phone number efficiently using direct SQL
     * Version: 1.1
     * Author: Wasgeurtje
     */

    if (!defined('ABSPATH')) {
        exit;
    }

    class WC_Phone_Lookup_API {

        public function __construct() {
            add_action('rest_api_init', array($this, 'register_routes'));
        }

        public function register_routes() {
            // Phone lookup endpoint
            register_rest_route('custom/v1', '/orders-by-phone', array(
                'methods' => 'GET',
                'callback' => array($this, 'get_orders_by_phone'),
                'permission_callback' => '__return_true', // Public endpoint
            ));

            // Theme options endpoint for A/B testing
            register_rest_route('wasgeurtje/v1', '/options', array(
                'methods' => 'GET',
                'callback' => array($this, 'get_theme_options'),
                'permission_callback' => '__return_true', // Public endpoint
            ));
        }

        /**
         * Get theme options from ACF Options Page
         * Used for A/B testing checkout and cart sidebar versions
         */
        public function get_theme_options(WP_REST_Request $request) {
            // Check if ACF is active
            if (function_exists('get_field')) {
                // Get ACF option fields - adjust field names to match your ACF setup
                $checkout_version = get_field('checkout_version', 'option');
                $cart_sidebar_version = get_field('cart_sidebar_version', 'option');
            } else {
                // Fallback to WordPress options if ACF is not active
                $checkout_version = get_option('checkout_version');
                $cart_sidebar_version = get_option('cart_sidebar_version');
            }

            // Return with defaults if not set
            return new WP_REST_Response(array(
                'checkout_version' => $checkout_version ?: 'A',
                'cart_sidebar_version' => $cart_sidebar_version ?: 'A',
            ), 200);
        }

        public function get_orders_by_phone(WP_REST_Request $request) {
            global $wpdb;

            $phone = $request->get_param('phone');
            $last_name = $request->get_param('last_name');
            $debug_mode = $request->get_param('debug') === '1'; // Enable debug with ?debug=1

            $debug_info = array();

            if (empty($phone)) {
                return new WP_REST_Response(array(
                    'success' => false,
                    'error' => 'Phone number is required'
                ), 400);
            }

            if (empty($last_name)) {
                return new WP_REST_Response(array(
                    'success' => false,
                    'error' => 'Last name is required for security verification'
                ), 400);
            }

            // Normalize phone for searching
            $normalized_phone = $this->normalize_phone($phone);
            $normalized_last_name = strtolower(trim($last_name));
            
            $debug_info[] = "🔍 Searching for phone: '$phone'";
            $debug_info[] = "📱 Normalized to: '$normalized_phone'";
            $debug_info[] = "👤 Last name: '$last_name' (normalized: '$normalized_last_name')";
            
            error_log("Phone lookup for: $phone (normalized: $normalized_phone) with last name: $last_name");

            // SQL query to find orders by phone number
            // Using LIKE with wildcards to match different phone formats
            $table_prefix = $wpdb->prefix;
            
            // First, get ALL orders with phone numbers to debug
            $all_phones_query = "
                SELECT DISTINCT pm.meta_value as phone
                FROM {$table_prefix}postmeta pm
                INNER JOIN {$table_prefix}posts p ON p.ID = pm.post_id
                WHERE pm.meta_key = '_billing_phone'
                    AND p.post_type = 'shop_order'
                    AND p.post_status IN ('wc-completed', 'wc-processing', 'wc-on-hold', 'wc-pending')
                ORDER BY p.post_date DESC
                LIMIT 20
            ";
            
            $all_phones = $wpdb->get_results($all_phones_query, ARRAY_A);
            
            $debug_info[] = "📦 Sample phone numbers in database (last 20):";
            error_log("Sample phone numbers in database:");
            foreach ($all_phones as $p) {
                $normalized = $this->normalize_phone($p['phone']);
                $debug_info[] = "  • Raw: '{$p['phone']}' → Normalized: '$normalized'";
                error_log("  - Raw: '" . $p['phone'] . "' -> Normalized: '$normalized'");
            }
            
            // Now search DIRECTLY for orders with matching phone numbers
            // This is much more efficient than getting all orders and filtering
            // We'll search for multiple phone formats to increase chance of match
            $search_patterns = array(
                $normalized_phone,                           // 0618993614
                $phone,                                       // Original input
                str_replace(' ', '', $phone),                 // Remove spaces
                '+31' . substr($normalized_phone, 1),        // +31618993614
                '+31 ' . substr($normalized_phone, 1, 1) . ' ' . substr($normalized_phone, 2), // +31 6 18993614
            );
            
            $debug_info[] = "🔍 Searching for patterns: " . implode(', ', array_unique($search_patterns));
            
            // Build WHERE clause with multiple LIKE conditions
            $like_conditions = array();
            foreach (array_unique($search_patterns) as $pattern) {
                $like_conditions[] = $wpdb->prepare("phone_meta.meta_value LIKE %s", '%' . $wpdb->esc_like($pattern) . '%');
            }
            $where_clause = implode(' OR ', $like_conditions);
            
            $query = "
                SELECT 
                    p.ID as order_id,
                    p.post_date as order_date,
                    MAX(CASE WHEN pm.meta_key = '_billing_phone' THEN pm.meta_value END) as billing_phone,
                    MAX(CASE WHEN pm.meta_key = '_billing_first_name' THEN pm.meta_value END) as billing_first_name,
                    MAX(CASE WHEN pm.meta_key = '_billing_last_name' THEN pm.meta_value END) as billing_last_name,
                    MAX(CASE WHEN pm.meta_key = '_billing_email' THEN pm.meta_value END) as billing_email,
                    MAX(CASE WHEN pm.meta_key = '_billing_address_1' THEN pm.meta_value END) as billing_address_1,
                    MAX(CASE WHEN pm.meta_key = '_billing_address_2' THEN pm.meta_value END) as billing_address_2,
                    MAX(CASE WHEN pm.meta_key = '_billing_city' THEN pm.meta_value END) as billing_city,
                    MAX(CASE WHEN pm.meta_key = '_billing_postcode' THEN pm.meta_value END) as billing_postcode,
                    MAX(CASE WHEN pm.meta_key = '_billing_country' THEN pm.meta_value END) as billing_country
                FROM {$table_prefix}posts p
                INNER JOIN {$table_prefix}postmeta pm ON p.ID = pm.post_id
                INNER JOIN {$table_prefix}postmeta phone_meta ON p.ID = phone_meta.post_id 
                    AND phone_meta.meta_key = '_billing_phone'
                WHERE p.post_type = 'shop_order'
                    AND p.post_status IN ('wc-completed', 'wc-processing', 'wc-on-hold', 'wc-pending')
                    AND ({$where_clause})
                GROUP BY p.ID, p.post_date
                ORDER BY p.post_date DESC
                LIMIT 50
            ";
            
            $debug_info[] = "🔎 Executing targeted phone search query...";
            $results = $wpdb->get_results($query, ARRAY_A);

            $debug_info[] = "📊 Found " . count($results) . " total orders with phones";
            error_log("Found " . count($results) . " total orders with phones");

            if (empty($results)) {
                $debug_info[] = "❌ No orders found in database";
                return new WP_REST_Response(array(
                    'found' => false,
                    'order' => null,
                    'debug' => $debug_info
                ), 200);
            }

                // Filter results to find exact match (phone + last name verification)
                $matching_order = null;
                $debug_info[] = "🔍 Comparing phones and last names:";
                foreach ($results as $row) {
                    $order_phone_normalized = $this->normalize_phone($row['billing_phone']);
                    $order_last_name_normalized = strtolower(trim($row['billing_last_name']));
                    
                    $phone_match = ($order_phone_normalized === $normalized_phone);
                    $last_name_match = ($order_last_name_normalized === $normalized_last_name);
                    
                    $match_symbol = ($phone_match && $last_name_match) ? '✅ MATCH' : '❌';
                    $debug_info[] = "  • Order #{$row['order_id']}: Phone: '$order_phone_normalized' " . 
                                    ($phone_match ? '✓' : '✗') . ", Last name: '$order_last_name_normalized' " . 
                                    ($last_name_match ? '✓' : '✗') . " $match_symbol";
                    error_log("Comparing: Phone '$order_phone_normalized' vs '$normalized_phone', Last name '$order_last_name_normalized' vs '$normalized_last_name'");
                    
                    if ($phone_match && $last_name_match) {
                        $matching_order = $row;
                        $debug_info[] = "✅ BOTH phone AND last name match!";
                        break;
                    }
                }

            if (!$matching_order) {
                $debug_info[] = "❌ No match found for phone + last name combination";
                error_log("No match found for phone + last name combination");
                return new WP_REST_Response(array(
                    'found' => false,
                    'order' => null,
                    'message' => 'No order found with this phone number and last name combination',
                    'debug' => $debug_info
                ), 200);
            }

            $debug_info[] = "✅ Match found: Order #" . $matching_order['order_id'];
            error_log("Match found: Order #" . $matching_order['order_id']);

            // Return formatted response
            $response = array(
                'found' => true,
                'order' => array(
                    'orderId' => (int)$matching_order['order_id'],
                    'orderDate' => $matching_order['order_date'],
                    'billing' => array(
                        'firstName' => $matching_order['billing_first_name'] ?: '',
                        'lastName' => $matching_order['billing_last_name'] ?: '',
                        'phone' => $matching_order['billing_phone'] ?: '',
                        'email' => $matching_order['billing_email'] ?: '',
                        'address1' => $matching_order['billing_address_1'] ?: '',
                        'address2' => $matching_order['billing_address_2'] ?: '',
                        'city' => $matching_order['billing_city'] ?: '',
                        'postcode' => $matching_order['billing_postcode'] ?: '',
                        'country' => $matching_order['billing_country'] ?: '',
                        'fullAddress' => trim(($matching_order['billing_address_1'] ?: '') . ' ' . ($matching_order['billing_address_2'] ?: '')),
                    ),
                ),
                'debug' => $debug_info
            );

            return new WP_REST_Response($response, 200);
        }

        /**
        * Normalize phone number for comparison
        */
        private function normalize_phone($phone) {
            if (empty($phone)) {
                return '';
            }
            
            // Remove spaces, dashes, parentheses
            $normalized = preg_replace('/[\s\-\(\)]/', '', $phone);
            
            // Replace +31 with 0
            $normalized = preg_replace('/^\+31/', '0', $normalized);
            
            // Replace 0031 with 0
            $normalized = preg_replace('/^0031/', '0', $normalized);
            
            return $normalized;
        }
    }

    new WC_Phone_Lookup_API();

