<?php
/**
 * Plugin Name: Customer Intelligence API
 * Description: Advanced customer intelligence system for personalized bundle offers and abandoned cart recovery
 * Version: 1.0.0
 * Author: Wasgeurtje
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

// Plugin constants
define('WG_INTELLIGENCE_VERSION', '1.2.0');
define('WG_INTELLIGENCE_DB_VERSION', '1.2'); // ✅ Updated for multi-device tracking
define('WG_INTELLIGENCE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WG_INTELLIGENCE_PLUGIN_URL', plugin_dir_url(__FILE__));

// Activation hook
register_activation_hook(__FILE__, 'wg_intelligence_activate');
register_deactivation_hook(__FILE__, 'wg_intelligence_deactivate');

/**
 * Plugin activation - create database tables
 */
function wg_intelligence_activate() {
    global $wpdb;
    
    $charset_collate = $wpdb->get_charset_collate();
    
    // Table 1: Customer Intelligence Profiles
    $table_intelligence = $wpdb->prefix . 'wg_customer_intelligence';
    $sql_intelligence = "CREATE TABLE IF NOT EXISTS $table_intelligence (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        customer_id bigint(20) UNSIGNED NULL,
        customer_email varchar(100) NOT NULL,
        ip_hash varchar(64) NOT NULL,
        browser_fingerprint varchar(64) NULL COMMENT 'SHA-256 hash of browser fingerprint',
        geo_country varchar(2) NULL,
        geo_city varchar(100) NULL,
        
        favorite_products longtext NULL COMMENT 'JSON array of product IDs with scores',
        peak_spending_quantity int(11) DEFAULT 0,
        peak_spending_amount decimal(10,2) DEFAULT 0.00,
        avg_order_value decimal(10,2) DEFAULT 0.00,
        total_orders int(11) DEFAULT 0,
        
        last_order_date datetime NULL,
        days_since_last_order int(11) DEFAULT 0,
        purchase_cycle_days int(11) DEFAULT 14,
        next_prime_window_start datetime NULL,
        next_prime_window_end datetime NULL,
        
        profile_score decimal(5,2) DEFAULT 0.00 COMMENT 'Overall customer value score',
        last_recalculated datetime NULL,
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        PRIMARY KEY (id),
        UNIQUE KEY customer_email (customer_email),
        KEY customer_id (customer_id),
        KEY ip_hash (ip_hash),
        KEY browser_fingerprint (browser_fingerprint),
        KEY next_prime_window_start (next_prime_window_start)
    ) $charset_collate;";
    
    // Table 2: Bundle Offers
    $table_bundles = $wpdb->prefix . 'wg_bundle_offers';
    $sql_bundles = "CREATE TABLE IF NOT EXISTS $table_bundles (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        customer_id bigint(20) UNSIGNED NULL,
        customer_email varchar(100) NOT NULL,
        
        bundle_products longtext NOT NULL COMMENT 'JSON array of {product_id, quantity, name}',
        total_quantity int(11) NOT NULL,
        base_price decimal(10,2) NOT NULL,
        discount_amount decimal(10,2) NOT NULL,
        final_price decimal(10,2) NOT NULL,
        bonus_points int(11) DEFAULT 0,
        
        trigger_reason varchar(50) NOT NULL COMMENT 'cart_value|loyalty_tier|abandonment',
        cart_snapshot longtext NULL COMMENT 'JSON of current cart when offer was made',
        
        status varchar(20) DEFAULT 'pending' COMMENT 'pending|viewed|added_to_cart|purchased|expired|rejected',
        offered_at datetime DEFAULT CURRENT_TIMESTAMP,
        viewed_at datetime NULL,
        responded_at datetime NULL,
        expires_at datetime NULL,
        
        conversion_value decimal(10,2) NULL COMMENT 'Actual order value if converted',
        
        PRIMARY KEY (id),
        KEY customer_email (customer_email),
        KEY customer_id (customer_id),
        KEY status (status),
        KEY offered_at (offered_at)
    ) $charset_collate;";
    
    // Table 3: Behavioral Events (for session tracking)
    $table_events = $wpdb->prefix . 'wg_behavioral_events';
    $sql_events = "CREATE TABLE IF NOT EXISTS $table_events (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        session_id varchar(64) NOT NULL,
        customer_id bigint(20) UNSIGNED NULL,
        customer_email varchar(100) NULL,
        ip_hash varchar(64) NOT NULL,
        browser_fingerprint varchar(64) NULL COMMENT 'SHA-256 hash of browser fingerprint',
        
        event_type varchar(50) NOT NULL COMMENT 'session_start|cart_update|bundle_view|checkout_start|etc',
        event_data longtext NULL COMMENT 'JSON data specific to event type',
        
        timestamp datetime DEFAULT CURRENT_TIMESTAMP,
        
        PRIMARY KEY (id),
        KEY session_id (session_id),
        KEY customer_email (customer_email),
        KEY browser_fingerprint (browser_fingerprint),
        KEY event_type (event_type),
        KEY timestamp (timestamp)
    ) $charset_collate;";
    
    // Table 4: Device Tracking (Multi-Device & Network History)
    $table_devices = $wpdb->prefix . 'wg_device_tracking';
    $sql_devices = "CREATE TABLE IF NOT EXISTS $table_devices (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        customer_email varchar(100) NOT NULL,
        customer_id bigint(20) UNSIGNED NULL,
        
        ip_hash varchar(64) NOT NULL COMMENT 'SHA-256 hash of IP address',
        browser_fingerprint varchar(64) NULL COMMENT 'SHA-256 hash of browser fingerprint',
        
        first_seen datetime NOT NULL COMMENT 'First time this device/IP was seen',
        last_seen datetime NOT NULL COMMENT 'Most recent visit from this device/IP',
        visit_count int(11) DEFAULT 1 COMMENT 'Number of times this device was used',
        
        user_agent text NULL COMMENT 'Browser user agent string',
        geo_country varchar(2) NULL COMMENT 'Country code from IP geolocation',
        geo_city varchar(100) NULL COMMENT 'City from IP geolocation',
        
        PRIMARY KEY (id),
        UNIQUE KEY unique_device (customer_email, ip_hash, browser_fingerprint),
        KEY customer_email (customer_email),
        KEY ip_hash (ip_hash),
        KEY browser_fingerprint (browser_fingerprint),
        KEY last_seen (last_seen)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql_intelligence);
    dbDelta($sql_bundles);
    dbDelta($sql_events);
    dbDelta($sql_devices);
    
    // Store DB version
    update_option('wg_intelligence_db_version', WG_INTELLIGENCE_DB_VERSION);
    
    // Log activation
    error_log('WG Intelligence Plugin activated - Tables created');
}

/**
 * Plugin deactivation
 */
function wg_intelligence_deactivate() {
    // Don't drop tables on deactivation, only on uninstall
    error_log('WG Intelligence Plugin deactivated');
}

// Include REST API endpoints
require_once WG_INTELLIGENCE_PLUGIN_DIR . 'includes/class-rest-api.php';
require_once WG_INTELLIGENCE_PLUGIN_DIR . 'includes/class-purchase-analyzer.php';
require_once WG_INTELLIGENCE_PLUGIN_DIR . 'includes/class-bundle-generator.php';
require_once WG_INTELLIGENCE_PLUGIN_DIR . 'includes/class-ip-tracker.php';
require_once WG_INTELLIGENCE_PLUGIN_DIR . 'includes/class-device-tracker.php';
require_once WG_INTELLIGENCE_PLUGIN_DIR . 'includes/class-supabase-sync.php';

// Initialize REST API
add_action('rest_api_init', function() {
    $rest_api = new WG_Intelligence_REST_API();
    $rest_api->register_routes();
});

/**
 * Automatically recalculate customer profile after order completion
 * This ensures we always have up-to-date data for bundle generation
 */
add_action('woocommerce_order_status_completed', 'wg_auto_recalculate_profile_on_order', 10, 1);
add_action('woocommerce_order_status_processing', 'wg_auto_recalculate_profile_on_order', 10, 1);

function wg_auto_recalculate_profile_on_order($order_id) {
    try {
        $order = wc_get_order($order_id);
        
        if (!$order) {
            error_log("[WG Intelligence] Order not found: $order_id");
            return;
        }
        
        $customer_email = $order->get_billing_email();
        $customer_id = $order->get_customer_id();
        
        if (!$customer_email) {
            error_log("[WG Intelligence] No email found for order: $order_id");
            return;
        }
        
        error_log("[WG Intelligence] Auto-recalculating profile for: $customer_email (Order: $order_id)");
        
        // Recalculate customer profile
        $result = WG_Purchase_Analyzer::recalculate_profile($customer_email, $customer_id);
        
        if ($result['success']) {
            error_log("[WG Intelligence] ✅ Profile recalculated successfully for: $customer_email");
            
            // Log summary
            if (isset($result['data'])) {
                $data = $result['data'];
                error_log(sprintf(
                    "[WG Intelligence] Profile summary: %d orders, Peak: %d items, Cycle: %d days",
                    $data['total_orders'],
                    $data['peak_spending_quantity'],
                    $data['purchase_cycle_days']
                ));
            }
            
            // 🚀 SYNC TO SUPABASE
            $profile_data = WG_Supabase_Sync::get_profile_data($customer_email);
            if ($profile_data) {
                WG_Supabase_Sync::sync_profile($customer_email, $profile_data);
            }
        } else {
            error_log("[WG Intelligence] ⚠️ Profile recalculation failed: " . $result['message']);
        }
        
    } catch (Exception $e) {
        error_log("[WG Intelligence] ❌ Error in auto-recalculation: " . $e->getMessage());
    }
}

