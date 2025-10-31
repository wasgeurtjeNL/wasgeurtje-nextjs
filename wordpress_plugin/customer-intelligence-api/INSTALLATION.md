# 📦 Installatie Instructies - Customer Intelligence API

## Stap 1: Upload Plugin naar WordPress

### Optie A: Via FTP/SFTP
1. Connect naar je WordPress server via FTP
2. Navigeer naar `/wp-content/plugins/`
3. Upload de hele `customer-intelligence-api` folder
4. Zorg dat de structuur is:
   ```
   /wp-content/plugins/customer-intelligence-api/
   ├── customer-intelligence-api.php
   ├── includes/
   │   ├── class-rest-api.php
   │   ├── class-purchase-analyzer.php
   │   ├── class-bundle-generator.php
   │   └── class-ip-tracker.php
   ├── README.md
   └── INSTALLATION.md
   ```

### Optie B: Via WordPress Admin (ZIP)
1. Zip de `customer-intelligence-api` folder
2. Ga naar WordPress Admin → Plugins → Add New
3. Klik "Upload Plugin"
4. Upload de ZIP file
5. Klik "Install Now"

### Optie C: Via Code Snippets (voor quick test)
Als je geen FTP toegang hebt, kun je tijdelijk de code in Code Snippets plaatsen.

## Stap 2: Activeer de Plugin

1. Log in op WordPress Admin: https://wasgeurtje.nl/wp-admin
   - Email: `rk.werken@gmail.com`
   - Password: `Haspelsstraat1!`

2. Ga naar **Plugins** → **Installed Plugins**

3. Zoek "Customer Intelligence API"

4. Klik **Activate**

5. Check de database of tabellen zijn aangemaakt:
   - Ga naar Tools → Code Snippets → Add New
   - Plak deze code:
   ```php
   global $wpdb;
   $tables = $wpdb->get_results("SHOW TABLES LIKE 'wp_wg_%'");
   echo '<pre>';
   print_r($tables);
   echo '</pre>';
   ```
   - Save as "Check Intelligence Tables"
   - Run snippet
   - Je moet 3 tabellen zien:
     - `wp_wg_customer_intelligence`
     - `wp_wg_bundle_offers`
     - `wp_wg_behavioral_events`

## Stap 3: Test de API Endpoints

### Test 1: Basis Connectivity
Open browser en ga naar:
```
https://wasgeurtje.nl/wp-json/wg/v1/intelligence/profile?customer_email=test@test.com
```

Je moet een response krijgen (ook al bestaat de customer niet):
```json
{
  "success": false,
  "message": "Profile not found",
  "suggest_action": "recalculate"
}
```

✅ Als je dit ziet, werkt de API!

### Test 2: Track Session voor Test User

**Via Browser Console:**
Open https://wasgeurtje.nl en open Developer Tools (F12), ga naar Console tab:

```javascript
fetch('https://wasgeurtje.nl/wp-json/wg/v1/intelligence/track-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customer_email: 'jackwullems18@gmail.com'
  })
})
.then(r => r.json())
.then(console.log);
```

**Via cURL (Terminal/CMD):**
```bash
curl -X POST https://wasgeurtje.nl/wp-json/wg/v1/intelligence/track-session \
  -H "Content-Type: application/json" \
  -d "{\"customer_email\":\"jackwullems18@gmail.com\"}"
```

Expected output:
```json
{
  "success": true,
  "profile_id": 1,
  "message": "Session tracked successfully"
}
```

### Test 3: Recalculate Profile (Analyze Orders)

```javascript
fetch('https://wasgeurtje.nl/wp-json/wg/v1/intelligence/recalculate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customer_email: 'jackwullems18@gmail.com'
  })
})
.then(r => r.json())
.then(data => {
  console.log('Profile:', data);
  console.log('Favorites:', data.data?.favorite_products);
  console.log('Peak Spending:', data.data?.peak_spending);
});
```

Dit analyseert alle bestellingen van de customer en berekent:
- Favoriete producten
- Peak spending quantity
- Purchase cycle
- Next prime window

### Test 4: Get Profile

```javascript
fetch('https://wasgeurtje.nl/wp-json/wg/v1/intelligence/profile?customer_email=jackwullems18@gmail.com')
  .then(r => r.json())
  .then(console.log);
```

### Test 5: Generate Bundle Offer

```javascript
fetch('https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle?customer_email=jackwullems18@gmail.com')
  .then(r => r.json())
  .then(data => {
    console.log('Bundle offer:', data);
    if (data.success) {
      console.log('Products:', data.bundle);
      console.log('Price:', data.pricing);
      console.log('Message:', data.message);
    }
  });
```

## Stap 4: Verify Database

### Via Code Snippets:

**Check Customer Intelligence:**
```php
global $wpdb;
$profile = $wpdb->get_row("
  SELECT * FROM wp_wg_customer_intelligence 
  WHERE customer_email = 'jackwullems18@gmail.com'
", ARRAY_A);

echo '<h3>Customer Profile:</h3>';
echo '<pre>';
print_r($profile);
echo '</pre>';

if ($profile['favorite_products']) {
  echo '<h3>Favorite Products:</h3>';
  $favorites = json_decode($profile['favorite_products'], true);
  echo '<pre>';
  print_r($favorites);
  echo '</pre>';
}
```

**Check Bundle Offers:**
```php
global $wpdb;
$offers = $wpdb->get_results("
  SELECT * FROM wp_wg_bundle_offers 
  WHERE customer_email = 'jackwullems18@gmail.com'
  ORDER BY offered_at DESC
", ARRAY_A);

echo '<h3>Bundle Offers:</h3>';
foreach ($offers as $offer) {
  echo '<hr>';
  echo '<strong>Offer ID:</strong> ' . $offer['id'] . '<br>';
  echo '<strong>Status:</strong> ' . $offer['status'] . '<br>';
  echo '<strong>Total Quantity:</strong> ' . $offer['total_quantity'] . '<br>';
  echo '<strong>Final Price:</strong> €' . $offer['final_price'] . '<br>';
  echo '<strong>Discount:</strong> €' . $offer['discount_amount'] . '<br>';
  echo '<strong>Offered at:</strong> ' . $offer['offered_at'] . '<br>';
  
  echo '<strong>Products:</strong><br>';
  $products = json_decode($offer['bundle_products'], true);
  echo '<pre>';
  print_r($products);
  echo '</pre>';
}
```

**Check Behavioral Events:**
```php
global $wpdb;
$events = $wpdb->get_results("
  SELECT * FROM wp_wg_behavioral_events 
  ORDER BY timestamp DESC 
  LIMIT 20
", ARRAY_A);

echo '<h3>Recent Events:</h3>';
echo '<table border=1 cellpadding=5>';
echo '<tr><th>Time</th><th>Type</th><th>Email</th><th>IP Hash</th></tr>';
foreach ($events as $event) {
  echo '<tr>';
  echo '<td>' . $event['timestamp'] . '</td>';
  echo '<td>' . $event['event_type'] . '</td>';
  echo '<td>' . ($event['customer_email'] ?: 'anonymous') . '</td>';
  echo '<td>' . substr($event['ip_hash'], 0, 16) . '...</td>';
  echo '</tr>';
}
echo '</table>';
```

## ✅ Success Criteria

Na installatie en testen moet je kunnen zien:

1. **In `wp_wg_customer_intelligence` table:**
   - IP hash (64 character SHA-256)
   - Geo country + city
   - Favorite products (JSON array)
   - Peak spending quantity + amount
   - Purchase cycle days
   - Next prime window dates
   - Profile score

2. **In `wp_wg_bundle_offers` table:**
   - Bundle products (JSON with product_id, name, quantity)
   - Total quantity (peak + 1)
   - Base price, discount, final price
   - Bonus loyalty points
   - Status: pending
   - Expires_at (7 days from now)

3. **In `wp_wg_behavioral_events` table:**
   - Session_start event
   - IP hash
   - Timestamp

## 🔧 Troubleshooting

### Plugin niet zichtbaar na upload
- Check file permissions (755 for folders, 644 for files)
- Check of `customer-intelligence-api.php` bestaat in de root van de plugin folder

### Tabellen niet aangemaakt
- Deactiveer en heractiveer de plugin
- Check WordPress debug log: `wp-content/debug.log`
- Run handmatig via Code Snippets:
  ```php
  wg_intelligence_activate();
  ```

### API endpoints geven 404
- Ga naar Settings → Permalinks
- Klik "Save Changes" (flush rewrite rules)
- Test opnieuw

### "No orders found for customer"
- Check of de customer wel bestellingen heeft in WooCommerce
- Check of bestellingen status = "completed"
- Check customer email spelling

### Bundle generation fails
- Customer moet minimaal 2 completed orders hebben
- Customer moet in "prime window" zitten
- Peak spending moet minimaal 4 items zijn

## 📞 Support

Als er problemen zijn, check:
1. WordPress debug log
2. Browser console voor API errors
3. Database direct via phpMyAdmin

