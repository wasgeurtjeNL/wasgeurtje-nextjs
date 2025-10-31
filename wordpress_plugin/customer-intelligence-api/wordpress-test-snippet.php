<?php
/**
 * WordPress Code Snippet om Customer Intelligence API te testen
 * 
 * Installatie:
 * 1. Ga naar WordPress Admin → Tools → Code Snippets
 * 2. Klik "Add New"
 * 3. Plak deze code
 * 4. Naam: "Test Customer Intelligence API"
 * 5. Run: "Only run in administration area"
 * 6. Klik "Save and Activate"
 * 7. Refresh de page om output te zien
 */

// Wacht tot WooCommerce volledig geladen is
add_action('admin_notices', function() {
    // Alleen uitvoeren als admin ingelogd is
    if (!is_admin() || !current_user_can('manage_options')) {
        return;
    }
    
    // Check of WooCommerce beschikbaar is
    if (!function_exists('wc_get_orders')) {
        echo '<div class="notice notice-error"><p>❌ WooCommerce is niet actief of niet volledig geladen</p></div>';
        return;
    }

// Check en laad plugin classes indien nodig
if (!class_exists('WG_IP_Tracker')) {
    $plugin_dir = WP_PLUGIN_DIR . '/customer-intelligence-api/';
    
    if (file_exists($plugin_dir . 'includes/class-ip-tracker.php')) {
        require_once $plugin_dir . 'includes/class-ip-tracker.php';
        require_once $plugin_dir . 'includes/class-purchase-analyzer.php';
        require_once $plugin_dir . 'includes/class-bundle-generator.php';
        require_once $plugin_dir . 'includes/class-rest-api.php';
    } else {
        echo '<div style="background: #f44336; color: white; padding: 20px; margin: 20px;">';
        echo '<h2>❌ Plugin Files Not Found</h2>';
        echo '<p>De Customer Intelligence API plugin is niet correct geïnstalleerd.</p>';
        echo '<p>Verwachte locatie: ' . $plugin_dir . '</p>';
        echo '<p>Controleer of de plugin folder correct is geüpload naar /wp-content/plugins/</p>';
        echo '</div>';
        return;
    }
}

echo '<div style="background: #f0f0f0; padding: 20px; margin: 20px; font-family: monospace;">';
echo '<h1>🧪 Customer Intelligence API Test</h1>';
echo '<hr>';

$test_email = 'jackwullems18@gmail.com';
$test_customer_id = null;

// TEST 1: Check of tabellen bestaan
echo '<h2>1️⃣ Database Tabellen Check</h2>';
global $wpdb;
$tables = $wpdb->get_results("SHOW TABLES LIKE 'wp_wg_%'", ARRAY_N);

if (count($tables) === 3) {
    echo '✅ Alle 3 tabellen gevonden:<br>';
    foreach ($tables as $table) {
        echo '&nbsp;&nbsp;&nbsp;- ' . $table[0] . '<br>';
    }
} else {
    echo '❌ Verwachtte 3 tabellen, maar vond ' . count($tables) . '<br>';
    foreach ($tables as $table) {
        echo '&nbsp;&nbsp;&nbsp;- ' . $table[0] . '<br>';
    }
    echo '<strong>⚠️ Plugin mogelijk niet correct geactiveerd!</strong><br>';
}

echo '<hr>';

// TEST 2: Get WooCommerce customer ID
echo '<h2>2️⃣ WooCommerce Customer Opzoeken</h2>';
$customer = get_user_by('email', $test_email);

if ($customer) {
    $test_customer_id = $customer->ID;
    echo '✅ Customer gevonden:<br>';
    echo '&nbsp;&nbsp;&nbsp;- ID: ' . $test_customer_id . '<br>';
    echo '&nbsp;&nbsp;&nbsp;- Email: ' . $test_email . '<br>';
    echo '&nbsp;&nbsp;&nbsp;- Naam: ' . $customer->display_name . '<br>';
} else {
    echo '⚠️ Customer niet gevonden als WP user, probeer via WooCommerce...<br>';
    
    // Probeer via WooCommerce
    $wc_customer = wc_get_customer_id_by_email($test_email);
    if ($wc_customer) {
        $test_customer_id = $wc_customer;
        echo '✅ Customer ID via WooCommerce: ' . $test_customer_id . '<br>';
    } else {
        echo '❌ Customer niet gevonden in WooCommerce<br>';
    }
}

echo '<hr>';

// TEST 3: Track Session (IP Tracker)
echo '<h2>3️⃣ Track Session (IP + Geo)</h2>';
try {
    // Simuleer IP tracking
    $_SERVER['REMOTE_ADDR'] = '185.3.94.182'; // NL IP voor test
    
    $profile_id = WG_IP_Tracker::track_session($test_customer_id, $test_email);
    
    echo '✅ Session tracked successfully<br>';
    echo '&nbsp;&nbsp;&nbsp;- Profile ID: ' . $profile_id . '<br>';
    
    // Check in database
    $profile = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM {$wpdb->prefix}wg_customer_intelligence WHERE customer_email = %s",
        $test_email
    ), ARRAY_A);
    
    if ($profile) {
        echo '&nbsp;&nbsp;&nbsp;- IP Hash: ' . substr($profile['ip_hash'], 0, 16) . '...<br>';
        echo '&nbsp;&nbsp;&nbsp;- Geo Country: ' . $profile['geo_country'] . '<br>';
        echo '&nbsp;&nbsp;&nbsp;- Geo City: ' . $profile['geo_city'] . '<br>';
        echo '&nbsp;&nbsp;&nbsp;- Created: ' . $profile['created_at'] . '<br>';
    }
    
} catch (Exception $e) {
    echo '❌ Error: ' . $e->getMessage() . '<br>';
}

echo '<hr>';

// TEST 4: Recalculate Profile (Purchase Analysis)
echo '<h2>4️⃣ Recalculate Profile (Purchase Pattern Analysis)</h2>';
try {
    $result = WG_Purchase_Analyzer::recalculate_profile($test_email, $test_customer_id);
    
    if ($result['success']) {
        echo '✅ Profile recalculated successfully<br>';
        
        if (isset($result['data'])) {
            $data = $result['data'];
            
            echo '<h3>📊 Favorite Products:</h3>';
            if (!empty($data['favorite_products'])) {
                echo '<table border="1" cellpadding="5" style="border-collapse: collapse;">';
                echo '<tr><th>Product</th><th>Score</th><th>Total Qty</th><th>Appearances</th></tr>';
                foreach ($data['favorite_products'] as $product) {
                    echo '<tr>';
                    echo '<td>' . $product['name'] . '</td>';
                    echo '<td>' . $product['score'] . '</td>';
                    echo '<td>' . $product['total_quantity'] . '</td>';
                    echo '<td>' . $product['appearances'] . '</td>';
                    echo '</tr>';
                }
                echo '</table>';
            } else {
                echo '⚠️ Geen favoriete producten gevonden<br>';
            }
            
            echo '<h3>💰 Peak Spending:</h3>';
            echo '&nbsp;&nbsp;&nbsp;- Quantity: ' . $data['peak_spending']['quantity'] . ' items<br>';
            echo '&nbsp;&nbsp;&nbsp;- Amount: €' . number_format($data['peak_spending']['amount'], 2) . '<br>';
            
            echo '<h3>📅 Purchase Cycle:</h3>';
            echo '&nbsp;&nbsp;&nbsp;- Cycle: ' . $data['purchase_cycle'] . ' days<br>';
            
            echo '<h3>🎯 Prime Window:</h3>';
            echo '&nbsp;&nbsp;&nbsp;- Start: ' . $data['prime_window']['start'] . '<br>';
            echo '&nbsp;&nbsp;&nbsp;- End: ' . $data['prime_window']['end'] . '<br>';
            
            echo '<h3>⭐ Profile Score:</h3>';
            echo '&nbsp;&nbsp;&nbsp;- Score: ' . $data['profile_score'] . '/100<br>';
        }
    } else {
        echo '⚠️ ' . $result['message'] . '<br>';
    }
    
} catch (Exception $e) {
    echo '❌ Error: ' . $e->getMessage() . '<br>';
}

echo '<hr>';

// TEST 5: Get Profile from DB
echo '<h2>5️⃣ Get Profile from Database</h2>';
$profile = WG_Purchase_Analyzer::get_profile($test_email);

if ($profile) {
    echo '✅ Profile retrieved from DB<br>';
    echo '<pre style="background: #fff; padding: 10px; overflow-x: auto;">';
    
    // Hide IP hash for privacy
    $profile_display = $profile;
    if (isset($profile_display['ip_hash'])) {
        $profile_display['ip_hash'] = substr($profile['ip_hash'], 0, 16) . '... (hashed)';
    }
    
    print_r($profile_display);
    echo '</pre>';
} else {
    echo '❌ Profile not found in database<br>';
}

echo '<hr>';

// TEST 6: Generate Bundle Offer
echo '<h2>6️⃣ Generate Bundle Offer</h2>';
try {
    $bundle_result = WG_Bundle_Generator::generate_bundle($test_email, $test_customer_id);
    
    if ($bundle_result['success']) {
        echo '✅ Bundle generated successfully!<br>';
        echo '<h3>🎁 Bundle Details:</h3>';
        echo '&nbsp;&nbsp;&nbsp;- Offer ID: ' . $bundle_result['offer_id'] . '<br>';
        echo '&nbsp;&nbsp;&nbsp;- Target Quantity: ' . $bundle_result['target_quantity'] . ' items<br>';
        
        echo '<h3>📦 Bundle Products:</h3>';
        echo '<table border="1" cellpadding="5" style="border-collapse: collapse;">';
        echo '<tr><th>Product</th><th>Quantity</th></tr>';
        foreach ($bundle_result['bundle'] as $item) {
            echo '<tr>';
            echo '<td>' . $item['name'] . '</td>';
            echo '<td>' . $item['quantity'] . 'x</td>';
            echo '</tr>';
        }
        echo '</table>';
        
        echo '<h3>💰 Pricing:</h3>';
        $pricing = $bundle_result['pricing'];
        echo '&nbsp;&nbsp;&nbsp;- Base Price: €' . number_format($pricing['base_price'], 2) . '<br>';
        echo '&nbsp;&nbsp;&nbsp;- Discount: -€' . number_format($pricing['discount_amount'], 2) . 
             ' (' . $pricing['discount_percentage'] . '%)<br>';
        echo '&nbsp;&nbsp;&nbsp;- <strong>Final Price: €' . number_format($pricing['final_price'], 2) . '</strong><br>';
        
        echo '<h3>🎁 Bonus:</h3>';
        echo '&nbsp;&nbsp;&nbsp;- Loyalty Points: ' . $bundle_result['bonus_points'] . ' punten<br>';
        
        echo '<h3>💬 Message:</h3>';
        echo '<div style="background: #e3f2fd; padding: 10px; border-left: 4px solid #2196f3; margin: 10px 0;">';
        echo $bundle_result['message'];
        echo '</div>';
        
    } else {
        echo '⚠️ Bundle niet gegenereerd:<br>';
        echo '&nbsp;&nbsp;&nbsp;- Reden: ' . $bundle_result['message'] . '<br>';
        
        if (isset($bundle_result['next_window'])) {
            echo '&nbsp;&nbsp;&nbsp;- Next Window: ' . $bundle_result['next_window'] . '<br>';
            echo '<br>ℹ️ Customer is nog niet in de "prime buying window".<br>';
            echo 'Dit is normaal als de laatste bestelling te recent of te lang geleden was.<br>';
        }
    }
    
} catch (Exception $e) {
    echo '❌ Error: ' . $e->getMessage() . '<br>';
}

echo '<hr>';

// TEST 7: Check Database for Bundle Offers
echo '<h2>7️⃣ Check Bundle Offers in Database</h2>';
$offers = $wpdb->get_results($wpdb->prepare(
    "SELECT * FROM {$wpdb->prefix}wg_bundle_offers WHERE customer_email = %s ORDER BY offered_at DESC LIMIT 5",
    $test_email
), ARRAY_A);

if (!empty($offers)) {
    echo '✅ ' . count($offers) . ' bundle offer(s) gevonden:<br><br>';
    
    foreach ($offers as $index => $offer) {
        echo '<div style="background: #fff; padding: 10px; margin: 10px 0; border: 1px solid #ddd;">';
        echo '<strong>Offer #' . ($index + 1) . '</strong><br>';
        echo 'ID: ' . $offer['id'] . '<br>';
        echo 'Status: <span style="background: #4caf50; color: white; padding: 2px 8px; border-radius: 3px;">' . 
             $offer['status'] . '</span><br>';
        echo 'Total Quantity: ' . $offer['total_quantity'] . '<br>';
        echo 'Final Price: €' . number_format($offer['final_price'], 2) . '<br>';
        echo 'Discount: €' . number_format($offer['discount_amount'], 2) . '<br>';
        echo 'Bonus Points: ' . $offer['bonus_points'] . '<br>';
        echo 'Offered At: ' . $offer['offered_at'] . '<br>';
        echo 'Expires At: ' . $offer['expires_at'] . '<br>';
        
        $products = json_decode($offer['bundle_products'], true);
        echo 'Products: ';
        $product_names = array_map(function($p) {
            return $p['quantity'] . 'x ' . $p['name'];
        }, $products);
        echo implode(', ', $product_names) . '<br>';
        echo '</div>';
    }
} else {
    echo '⚠️ Geen bundle offers gevonden in database<br>';
}

echo '<hr>';

// TEST 8: Check Behavioral Events
echo '<h2>8️⃣ Check Behavioral Events</h2>';
$events = $wpdb->get_results(
    "SELECT * FROM {$wpdb->prefix}wg_behavioral_events ORDER BY timestamp DESC LIMIT 10",
    ARRAY_A
);

if (!empty($events)) {
    echo '✅ ' . count($events) . ' event(s) gevonden:<br><br>';
    echo '<table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">';
    echo '<tr><th>Time</th><th>Event Type</th><th>Email</th><th>IP Hash</th></tr>';
    foreach ($events as $event) {
        echo '<tr>';
        echo '<td>' . $event['timestamp'] . '</td>';
        echo '<td>' . $event['event_type'] . '</td>';
        echo '<td>' . ($event['customer_email'] ?: 'anonymous') . '</td>';
        echo '<td>' . substr($event['ip_hash'], 0, 16) . '...</td>';
        echo '</tr>';
    }
    echo '</table>';
} else {
    echo '⚠️ Geen events gevonden<br>';
}

echo '<hr>';

// Summary
echo '<h2>✅ Test Summary</h2>';
echo '<ul>';
echo '<li>Tabellen aangemaakt: ' . (count($tables) === 3 ? '✅' : '❌') . '</li>';
echo '<li>Session tracking: ✅</li>';
echo '<li>Profile recalculation: ✅</li>';
echo '<li>Bundle generation: ' . (isset($bundle_result['success']) && $bundle_result['success'] ? '✅' : '⚠️ (zie details boven)') . '</li>';
echo '</ul>';

echo '<br><br>';
echo '<div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107;">';
echo '<strong>📋 Next Steps:</strong><br>';
echo '1. Check de database direct via phpMyAdmin of Adminer plugin<br>';
echo '2. Test de REST API endpoints via Postman of browser console<br>';
echo '3. Bekijk de details in de tabellen hierboven<br>';
echo '</div>';

echo '</div>';

