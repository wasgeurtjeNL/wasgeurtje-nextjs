<?php
/**
 * Plugin Name: WP Loyalty Points API
 * Description: REST API endpoint om loyalty punten op te halen via email
 * Version: 1.0.0
 * Author: Wasgeurtje.nl
 * 
 * Installatie:
 * 1. Upload dit bestand naar wp-content/plugins/
 * 2. Activeer de plugin in WordPress admin
 * 3. De endpoint is beschikbaar op: /wp-json/my/v1/loyalty/points?email={email}
 */

defined( 'ABSPATH' ) or die( 'No direct access allowed' );

/**
 * Register custom REST API endpoint for loyalty points
 */
add_action( 'rest_api_init', function () {
    register_rest_route( 'my/v1', '/loyalty/points', array(
        'methods'             => 'GET',
        'callback'            => 'get_loyalty_points_by_email',
        'permission_callback' => '__return_true', // Public endpoint - iedereen mag deze aanroepen
        'args'                => array(
            'email' => array(
                'required'          => true,
                'type'              => 'string',
                'validate_callback' => function( $param ) {
                    return is_email( $param );
                },
                'sanitize_callback' => 'sanitize_email',
            ),
        ),
    ) );
} );

/**
 * Get loyalty points for a user by email
 * 
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function get_loyalty_points_by_email( $request ) {
    global $wpdb;
    
    // Get email from query parameter
    $email = $request->get_param( 'email' );
    
    if ( empty( $email ) ) {
        return new WP_Error( 
            'missing_email', 
            'Email parameter is required', 
            array( 'status' => 400 ) 
        );
    }
    
    // Validate email format
    if ( ! is_email( $email ) ) {
        return new WP_Error( 
            'invalid_email', 
            'Invalid email format', 
            array( 'status' => 400 ) 
        );
    }
    
    // Query WP Loyalty Users table
    $table_name = $wpdb->prefix . 'wlr_users';
    
    // Check if table exists
    $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$table_name'" );
    if ( $table_exists !== $table_name ) {
        return new WP_Error(
            'table_not_found',
            'WP Loyalty plugin table not found. Is WP Loyalty installed and activated?',
            array( 'status' => 500 )
        );
    }
    
    // Get loyalty data for user
    $loyalty_user = $wpdb->get_row( 
        $wpdb->prepare( 
            "SELECT 
                points, 
                earn_total_point as earned, 
                level_id,
                refer_code,
                used_total_points
            FROM $table_name 
            WHERE user_email = %s 
            LIMIT 1",
            $email 
        ),
        ARRAY_A
    );
    
    // If user not found in loyalty table, return zero points
    if ( ! $loyalty_user ) {
        // Log voor debugging
        error_log( sprintf( 
            '[WP Loyalty API] No loyalty data found for email: %s', 
            $email 
        ) );
        
        return rest_ensure_response( array(
            'points'      => 0,
            'earned'      => 0,
            'level_id'    => 0,
            'refer_code'  => '',
            'used_points' => 0,
            'status'      => 'not_found',
            'message'     => 'No loyalty data found for this email'
        ) );
    }
    
    // Convert string values to integers
    $response = array(
        'points'      => (int) $loyalty_user['points'],
        'earned'      => (int) $loyalty_user['earned'],
        'level_id'    => (int) $loyalty_user['level_id'],
        'refer_code'  => (string) $loyalty_user['refer_code'],
        'used_points' => (int) $loyalty_user['used_total_points'],
        'status'      => 'success'
    );
    
    // Log voor debugging (optioneel - verwijder in productie)
    error_log( sprintf( 
        '[WP Loyalty API] Successfully fetched loyalty data for email: %s, points: %d', 
        $email,
        $response['points']
    ) );
    
    return rest_ensure_response( $response );
}

/**
 * Add custom headers to allow CORS
 */
add_action( 'rest_api_init', function() {
    remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
    add_filter( 'rest_pre_serve_request', function( $value ) {
        header( 'Access-Control-Allow-Origin: *' );
        header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' );
        header( 'Access-Control-Allow-Credentials: true' );
        header( 'Access-Control-Allow-Headers: Authorization, Content-Type' );
        return $value;
    });
}, 15 );

/**
 * Activation hook - check if WP Loyalty is installed
 */
register_activation_hook( __FILE__, 'wp_loyalty_api_activation_check' );

function wp_loyalty_api_activation_check() {
    global $wpdb;
    
    $table_name = $wpdb->prefix . 'wlr_users';
    $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '$table_name'" );
    
    if ( $table_exists !== $table_name ) {
        deactivate_plugins( plugin_basename( __FILE__ ) );
        wp_die( 
            'WP Loyalty Points API requires WP Loyalty plugin to be installed and activated. Please install WP Loyalty first.',
            'Plugin Activation Error',
            array( 'back_link' => true )
        );
    }
}

