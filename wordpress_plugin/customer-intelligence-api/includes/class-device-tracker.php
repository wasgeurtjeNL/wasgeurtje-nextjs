<?php
/**
 * Device Tracker - Multi-Device & Network History Tracking
 * 
 * Tracks ALL devices and IP addresses used by customers
 * Enables multi-device recognition and network history
 * 
 * @package WG_Customer_Intelligence
 */

if (!defined('ABSPATH')) {
    exit;
}

class WG_Device_Tracker {
    
    /**
     * Track or update device/network for a customer
     * 
     * @param string $customer_email Customer email
     * @param int $customer_id Customer ID (optional)
     * @param string $ip_address IP address (auto-detected if not provided)
     * @param string $browser_fingerprint Browser fingerprint hash (optional)
     * @param string $user_agent User agent string (optional)
     * @return array Device tracking result
     */
    public static function track_device($customer_email, $customer_id = null, $ip_address = null, $browser_fingerprint = null, $user_agent = null) {
        global $wpdb;
        
        if (!$customer_email) {
            return ['success' => false, 'message' => 'Customer email required'];
        }
        
        // Get IP if not provided
        if (!$ip_address) {
            $ip_address = self::get_client_ip();
        }
        
        $ip_hash = self::hash_ip($ip_address);
        $geo_data = self::get_geo_data($ip_address);
        $table = $wpdb->prefix . 'wg_device_tracking';
        
        // Check if this exact device combination already exists
        $existing = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE customer_email = %s AND ip_hash = %s AND browser_fingerprint = %s",
            $customer_email,
            $ip_hash,
            $browser_fingerprint
        ));
        
        if ($existing) {
            // Update existing device record
            $wpdb->update(
                $table,
                [
                    'last_seen' => current_time('mysql'),
                    'visit_count' => $existing->visit_count + 1,
                    'user_agent' => $user_agent,
                    'geo_country' => $geo_data['country'],
                    'geo_city' => $geo_data['city']
                ],
                ['id' => $existing->id],
                ['%s', '%d', '%s', '%s', '%s'],
                ['%d']
            );
            
            return [
                'success' => true,
                'action' => 'updated',
                'device_id' => $existing->id,
                'visit_count' => $existing->visit_count + 1,
                'is_new_device' => false
            ];
        } else {
            // Insert new device record
            $wpdb->insert(
                $table,
                [
                    'customer_email' => $customer_email,
                    'customer_id' => $customer_id,
                    'ip_hash' => $ip_hash,
                    'browser_fingerprint' => $browser_fingerprint,
                    'first_seen' => current_time('mysql'),
                    'last_seen' => current_time('mysql'),
                    'visit_count' => 1,
                    'user_agent' => $user_agent,
                    'geo_country' => $geo_data['country'],
                    'geo_city' => $geo_data['city']
                ],
                ['%s', '%d', '%s', '%s', '%s', '%s', '%d', '%s', '%s', '%s']
            );
            
            return [
                'success' => true,
                'action' => 'created',
                'device_id' => $wpdb->insert_id,
                'visit_count' => 1,
                'is_new_device' => true
            ];
        }
    }
    
    /**
     * Find customer by device (IP or fingerprint)
     * Searches ALL devices to find matching customer
     * 
     * @param string $ip_address IP address (optional)
     * @param string $browser_fingerprint Browser fingerprint (optional)
     * @return object|null Customer info if found
     */
    public static function find_customer_by_device($ip_address = null, $browser_fingerprint = null) {
        global $wpdb;
        
        if (!$ip_address && !$browser_fingerprint) {
            return null;
        }
        
        $table = $wpdb->prefix . 'wg_device_tracking';
        $conditions = [];
        $values = [];
        
        // Build query based on what we have
        if ($browser_fingerprint) {
            $conditions[] = "browser_fingerprint = %s";
            $values[] = $browser_fingerprint;
        }
        
        if ($ip_address) {
            $ip_hash = self::hash_ip($ip_address);
            $conditions[] = "ip_hash = %s";
            $values[] = $ip_hash;
        }
        
        $where = implode(' OR ', $conditions);
        $query = "SELECT customer_email, customer_id, MAX(last_seen) as last_seen 
                  FROM $table 
                  WHERE $where 
                  GROUP BY customer_email 
                  ORDER BY last_seen DESC 
                  LIMIT 1";
        
        $customer = $wpdb->get_row($wpdb->prepare($query, $values));
        
        return $customer;
    }
    
    /**
     * Get all devices for a customer
     * 
     * @param string $customer_email Customer email
     * @return array Array of device records
     */
    public static function get_customer_devices($customer_email) {
        global $wpdb;
        
        if (!$customer_email) {
            return [];
        }
        
        $table = $wpdb->prefix . 'wg_device_tracking';
        
        $devices = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $table WHERE customer_email = %s ORDER BY last_seen DESC",
            $customer_email
        ));
        
        return $devices ? $devices : [];
    }
    
    /**
     * Get device count for customer
     * 
     * @param string $customer_email Customer email
     * @return int Number of unique devices
     */
    public static function get_device_count($customer_email) {
        global $wpdb;
        
        if (!$customer_email) {
            return 0;
        }
        
        $table = $wpdb->prefix . 'wg_device_tracking';
        
        $count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $table WHERE customer_email = %s",
            $customer_email
        ));
        
        return intval($count);
    }
    
    /**
     * Cleanup old devices (GDPR compliance - 1 year retention)
     * 
     * @param int $days_inactive Number of days of inactivity before deletion
     * @return int Number of records deleted
     */
    public static function cleanup_old_devices($days_inactive = 365) {
        global $wpdb;
        
        $table = $wpdb->prefix . 'wg_device_tracking';
        
        $deleted = $wpdb->query($wpdb->prepare(
            "DELETE FROM $table WHERE last_seen < DATE_SUB(NOW(), INTERVAL %d DAY)",
            $days_inactive
        ));
        
        return intval($deleted);
    }
    
    /**
     * Get client IP address
     */
    private static function get_client_ip() {
        $ip_keys = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'];
        
        foreach ($ip_keys as $key) {
            if (!empty($_SERVER[$key])) {
                $ip = $_SERVER[$key];
                if (strpos($ip, ',') !== false) {
                    $ip = trim(explode(',', $ip)[0]);
                }
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }
        
        return '0.0.0.0';
    }
    
    /**
     * Hash IP address (SHA-256 for GDPR compliance)
     */
    private static function hash_ip($ip) {
        return hash('sha256', $ip);
    }
    
    /**
     * Get geo-location data from IP
     */
    private static function get_geo_data($ip) {
        // Basic geo-location (can be enhanced with MaxMind or ip-api.com)
        $geo_data = ['country' => null, 'city' => null];
        
        try {
            $response = wp_remote_get("http://ip-api.com/json/{$ip}?fields=status,country,countryCode,city", [
                'timeout' => 2,
                'sslverify' => false
            ]);
            
            if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200) {
                $data = json_decode(wp_remote_retrieve_body($response), true);
                if ($data && $data['status'] === 'success') {
                    $geo_data['country'] = $data['countryCode'];
                    $geo_data['city'] = $data['city'];
                }
            }
        } catch (Exception $e) {
            // Silent fail - geo data is optional
        }
        
        return $geo_data;
    }
}


