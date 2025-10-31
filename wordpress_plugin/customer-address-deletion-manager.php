<?php
/**
 * Plugin Name: Customer Address Deletion Manager
 * Description: Manages deleted customer addresses across devices using WordPress user meta
 * Version: 1.0.1
 * Author: Wasgeurtje.nl
 * Requires at least: 5.0
 * Requires PHP: 7.0
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class Customer_Address_Deletion_Manager {
    
    const META_KEY = 'deleted_addresses';
    const API_NAMESPACE = 'custom/v1';
    
    /**
     * Constructor
     */
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
    }
    
    /**
     * Register REST API endpoints
     */
    public function register_routes() {
        // Delete address endpoint
        register_rest_route(self::API_NAMESPACE, '/delete-address', array(
            'methods'             => 'POST',
            'callback'            => array($this, 'delete_address'),
            'permission_callback' => '__return_true',
        ));
        
        // Get deleted addresses endpoint
        register_rest_route(self::API_NAMESPACE, '/deleted-addresses', array(
            'methods'             => 'GET',
            'callback'            => array($this, 'get_deleted_addresses'),
            'permission_callback' => '__return_true',
        ));
        
        // Restore address endpoint
        register_rest_route(self::API_NAMESPACE, '/restore-address', array(
            'methods'             => 'POST',
            'callback'            => array($this, 'restore_address'),
            'permission_callback' => '__return_true',
        ));
        
        // Clear all deleted addresses endpoint
        register_rest_route(self::API_NAMESPACE, '/clear-deleted-addresses', array(
            'methods'             => 'POST',
            'callback'            => array($this, 'clear_deleted_addresses'),
            'permission_callback' => '__return_true',
        ));
    }
    
    /**
     * Delete an address (add to deleted list)
     */
    public function delete_address($request) {
        $email = sanitize_email($request->get_param('email'));
        $address_id = sanitize_text_field($request->get_param('addressId'));
        
        if (empty($email) || empty($address_id)) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Email and addressId are required',
            ), 400);
        }
        
        $customer = get_user_by('email', $email);
        
        if (!$customer) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Customer not found',
            ), 404);
        }
        
        $deleted_addresses = get_user_meta($customer->ID, self::META_KEY, true);
        
        if (!is_array($deleted_addresses)) {
            $deleted_addresses = array();
        }
        
        if (!in_array($address_id, $deleted_addresses)) {
            $deleted_addresses[] = $address_id;
            update_user_meta($customer->ID, self::META_KEY, $deleted_addresses);
            
            $this->log_action($customer->ID, 'delete', $address_id);
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Address deleted successfully',
            'data'    => array(
                'addressId'        => $address_id,
                'deletedAddresses' => $deleted_addresses,
                'totalDeleted'     => count($deleted_addresses),
            ),
        ), 200);
    }
    
    /**
     * Get all deleted addresses for a customer
     */
    public function get_deleted_addresses($request) {
        $email = sanitize_email($request->get_param('email'));
        
        if (empty($email)) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Email is required',
            ), 400);
        }
        
        $customer = get_user_by('email', $email);
        
        if (!$customer) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Customer not found',
            ), 404);
        }
        
        $deleted_addresses = get_user_meta($customer->ID, self::META_KEY, true);
        
        if (!is_array($deleted_addresses)) {
            $deleted_addresses = array();
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'data'    => array(
                'customerId'       => $customer->ID,
                'email'            => $email,
                'deletedAddresses' => $deleted_addresses,
                'totalDeleted'     => count($deleted_addresses),
            ),
        ), 200);
    }
    
    /**
     * Restore a deleted address
     */
    public function restore_address($request) {
        $email = sanitize_email($request->get_param('email'));
        $address_id = sanitize_text_field($request->get_param('addressId'));
        
        if (empty($email) || empty($address_id)) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Email and addressId are required',
            ), 400);
        }
        
        $customer = get_user_by('email', $email);
        
        if (!$customer) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Customer not found',
            ), 404);
        }
        
        $deleted_addresses = get_user_meta($customer->ID, self::META_KEY, true);
        
        if (!is_array($deleted_addresses)) {
            $deleted_addresses = array();
        }
        
        $deleted_addresses = array_values(array_diff($deleted_addresses, array($address_id)));
        
        update_user_meta($customer->ID, self::META_KEY, $deleted_addresses);
        
        $this->log_action($customer->ID, 'restore', $address_id);
        
        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Address restored successfully',
            'data'    => array(
                'addressId'        => $address_id,
                'deletedAddresses' => $deleted_addresses,
                'totalDeleted'     => count($deleted_addresses),
            ),
        ), 200);
    }
    
    /**
     * Clear all deleted addresses
     */
    public function clear_deleted_addresses($request) {
        $email = sanitize_email($request->get_param('email'));
        
        if (empty($email)) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Email is required',
            ), 400);
        }
        
        $customer = get_user_by('email', $email);
        
        if (!$customer) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Customer not found',
            ), 404);
        }
        
        $deleted_addresses = get_user_meta($customer->ID, self::META_KEY, true);
        $count_before = is_array($deleted_addresses) ? count($deleted_addresses) : 0;
        
        delete_user_meta($customer->ID, self::META_KEY);
        
        $this->log_action($customer->ID, 'clear_all', 'all');
        
        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'All deleted addresses cleared successfully',
            'data'    => array(
                'clearedCount' => $count_before,
            ),
        ), 200);
    }
    
    /**
     * Log actions for debugging
     */
    private function log_action($user_id, $action, $address_id) {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log(sprintf(
                '[Address Deletion] User ID: %d | Action: %s | Address ID: %s | Time: %s',
                $user_id,
                $action,
                $address_id,
                current_time('mysql')
            ));
        }
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_submenu_page(
            'users.php',
            'Deleted Addresses',
            'Deleted Addresses',
            'manage_options',
            'deleted-addresses-manager',
            array($this, 'render_admin_page')
        );
    }
    
    /**
     * Render admin page
     */
    public function render_admin_page() {
        ?>
        <div class="wrap">
            <h1>Customer Deleted Addresses Manager</h1>
            
            <div class="card">
                <h2>API Endpoints</h2>
                <p>The following REST API endpoints are available:</p>
                
                <h3>1. Delete Address</h3>
                <code>POST <?php echo esc_url(rest_url('custom/v1/delete-address')); ?></code>
                <pre>{"email": "customer@example.com", "addressId": "abc123"}</pre>
                
                <h3>2. Get Deleted Addresses</h3>
                <code>GET <?php echo esc_url(rest_url('custom/v1/deleted-addresses')); ?>?email=customer@example.com</code>
                
                <h3>3. Restore Address</h3>
                <code>POST <?php echo esc_url(rest_url('custom/v1/restore-address')); ?></code>
                <pre>{"email": "customer@example.com", "addressId": "abc123"}</pre>
                
                <h3>4. Clear All Deleted Addresses</h3>
                <code>POST <?php echo esc_url(rest_url('custom/v1/clear-deleted-addresses')); ?></code>
                <pre>{"email": "customer@example.com"}</pre>
            </div>
            
            <div class="card">
                <h2>Recent Customers with Deleted Addresses</h2>
                <?php $this->display_customers_with_deleted_addresses(); ?>
            </div>
        </div>
        <style>
            .card { 
                background: white; 
                padding: 20px; 
                margin: 20px 0; 
                border: 1px solid #ccd0d4;
                box-shadow: 0 1px 1px rgba(0,0,0,.04);
            }
            code { 
                background: #f0f0f1; 
                padding: 5px 10px; 
                display: inline-block;
                margin: 10px 0;
            }
            pre {
                background: #f0f0f1;
                padding: 15px;
                overflow-x: auto;
            }
        </style>
        <?php
    }
    
    /**
     * Display customers with deleted addresses
     */
    private function display_customers_with_deleted_addresses() {
        global $wpdb;
        
        $results = $wpdb->get_results($wpdb->prepare(
            "SELECT user_id, meta_value 
             FROM {$wpdb->usermeta} 
             WHERE meta_key = %s 
             ORDER BY umeta_id DESC 
             LIMIT 20",
            self::META_KEY
        ));
        
        if (empty($results)) {
            echo '<p>No customers have deleted addresses yet.</p>';
            return;
        }
        
        echo '<table class="wp-list-table widefat fixed striped">';
        echo '<thead><tr>';
        echo '<th>Customer</th>';
        echo '<th>Email</th>';
        echo '<th>Deleted Addresses</th>';
        echo '<th>Count</th>';
        echo '</tr></thead>';
        echo '<tbody>';
        
        foreach ($results as $row) {
            $user = get_userdata($row->user_id);
            if (!$user) {
                continue;
            }
            
            $deleted_addresses = maybe_unserialize($row->meta_value);
            $count = is_array($deleted_addresses) ? count($deleted_addresses) : 0;
            
            echo '<tr>';
            echo '<td><strong>' . esc_html($user->display_name) . '</strong></td>';
            echo '<td>' . esc_html($user->user_email) . '</td>';
            echo '<td><code>' . esc_html(implode(', ', (array)$deleted_addresses)) . '</code></td>';
            echo '<td>' . esc_html($count) . '</td>';
            echo '</tr>';
        }
        
        echo '</tbody></table>';
    }
}

// Initialize the plugin
new Customer_Address_Deletion_Manager();

/**
 * AJAX Fallback for backwards compatibility
 */
add_action('wp_ajax_delete_customer_address', 'cadm_ajax_delete_customer_address');
add_action('wp_ajax_nopriv_delete_customer_address', 'cadm_ajax_delete_customer_address');

function cadm_ajax_delete_customer_address() {
    $email = isset($_POST['email']) ? sanitize_email($_POST['email']) : '';
    $address_id = isset($_POST['addressId']) ? sanitize_text_field($_POST['addressId']) : '';
    
    if (empty($email) || empty($address_id)) {
        wp_send_json_error(array('message' => 'Email and addressId are required'));
        return;
    }
    
    $customer = get_user_by('email', $email);
    
    if (!$customer) {
        wp_send_json_error(array('message' => 'Customer not found'));
        return;
    }
    
    $deleted_addresses = get_user_meta($customer->ID, 'deleted_addresses', true);
    
    if (!is_array($deleted_addresses)) {
        $deleted_addresses = array();
    }
    
    if (!in_array($address_id, $deleted_addresses)) {
        $deleted_addresses[] = $address_id;
        update_user_meta($customer->ID, 'deleted_addresses', $deleted_addresses);
    }
    
    wp_send_json_success(array(
        'message' => 'Address deleted successfully',
        'deletedAddresses' => $deleted_addresses,
    ));
}
