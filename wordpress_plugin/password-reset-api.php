<?php
/**
 * Plugin Name: Password Reset API
 * Description: Adds REST API endpoint for password reset functionality
 * Version: 1.0.0
 * Author: Wasgeurtje
 */

if (!defined('ABSPATH')) {
    exit;
}

class Password_Reset_API {
    
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
    }
    
    /**
     * Register REST API routes
     */
    public function register_routes() {
        register_rest_route('custom/v1', '/password-reset', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_password_reset'),
            'permission_callback' => '__return_true',
            'args' => array(
                'email' => array(
                    'required' => true,
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_email',
                    'validate_callback' => array($this, 'validate_email'),
                ),
            ),
        ));
    }
    
    /**
     * Validate email parameter
     */
    public function validate_email($param, $request, $key) {
        return is_email($param);
    }
    
    /**
     * Handle password reset request
     */
    public function handle_password_reset($request) {
        $email = $request->get_param('email');
        
        if (empty($email)) {
            return new WP_REST_Response(
                array('error' => 'E-mailadres is verplicht'),
                400
            );
        }
        
        // Sanitize email
        $email = sanitize_email($email);
        
        if (!is_email($email)) {
            return new WP_REST_Response(
                array('error' => 'Voer een geldig e-mailadres in'),
                400
            );
        }
        
        // Check if user exists (by email or username)
        $user = get_user_by('email', $email);
        
        if (!$user) {
            // Also try to get user by username in case email was used as username
            $user = get_user_by('login', $email);
        }
        
        if (!$user) {
            // For security, don't reveal if user exists or not
            // Just return success message
            return new WP_REST_Response(
                array(
                    'success' => true,
                    'message' => 'Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten een e-mail met instructies.'
                ),
                200
            );
        }
        
        // User exists, send password reset email
        $result = $this->send_password_reset_email($user);
        
        if (is_wp_error($result)) {
            error_log('Password reset error: ' . $result->get_error_message());
            
            return new WP_REST_Response(
                array('error' => 'Er is een fout opgetreden bij het versturen van de resetlink. Probeer het later opnieuw.'),
                500
            );
        }
        
        return new WP_REST_Response(
            array(
                'success' => true,
                'message' => 'Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten een e-mail met instructies.'
            ),
            200
        );
    }
    
    /**
     * Send password reset email
     */
    private function send_password_reset_email($user) {
        // Generate reset key
        $key = get_password_reset_key($user);
        
        if (is_wp_error($key)) {
            return $key;
        }
        
        // Get user login and email
        $user_login = $user->user_login;
        $user_email = $user->user_email;
        
        // Build reset link
        $reset_url = network_site_url(
            "wp-login.php?action=rp&key=$key&login=" . rawurlencode($user_login),
            'login'
        );
        
        // Email subject
        $subject = sprintf('[%s] Wachtwoord Reset', wp_specialchars_decode(get_option('blogname'), ENT_QUOTES));
        
        // Email message
        $message = __('Hoi,') . "\r\n\r\n";
        $message .= __('Er is een verzoek gedaan om het wachtwoord voor het volgende account te resetten:') . "\r\n\r\n";
        $message .= network_home_url('/') . "\r\n\r\n";
        $message .= sprintf(__('Gebruikersnaam: %s'), $user_login) . "\r\n\r\n";
        $message .= __('Als dit een vergissing was, negeer deze e-mail dan en er zal niets gebeuren.') . "\r\n\r\n";
        $message .= __('Klik op de onderstaande link om een nieuw wachtwoord in te stellen:') . "\r\n\r\n";
        $message .= $reset_url . "\r\n\r\n";
        $message .= __('Deze link is 24 uur geldig.') . "\r\n\r\n";
        $message .= __('Met vriendelijke groet,') . "\r\n";
        $message .= __('Het Wasgeurtje team') . "\r\n";
        
        // Email headers
        $headers = array('Content-Type: text/plain; charset=UTF-8');
        
        // Send email
        $sent = wp_mail($user_email, $subject, $message, $headers);
        
        if (!$sent) {
            return new WP_Error('email_failed', 'Failed to send password reset email');
        }
        
        // Log for debugging (remove in production)
        error_log("Password reset email sent to: $user_email");
        
        return true;
    }
}

// Initialize the plugin
new Password_Reset_API();

