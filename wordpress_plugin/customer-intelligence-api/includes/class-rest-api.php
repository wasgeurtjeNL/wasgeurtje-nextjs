<?php
/**
 * REST API Endpoints for Customer Intelligence
 */

if (!defined('ABSPATH')) {
    exit;
}

class WG_Intelligence_REST_API {
    
    private $namespace = 'wg/v1';
    
    /**
     * Register all REST API routes
     */
    public function register_routes() {
        
        // Track session (IP + customer info)
        register_rest_route($this->namespace, '/intelligence/track-session', [
            'methods' => 'POST',
            'callback' => [$this, 'track_session'],
            'permission_callback' => '__return_true'
        ]);
        
        // Get customer profile
        register_rest_route($this->namespace, '/intelligence/profile', [
            'methods' => 'GET',
            'callback' => [$this, 'get_profile'],
            'permission_callback' => '__return_true'
        ]);
        
        // Recalculate customer profile
        register_rest_route($this->namespace, '/intelligence/recalculate', [
            'methods' => 'POST',
            'callback' => [$this, 'recalculate_profile'],
            'permission_callback' => '__return_true'
        ]);
        
        // Get bundle suggestion
        register_rest_route($this->namespace, '/intelligence/bundle', [
            'methods' => 'GET',
            'callback' => [$this, 'get_bundle'],
            'permission_callback' => '__return_true'
        ]);
        
        // Update bundle offer status
        register_rest_route($this->namespace, '/intelligence/bundle-status', [
            'methods' => 'POST',
            'callback' => [$this, 'update_bundle_status'],
            'permission_callback' => '__return_true'
        ]);
        
        // Log behavioral event
        register_rest_route($this->namespace, '/intelligence/log-event', [
            'methods' => 'POST',
            'callback' => [$this, 'log_event'],
            'permission_callback' => '__return_true'
        ]);
        
        // Get active offers for customer
        register_rest_route($this->namespace, '/intelligence/active-offers', [
            'methods' => 'GET',
            'callback' => [$this, 'get_active_offers'],
            'permission_callback' => '__return_true'
        ]);
    }
    
    /**
     * Track session endpoint
     * Supports:
     * - Email + IP + Fingerprint tracking
     * - IP/Fingerprint-only tracking (for anonymous visitor recognition)
     */
    public function track_session($request) {
        $customer_id = $request->get_param('customer_id');
        $customer_email = $request->get_param('customer_email');
        $ip_address = $request->get_param('ip_address');
        $browser_fingerprint = $request->get_param('browser_fingerprint');
        $event_type = $request->get_param('event_type'); // ✅ Get event type (optional)
        $event_data = $request->get_param('event_data') ?: []; // ✅ Get event data (optional)
        
        try {
            // If no email provided, try to find customer by IP or fingerprint
            if (!$customer_email) {
                // Try IP first
                $ip_customer = WG_IP_Tracker::find_customer_by_ip($ip_address);
                
                if ($ip_customer) {
                    // IP recognized! Return customer info
                    error_log("[WG Intelligence] IP recognized: {$ip_customer->customer_email}");
                    
                    return new WP_REST_Response([
                        'success' => true,
                        'customer_email' => $ip_customer->customer_email,
                        'customer_id' => $ip_customer->customer_id,
                        'ip_recognized' => true,
                        'fingerprint_recognized' => false,
                        'message' => 'IP recognized, customer identified'
                    ], 200);
                }
                
                // Try fingerprint if IP didn't match
                if ($browser_fingerprint) {
                    $fp_customer = WG_IP_Tracker::find_customer_by_fingerprint($browser_fingerprint);
                    
                    if ($fp_customer) {
                        // Fingerprint recognized! Return customer info
                        error_log("[WG Intelligence] Fingerprint recognized: {$fp_customer->customer_email}");
                        
                        return new WP_REST_Response([
                            'success' => true,
                            'customer_email' => $fp_customer->customer_email,
                            'customer_id' => $fp_customer->customer_id,
                            'ip_recognized' => false,
                            'fingerprint_recognized' => true,
                            'message' => 'Fingerprint recognized, customer identified'
                        ], 200);
                    }
                }
                
                // Neither IP nor fingerprint recognized
                return new WP_REST_Response([
                    'success' => true,
                    'ip_recognized' => false,
                    'fingerprint_recognized' => false,
                    'message' => 'Anonymous visitor'
                ], 200);
            }
            
            // Email provided, track session normally
            // ✅ Pass event_type and event_data - only important events will be logged
            $result = WG_IP_Tracker::track_session(
                $customer_id, 
                $customer_email, 
                $ip_address, 
                $browser_fingerprint,
                $event_type,  // Optional - only logged if in important_events list
                $event_data   // Optional - event metadata
            );
            
            return new WP_REST_Response([
                'success' => true,
                'profile_id' => $result['profile_id'],
                'customer_email' => $result['customer_email'],
                'ip_recognized' => $result['ip_recognized'],
                'fingerprint_recognized' => $result['fingerprint_recognized'],
                'message' => 'Customer tracked successfully'
            ], 200);
            
        } catch (Exception $e) {
            return new WP_REST_Response([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Get profile endpoint
     */
    public function get_profile($request) {
        $customer_email = $request->get_param('customer_email');
        $customer_id = $request->get_param('customer_id');
        
        if (!$customer_email && !$customer_id) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Customer email or ID is required'
            ], 400);
        }
        
        // If only ID provided, get email from WooCommerce
        if ($customer_id && !$customer_email) {
            $customer = new WC_Customer($customer_id);
            $customer_email = $customer->get_email();
        }
        
        $profile = WG_Purchase_Analyzer::get_profile($customer_email);
        
        if (!$profile) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Profile not found',
                'suggest_action' => 'recalculate'
            ], 404);
        }
        
        // ✅ Add first_name and last_name from WooCommerce
        $profile['first_name'] = '';
        $profile['last_name'] = '';
        
        if ($customer_id) {
            $wc_customer = new WC_Customer($customer_id);
            $profile['first_name'] = $wc_customer->get_first_name();
            $profile['last_name'] = $wc_customer->get_last_name();
        } else if ($customer_email) {
            // Try to find user by email
            $user = get_user_by('email', $customer_email);
            if ($user) {
                $wc_customer = new WC_Customer($user->ID);
                $profile['first_name'] = $wc_customer->get_first_name();
                $profile['last_name'] = $wc_customer->get_last_name();
            } else {
                // Fallback: get from most recent order
                $orders = wc_get_orders([
                    'customer' => $customer_email,
                    'limit' => 1,
                    'orderby' => 'date',
                    'order' => 'DESC',
                    'status' => ['completed', 'processing']
                ]);
                if (!empty($orders)) {
                    $latest_order = $orders[0];
                    $profile['first_name'] = $latest_order->get_billing_first_name();
                    $profile['last_name'] = $latest_order->get_billing_last_name();
                }
            }
        }
        
        return new WP_REST_Response([
            'success' => true,
            'profile' => $profile
        ], 200);
    }
    
    /**
     * Recalculate profile endpoint
     */
    public function recalculate_profile($request) {
        $customer_email = $request->get_param('customer_email');
        $customer_id = $request->get_param('customer_id');
        
        if (!$customer_email && !$customer_id) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Customer email or ID is required'
            ], 400);
        }
        
        // If only ID provided, get email from WooCommerce
        if ($customer_id && !$customer_email) {
            $customer = new WC_Customer($customer_id);
            $customer_email = $customer->get_email();
        }
        
        try {
            $result = WG_Purchase_Analyzer::recalculate_profile($customer_email, $customer_id);
            
            // 🚀 SYNC TO SUPABASE
            if ($result['success']) {
                $profile_data = WG_Supabase_Sync::get_profile_data($customer_email);
                if ($profile_data) {
                    WG_Supabase_Sync::sync_profile($customer_email, $profile_data);
                }
            }
            
            return new WP_REST_Response($result, $result['success'] ? 200 : 400);
            
        } catch (Exception $e) {
            return new WP_REST_Response([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Get bundle suggestion endpoint
     */
    public function get_bundle($request) {
        $customer_email = $request->get_param('customer_email');
        $customer_id = $request->get_param('customer_id');
        $browser_fingerprint = $request->get_param('fingerprint'); // Accept fingerprint parameter
        
        // Try to identify customer by fingerprint if no email/ID provided
        if (!$customer_email && !$customer_id && $browser_fingerprint) {
            error_log("[WG Intelligence] Bundle request with fingerprint only, attempting to identify customer");
            
            $fp_customer = WG_IP_Tracker::find_customer_by_fingerprint($browser_fingerprint);
            
            if ($fp_customer) {
                error_log("[WG Intelligence] Customer identified by fingerprint: {$fp_customer->customer_email}");
                $customer_email = $fp_customer->customer_email;
                $customer_id = $fp_customer->customer_id;
            } else {
                // Also try IP as fallback
                $ip_customer = WG_IP_Tracker::find_customer_by_ip();
                if ($ip_customer) {
                    error_log("[WG Intelligence] Customer identified by IP: {$ip_customer->customer_email}");
                    $customer_email = $ip_customer->customer_email;
                    $customer_id = $ip_customer->customer_id;
                }
            }
        }
        
        if (!$customer_email && !$customer_id) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Customer email, ID, or fingerprint is required'
            ], 400);
        }
        
        // If only ID provided, get email from WooCommerce
        if ($customer_id && !$customer_email) {
            $customer = new WC_Customer($customer_id);
            $customer_email = $customer->get_email();
        }
        
        try {
            $bundle = WG_Bundle_Generator::generate_bundle($customer_email, $customer_id);
            
            return new WP_REST_Response($bundle, $bundle['success'] ? 200 : 400);
            
        } catch (Exception $e) {
            return new WP_REST_Response([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Update bundle status endpoint
     */
    public function update_bundle_status($request) {
        $offer_id = $request->get_param('offer_id');
        $status = $request->get_param('status');
        $conversion_value = $request->get_param('conversion_value');
        $customer_email = $request->get_param('customer_email');
        
        if (!$offer_id || !$status) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Offer ID and status are required'
            ], 400);
        }
        
        $allowed_statuses = ['pending', 'viewed', 'added_to_cart', 'purchased', 'expired', 'rejected'];
        if (!in_array($status, $allowed_statuses)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Invalid status'
            ], 400);
        }
        
        try {
            WG_Bundle_Generator::update_offer_status($offer_id, $status, $conversion_value);
            
            // ✅ Log important bundle events
            if ($customer_email) {
                $event_type = null;
                
                // Map status to event type for important events only
                $status_to_event = [
                    'viewed' => 'bundle_viewed',
                    'added_to_cart' => 'bundle_accepted',
                    'rejected' => 'bundle_rejected'
                ];
                
                if (isset($status_to_event[$status])) {
                    WG_IP_Tracker::log_event(
                        $status_to_event[$status],
                        [
                            'offer_id' => $offer_id,
                            'status' => $status,
                            'conversion_value' => $conversion_value
                        ],
                        null, // customer_id unknown here
                        $customer_email
                    );
                }
            }
            
            return new WP_REST_Response([
                'success' => true,
                'message' => 'Bundle status updated'
            ], 200);
            
        } catch (Exception $e) {
            return new WP_REST_Response([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Log event endpoint
     */
    public function log_event($request) {
        $event_type = $request->get_param('event_type');
        $event_data = $request->get_param('event_data');
        $customer_id = $request->get_param('customer_id');
        $customer_email = $request->get_param('customer_email');
        $ip_address = $request->get_param('ip_address'); // ✅ Get IP from request
        $browser_fingerprint = $request->get_param('browser_fingerprint');
        
        if (!$event_type) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Event type is required'
            ], 400);
        }
        
        try {
            // ✅ CRITICAL FIX: Use IP from request instead of null
            $event_id = WG_IP_Tracker::log_event($event_type, $event_data, $customer_id, $customer_email, $ip_address, $browser_fingerprint);
            
            return new WP_REST_Response([
                'success' => true,
                'event_id' => $event_id
            ], 200);
            
        } catch (Exception $e) {
            return new WP_REST_Response([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Get active offers endpoint
     */
    public function get_active_offers($request) {
        $customer_email = $request->get_param('customer_email');
        $customer_id = $request->get_param('customer_id');
        
        if (!$customer_email && !$customer_id) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Customer email or ID is required'
            ], 400);
        }
        
        // If only ID provided, get email from WooCommerce
        if ($customer_id && !$customer_email) {
            $customer = new WC_Customer($customer_id);
            $customer_email = $customer->get_email();
        }
        
        try {
            $offers = WG_Bundle_Generator::get_active_offers($customer_email);
            
            return new WP_REST_Response([
                'success' => true,
                'offers' => $offers,
                'count' => count($offers)
            ], 200);
            
        } catch (Exception $e) {
            return new WP_REST_Response([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }
}

