<?php
/**
 * IP Tracking and Geo Intelligence
 */

if (!defined('ABSPATH')) {
    exit;
}

class WG_IP_Tracker {
    
    /**
     * Hash IP address for GDPR compliance
     */
    public static function hash_ip($ip_address) {
        // Use SHA-256 with a salt for privacy
        $salt = defined('AUTH_KEY') ? AUTH_KEY : 'wg_default_salt';
        return hash('sha256', $ip_address . $salt);
    }
    
    /**
     * Get client IP address
     */
    public static function get_client_ip() {
        $ip_keys = [
            'HTTP_CLIENT_IP',
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_FORWARDED',
            'HTTP_X_CLUSTER_CLIENT_IP',
            'HTTP_FORWARDED_FOR',
            'HTTP_FORWARDED',
            'REMOTE_ADDR'
        ];
        
        foreach ($ip_keys as $key) {
            if (array_key_exists($key, $_SERVER)) {
                $ip_list = explode(',', $_SERVER[$key]);
                $ip = trim($ip_list[0]);
                
                if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    return $ip;
                }
            }
        }
        
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
    
    /**
     * Get geo location from IP (basic implementation)
     */
    public static function get_geo_data($ip_address) {
        // For now, return Netherlands as default
        // In production, integrate with IP geolocation service like ipapi.co or MaxMind
        
        // Basic check for local IPs
        if (filter_var($ip_address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return [
                'country' => 'NL',
                'city' => 'Unknown'
            ];
        }
        
        // Try to get geo data from free API (with caching)
        $transient_key = 'wg_geo_' . md5($ip_address);
        $cached_geo = get_transient($transient_key);
        
        if ($cached_geo !== false) {
            return $cached_geo;
        }
        
        // Call IP API (free tier, no auth needed)
        $response = wp_remote_get("http://ip-api.com/json/{$ip_address}?fields=status,country,countryCode,city");
        
        if (is_wp_error($response)) {
            return [
                'country' => 'NL',
                'city' => 'Unknown'
            ];
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (isset($data['status']) && $data['status'] === 'success') {
            $geo_data = [
                'country' => $data['countryCode'] ?? 'NL',
                'city' => $data['city'] ?? 'Unknown'
            ];
            
            // Cache for 7 days
            set_transient($transient_key, $geo_data, 7 * DAY_IN_SECONDS);
            
            return $geo_data;
        }
        
        return [
            'country' => 'NL',
            'city' => 'Unknown'
        ];
    }
    
    /**
     * Find customer by IP hash
     * ✅ Now searches device tracking history (multi-device support)
     * Returns customer email if IP is recognized
     */
    public static function find_customer_by_ip($ip_address = null) {
        if (!$ip_address) {
            $ip_address = self::get_client_ip();
        }
        
        // Use device tracker for multi-device lookup
        return WG_Device_Tracker::find_customer_by_device($ip_address, null);
    }
    
    /**
     * Find customer by browser fingerprint
     * ✅ Now searches device tracking history (multi-device support)
     * Returns customer email if fingerprint is recognized
     * More reliable than IP (persists across networks)
     */
    public static function find_customer_by_fingerprint($browser_fingerprint) {
        if (!$browser_fingerprint) {
            return null;
        }
        
        // Use device tracker for multi-device lookup
        return WG_Device_Tracker::find_customer_by_device(null, $browser_fingerprint);
    }
    
    /**
     * Merge new email to existing customer profile (same IP = same customer)
     * This handles cases where customer uses different email but same device/IP
     */
    public static function merge_email_to_customer($new_email, $existing_email) {
        global $wpdb;
        
        // Get existing profile
        $table = $wpdb->prefix . 'wg_customer_intelligence';
        $existing_profile = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE customer_email = %s",
            $existing_email
        ));
        
        if (!$existing_profile) {
            return false;
        }
        
        // Check if new email already has a profile
        $new_profile = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE customer_email = %s",
            $new_email
        ));
        
        if ($new_profile) {
            // Both profiles exist - we need to merge them
            // Keep the profile with most orders (highest total_orders)
            if ($new_profile->total_orders > $existing_profile->total_orders) {
                // New profile has more orders, update it with combined data
                $wpdb->update(
                    $table,
                    [
                        'total_orders' => $new_profile->total_orders + $existing_profile->total_orders,
                        'updated_at' => current_time('mysql')
                    ],
                    ['customer_email' => $new_email],
                    ['%d', '%s'],
                    ['%s']
                );
                
                // Delete old profile
                $wpdb->delete($table, ['customer_email' => $existing_email], ['%s']);
                
                return $new_email;
            } else {
                // Existing profile has more/equal orders, update it
                $wpdb->update(
                    $table,
                    [
                        'total_orders' => $existing_profile->total_orders + $new_profile->total_orders,
                        'updated_at' => current_time('mysql')
                    ],
                    ['customer_email' => $existing_email],
                    ['%d', '%s'],
                    ['%s']
                );
                
                // Delete new profile
                $wpdb->delete($table, ['customer_email' => $new_email], ['%s']);
                
                return $existing_email;
            }
        } else {
            // New email doesn't have profile yet, just note it
            // We could create a secondary email table here, but for now just return existing
            return $existing_email;
        }
    }
    
    /**
     * Track or update customer intelligence record with IP + Fingerprint
     * ✅ Now uses multi-device tracking table for ALL devices/IPs
     * 
     * @param int $customer_id Customer ID
     * @param string $customer_email Customer email
     * @param string $ip_address IP address (auto-detected if null)
     * @param string $browser_fingerprint Browser fingerprint hash
     * @param string $event_type Event type (optional, only logged if important)
     * @param array $event_data Event data (optional)
     */
    public static function track_session($customer_id, $customer_email, $ip_address = null, $browser_fingerprint = null, $event_type = null, $event_data = []) {
        global $wpdb;
        
        if (!$ip_address) {
            $ip_address = self::get_client_ip();
        }
        
        $ip_hash = self::hash_ip($ip_address);
        $geo_data = self::get_geo_data($ip_address);
        $user_agent = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : null;
        
        $table = $wpdb->prefix . 'wg_customer_intelligence';
        
        // ✅ STEP 1: Try to recognize customer by existing devices
        $recognized_customer = WG_Device_Tracker::find_customer_by_device($ip_address, $browser_fingerprint);
        
        // If recognized and different email, merge profiles
        if ($recognized_customer && $customer_email && $recognized_customer->customer_email !== $customer_email) {
            error_log("[WG Intelligence] Device match detected! Merging {$customer_email} with {$recognized_customer->customer_email}");
            $customer_email = self::merge_email_to_customer($customer_email, $recognized_customer->customer_email);
        }
        
        // ✅ STEP 2: Track this device/IP in device history (ALWAYS, never overwrite)
        $device_result = WG_Device_Tracker::track_device(
            $customer_email,
            $customer_id,
            $ip_address,
            $browser_fingerprint,
            $user_agent
        );
        
        // ✅ STEP 3: Update or create main customer intelligence profile
        $existing = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE customer_email = %s",
            $customer_email
        ));
        
        if ($existing) {
            // Update existing profile - keep MOST RECENT device info for quick lookup
            $wpdb->update(
                $table,
                [
                    'customer_id' => $customer_id,
                    'ip_hash' => $ip_hash,
                    'browser_fingerprint' => $browser_fingerprint,
                    'geo_country' => $geo_data['country'],
                    'geo_city' => $geo_data['city'],
                    'updated_at' => current_time('mysql')
                ],
                ['customer_email' => $customer_email],
                ['%d', '%s', '%s', '%s', '%s', '%s'],
                ['%s']
            );
            
            $result = [
                'profile_id' => $existing->id,
                'customer_email' => $customer_email,
                'ip_recognized' => ($recognized_customer !== null),
                'fingerprint_recognized' => ($recognized_customer !== null && $browser_fingerprint),
                'device_tracking' => $device_result
            ];
        } else {
            // Create new profile
            $wpdb->insert(
                $table,
                [
                    'customer_id' => $customer_id,
                    'customer_email' => $customer_email,
                    'ip_hash' => $ip_hash,
                    'browser_fingerprint' => $browser_fingerprint,
                    'geo_country' => $geo_data['country'],
                    'geo_city' => $geo_data['city'],
                    'created_at' => current_time('mysql'),
                    'updated_at' => current_time('mysql')
                ],
                ['%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s']
            );
            
            $result = [
                'profile_id' => $wpdb->insert_id,
                'customer_email' => $customer_email,
                'ip_recognized' => false,
                'fingerprint_recognized' => false,
                'device_tracking' => $device_result
            ];
        }
        
        // ✅ ONLY log important events (not every page view!)
        $important_events = [
            'checkout_start',
            'checkout_email_entered',
            'bundle_viewed',
            'bundle_accepted',
            'bundle_rejected',
            'order_completed'
        ];
        
        if ($event_type && in_array($event_type, $important_events)) {
            self::log_event($event_type, $event_data, $customer_id, $customer_email, $ip_address, $browser_fingerprint);
        }
        
        return $result;
    }
    
    /**
     * Log behavioral event
     */
    public static function log_event($event_type, $event_data = [], $customer_id = null, $customer_email = null, $ip_address = null, $browser_fingerprint = null) {
        global $wpdb;
        
        if (!$ip_address) {
            $ip_address = self::get_client_ip();
        }
        $ip_hash = self::hash_ip($ip_address);
        
        // Generate or get session ID
        $session_id = self::get_session_id();
        
        $table = $wpdb->prefix . 'wg_behavioral_events';
        
        $wpdb->insert(
            $table,
            [
                'session_id' => $session_id,
                'customer_id' => $customer_id,
                'customer_email' => $customer_email,
                'ip_hash' => $ip_hash,
                'browser_fingerprint' => $browser_fingerprint, // ✅ Store fingerprint
                'event_type' => $event_type,
                'event_data' => json_encode($event_data),
                'timestamp' => current_time('mysql')
            ],
            ['%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s']
        );
        
        return $wpdb->insert_id;
    }
    
    /**
     * Get or create session ID
     */
    private static function get_session_id() {
        if (!session_id()) {
            session_start();
        }
        
        if (!isset($_SESSION['wg_session_id'])) {
            $_SESSION['wg_session_id'] = wp_generate_password(32, false);
        }
        
        return $_SESSION['wg_session_id'];
    }
}

