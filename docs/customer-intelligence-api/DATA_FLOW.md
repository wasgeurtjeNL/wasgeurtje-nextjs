# Customer Intelligence System - Data Flows

**Versie:** 1.0  
**Laatst bijgewerkt:** 30 oktober 2024

---

## 📋 Inhoudsopgave

1. [Complete End-to-End Flow](#complete-end-to-end-flow)
2. [Customer Recognition Flow](#customer-recognition-flow)
3. [Bundle Generation Flow](#bundle-generation-flow)
4. [Profile Recalculation Flow](#profile-recalculation-flow)
5. [Bundle Status Update Flow](#bundle-status-update-flow)
6. [Data Synchronization Flow](#data-synchronization-flow)

---

## Complete End-to-End Flow

### Scenario: Returning Customer bezoekt Homepage

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. BROWSER - First Visit (New Customer)                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ User bezoekt wasgeurtje.nl voor eerste keer                                 │
│                                                                               │
│ Browser:                                                                      │
│   ├─> fingerprint.ts: generateFingerprint()                                 │
│   │    ├─> Collect 40+ device characteristics                               │
│   │    ├─> SHA-256 hash → "990eb8b7fb69..."                                 │
│   │    └─> localStorage.setItem('wg_device_fp', fingerprint)                │
│   │                                                                           │
│   └─> GlobalBundleOfferManager mounts                                        │
│        ├─> Wait 2 seconds (page load)                                        │
│        ├─> GET fingerprint from localStorage                                 │
│        └─> POST /api/intelligence/track-customer                             │
│             Body: { fingerprint: "990eb8b7..." }                             │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ 2. NEXT.JS API - Recognition Attempt                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ API Route: /api/intelligence/track-customer                                  │
│                                                                               │
│ STEP 1: Get IP & Hash                                                        │
│   ├─> Extract IP from request.headers                                        │
│   │    (X-Forwarded-For, X-Real-IP, etc.)                                   │
│   ├─> Hash IP: SHA-256 + salt → "a3f5d2..."                                 │
│   └─> ip_hash = "a3f5d2..."                                                  │
│                                                                               │
│ STEP 2: Try Device Recognition (Supabase)                                    │
│   Query: SELECT * FROM device_tracking                                       │
│          WHERE browser_fingerprint = "990eb8b7..."                           │
│             OR ip_hash = "a3f5d2..."                                         │
│          ORDER BY last_seen DESC LIMIT 1;                                    │
│                                                                               │
│   Result: No match (first visit)                                             │
│                                                                               │
│ STEP 3: No Recognition                                                       │
│   Response: {                                                                 │
│     success: true,                                                            │
│     tracked: null,                                                            │
│     profile: null                                                             │
│   }                                                                           │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ 3. BROWSER - No Bundle (Anonymous)                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ GlobalBundleOfferManager:                                                    │
│   console.log('[Bundle] IP/Fingerprint not recognized')                     │
│   → No popup shown                                                            │
│                                                                               │
│ User browses site → Navigates to checkout → Enters email                    │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ 4. CHECKOUT - Email Entered                                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ User types: jackwullems18@gmail.com                                          │
│                                                                               │
│ Checkout Component:                                                           │
│   └─> trackCheckoutEmail("jackwullems18@gmail.com")                         │
│        └─> POST /api/intelligence/track-customer                             │
│             Body: {                                                           │
│               email: "jackwullems18@gmail.com",                              │
│               event_type: "checkout_email_entered",                          │
│               fingerprint: "990eb8b7..."                                     │
│             }                                                                 │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ 5. NEXT.JS API - Email Tracking                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ API Route: /api/intelligence/track-customer                                  │
│                                                                               │
│ STEP 1: Hash IP                                                              │
│   ip_hash = "a3f5d2..."                                                       │
│                                                                               │
│ STEP 2: Device Recognition (still no match)                                  │
│                                                                               │
│ STEP 3: Device Tracking (UPSERT)                                             │
│   INSERT INTO device_tracking:                                               │
│     customer_email = "jackwullems18@gmail.com"                               │
│     ip_hash = "a3f5d2..."                                                     │
│     browser_fingerprint = "990eb8b7..."                                      │
│     first_seen = NOW()                                                        │
│     last_seen = NOW()                                                         │
│     visit_count = 1                                                           │
│                                                                               │
│ STEP 4: Get/Sync Customer Profile                                            │
│   Query Supabase:                                                             │
│     SELECT * FROM customer_intelligence                                       │
│     WHERE customer_email = "jackwullems18@gmail.com"                         │
│                                                                               │
│   If not found OR outdated:                                                   │
│     ├─> GET https://wasgeurtje.nl/wp-json/wg/v1/intelligence/profile         │
│     │    ?customer_email=jackwullems18@gmail.com                             │
│     │                                                                          │
│     └─> WordPress Returns:                                                    │
│          {                                                                     │
│            customer_email: "jackwullems18@gmail.com",                        │
│            favorite_products: [...],                                          │
│            peak_spending_quantity: 3,                                         │
│            total_orders: 42,                                                  │
│            days_since_last_order: 30,                                         │
│            purchase_cycle_days: 10,                                           │
│            ...                                                                 │
│          }                                                                     │
│     │                                                                          │
│     └─> Upsert to Supabase customer_intelligence                             │
│                                                                               │
│ STEP 5: Log Event                                                            │
│   INSERT INTO behavioral_events:                                             │
│     event_type = "checkout_email_entered"                                    │
│     customer_email = "jackwullems18@gmail.com"                               │
│     fingerprint = "990eb8b7..."                                              │
│     ip_hash = "a3f5d2..."                                                     │
│                                                                               │
│ Response: {                                                                   │
│   success: true,                                                              │
│   tracked: { customer_email: "jackwullems18@gmail.com", ... },              │
│   profile: { ...customer_intelligence_data }                                 │
│ }                                                                             │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ 6. BROWSER - Checkout Continues                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ User completes order...                                                       │
│                                                                               │
│ Order placed via WooCommerce                                                  │
│   Order ID: 12345                                                             │
│   Email: jackwullems18@gmail.com                                             │
│   Items: 3x Full Moon                                                         │
│   Total: €44.85                                                               │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ 7. WORDPRESS - Order Completed Hook                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ Hook: woocommerce_order_status_completed (or processing)                     │
│                                                                               │
│ Function: wg_auto_recalculate_profile_on_order($order_id)                   │
│   ├─> Get order data from WooCommerce                                        │
│   ├─> Extract customer email                                                 │
│   └─> WG_Purchase_Analyzer::recalculate_profile($email)                     │
│        │                                                                      │
│        ├─> Get all completed orders (wc_get_orders)                         │
│        ├─> Analyze last 3 orders                                             │
│        ├─> Calculate favorite products (frequency + recency)                │
│        ├─> Find peak spending (highest quantity)                            │
│        ├─> Calculate purchase cycle (avg days between orders)               │
│        ├─> Predict next prime window (80-120% of cycle)                     │
│        ├─> Calculate profile score (RFM: 0-100)                             │
│        │                                                                      │
│        ├─> UPDATE wp_wg_customer_intelligence SET ...                       │
│        │                                                                      │
│        └─> WG_Supabase_Sync::sync_profile($email, $profile)                │
│             └─> POST Supabase /rest/v1/customer_intelligence                │
│                  (Prefer: resolution=merge-duplicates → UPSERT)              │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ 8. SUPABASE - Profile Updated                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ Tables Updated:                                                               │
│                                                                               │
│ 1. device_tracking:                                                           │
│    ├─> customer_email: "jackwullems18@gmail.com"                            │
│    ├─> browser_fingerprint: "990eb8b7..."                                   │
│    ├─> ip_hash: "a3f5d2..."                                                  │
│    └─> visit_count: 1                                                        │
│                                                                               │
│ 2. customer_intelligence:                                                     │
│    ├─> customer_email: "jackwullems18@gmail.com"                            │
│    ├─> favorite_products: [{"product_id": 44, "name": "Full Moon", ...}]   │
│    ├─> peak_spending_quantity: 3                                             │
│    ├─> total_orders: 43 (updated!)                                           │
│    ├─> last_order_date: "2024-10-01"                                        │
│    ├─> days_since_last_order: 0                                              │
│    ├─> next_prime_window_start: "2024-10-07" (cycle × 0.8)                 │
│    └─> next_prime_window_end: "2024-10-11" (cycle × 1.2)                   │
│                                                                               │
│ 3. behavioral_events:                                                         │
│    └─> event_type: "checkout_email_entered"                                 │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                          [30 DAYS LATER...]
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ 9. BROWSER - Return Visit (Recognized!)                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ User bezoekt wasgeurtje.nl opnieuw (same device)                            │
│                                                                               │
│ Browser:                                                                      │
│   ├─> fingerprint uit localStorage: "990eb8b7..."                           │
│   └─> GlobalBundleOfferManager mounts                                        │
│        └─> POST /api/intelligence/track-customer                             │
│             Body: { fingerprint: "990eb8b7..." }                             │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ 10. NEXT.JS API - Customer RECOGNIZED!                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ API Route: /api/intelligence/track-customer                                  │
│                                                                               │
│ STEP 1: Hash IP (might be different network)                                 │
│   ip_hash = "b8e7c4..." (different from home)                               │
│                                                                               │
│ STEP 2: Device Recognition (MATCH!)                                          │
│   Query: SELECT * FROM device_tracking                                       │
│          WHERE browser_fingerprint = "990eb8b7..."                           │
│             OR ip_hash = "b8e7c4..."                                         │
│          ORDER BY last_seen DESC LIMIT 1;                                    │
│                                                                               │
│   Result: MATCH! (fingerprint matched)                                       │
│     customer_email: "jackwullems18@gmail.com"                                │
│     customer_id: null                                                         │
│     last_seen: "2024-10-01"                                                  │
│                                                                               │
│ STEP 3: Update Device Tracking                                               │
│   UPDATE device_tracking SET                                                 │
│     last_seen = NOW(),                                                        │
│     visit_count = visit_count + 1,                                            │
│     ip_hash = "b8e7c4..." (updated!)                                         │
│   WHERE browser_fingerprint = "990eb8b7..."                                  │
│     AND customer_email = "jackwullems18@gmail.com";                         │
│                                                                               │
│ STEP 4: Get Profile                                                          │
│   SELECT * FROM customer_intelligence                                         │
│   WHERE customer_email = "jackwullems18@gmail.com"                          │
│                                                                               │
│   Result:                                                                     │
│     days_since_last_order: 30                                                 │
│     favorite_products: [Full Moon, ...]                                      │
│     peak_spending_quantity: 3                                                 │
│                                                                               │
│ Response: {                                                                   │
│   success: true,                                                              │
│   tracked: {                                                                  │
│     customer_email: "jackwullems18@gmail.com",                              │
│     ip_hash: "b8e7c4...",                                                     │
│     fingerprint: "990eb8b7..."                                               │
│   },                                                                          │
│   profile: { ...customer_intelligence_data }                                 │
│ }                                                                             │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ 11. BROWSER - Customer Recognized!                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ GlobalBundleOfferManager:                                                    │
│   console.log('[Bundle] IP/Fingerprint recognized! Customer: jackwullems18@') │
│                                                                               │
│   ├─> GET /api/intelligence/bundle?customer_email=jackwullems18@gmail.com   │
│   │                                                                           │
│   └─> Wait for response...                                                   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ 12. NEXT.JS API - Bundle Check                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ API Route: GET /api/intelligence/bundle                                      │
│                                                                               │
│ STEP 1: Check Existing Bundle (Supabase)                                     │
│   Query: SELECT * FROM bundle_offers                                         │
│          WHERE customer_email = "jackwullems18@gmail.com"                   │
│            AND status = 'pending'                                             │
│            AND expires_at > NOW()                                             │
│          ORDER BY offered_at DESC LIMIT 1;                                   │
│                                                                               │
│   Result: No active bundle found                                             │
│                                                                               │
│ STEP 2: Generate Bundle (WordPress)                                          │
│   GET https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle               │
│       ?customer_email=jackwullems18@gmail.com                                │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ 13. WORDPRESS - Bundle Generation                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ REST API Endpoint: /intelligence/bundle                                      │
│                                                                               │
│ WG_Bundle_Generator::generate_bundle("jackwullems18@gmail.com")             │
│                                                                               │
│ STEP 1: Get Profile                                                          │
│   SELECT * FROM wp_wg_customer_intelligence                                  │
│   WHERE customer_email = "jackwullems18@gmail.com"                          │
│                                                                               │
│ STEP 2: Check Prime Window                                                   │
│   days_since_last_order = 30                                                 │
│   ✅ 30 >= 14 → IN PRIME WINDOW (re-engagement)                              │
│                                                                               │
│ STEP 3: Get Favorite Products                                                │
│   favorite_products = [                                                       │
│     { product_id: 44, name: "Full Moon", score: 15, ... }                   │
│   ]                                                                           │
│   ✅ Has valid products (not 1893 or 334999)                                 │
│                                                                               │
│ STEP 4: Calculate Target Quantity                                            │
│   peak_spending_quantity = 3                                                 │
│   target_quantity = peak + 1 = 4                                             │
│   ✅ 4 >= 4 (minimum for bundle)                                             │
│                                                                               │
│ STEP 5: Create Bundle Composition                                            │
│   Top 2 favorites: Full Moon                                                 │
│   Split: 4x Full Moon (only 1 favorite available)                           │
│                                                                               │
│ STEP 6: Calculate Pricing                                                    │
│   base_price = 4 × €14.95 = €59.80                                          │
│   discount_percentage = 10% (4 items) + 0% (profile score < 60) = 10%      │
│   discount_amount = €5.98                                                    │
│   final_price = €53.82                                                       │
│                                                                               │
│ STEP 7: Calculate Loyalty Points                                             │
│   base_points = floor(€53.82) = 53                                          │
│   multiplier = 1.0 (profile score < 60)                                     │
│   bonus_points = 53                                                           │
│                                                                               │
│ STEP 8: Save Bundle Offer                                                    │
│   INSERT INTO wp_wg_bundle_offers:                                           │
│     customer_email = "jackwullems18@gmail.com"                               │
│     bundle_products = '[{"product_id":44,"quantity":4,...}]'                │
│     total_quantity = 4                                                        │
│     base_price = 59.80                                                        │
│     discount_amount = 5.98                                                    │
│     final_price = 53.82                                                       │
│     bonus_points = 53                                                         │
│     trigger_reason = "prime_window"                                          │
│     status = "pending"                                                        │
│     offered_at = NOW()                                                        │
│     expires_at = NOW() + INTERVAL 7 DAY                                      │
│                                                                               │
│   offer_id = 93 (auto-increment)                                             │
│                                                                               │
│ STEP 9: Sync to Supabase                                                     │
│   WG_Supabase_Sync::sync_bundle_offer($offer_data)                          │
│   POST https://dqddlmniyacbiviovgfw.supabase.co/rest/v1/bundle_offers       │
│                                                                               │
│ STEP 10: Get Customer Name                                                   │
│   WC_Customer → first_name: "Rezgar", last_name: "Kasim"                    │
│                                                                               │
│ Response: {                                                                   │
│   success: true,                                                              │
│   offer_id: 93,                                                               │
│   bundle: [{ product_id: 44, name: "Full Moon", quantity: 4, ... }],        │
│   pricing: { base_price: 59.80, discount_percentage: 10, ... },             │
│   bonus_points: 53,                                                           │
│   customer: { first_name: "Rezgar", last_name: "Kasim", ... }               │
│ }                                                                             │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ 14. NEXT.JS API - Bundle Response                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ API Route: GET /api/intelligence/bundle                                      │
│                                                                               │
│ STEP 3: Verify Bundle in Supabase                                            │
│   Query: SELECT * FROM bundle_offers WHERE id = 93                           │
│   ✅ Bundle synced successfully                                              │
│                                                                               │
│ STEP 4: Enrich Response                                                      │
│   Add profile data, format pricing, etc.                                     │
│                                                                               │
│ Response: {                                                                   │
│   success: true,                                                              │
│   offer_id: 93,                                                               │
│   bundle: [...],                                                              │
│   pricing: {...},                                                             │
│   bonus_points: 53,                                                           │
│   customer: { first_name: "Rezgar", ... },                                   │
│   profile: { total_orders: 43, ... }                                         │
│ }                                                                             │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ 15. BROWSER - Bundle Popup Shows!                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ GlobalBundleOfferManager:                                                    │
│   console.log('[Bundle] Offer available! Showing popup...')                 │
│   setShowOffer(true) after 5 seconds                                         │
│                                                                               │
│ BundleOfferPopup mounts:                                                     │
│   ┌────────────────────────────────────────────────────────────────┐        │
│   │ 🎉 Hé Rezgar! 👋                                               │        │
│   │                                                                 │        │
│   │ Jouw persoonlijke bundel:                                      │        │
│   │ 4x Full Moon                                                    │        │
│   │                                                                 │        │
│   │ Bespaar 10%!                                                    │        │
│   │                                                                 │        │
│   │ ~~€59.80~~ → €53.82 VIP prijs                                 │        │
│   │                                                                 │        │
│   │ 🎁 BONUS: +53 loyaliteitspunten!                              │        │
│   │                                                                 │        │
│   │ ⚡ Verloopt over 6 dagen                                       │        │
│   │                                                                 │        │
│   │ [Rezgar, claim jouw 10% korting! 🎉]                          │        │
│   │                                                                 │        │
│   │ Nee bedankt                                                     │        │
│   └────────────────────────────────────────────────────────────────┘        │
│                                                                               │
│ On mount: Log "viewed" event                                                 │
│   POST https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle-status       │
│   Body: { offer_id: 93, status: "viewed", customer_email: "jack..." }       │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ 16. USER ACTION - Accept Bundle                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ User clicks: "Rezgar, claim jouw 10% korting! 🎉"                           │
│                                                                               │
│ BundleOfferPopup.handleAccept():                                             │
│   ├─> POST /wp-json/wg/v1/intelligence/bundle-status                        │
│   │    Body: { offer_id: 93, status: "added_to_cart", customer_email }      │
│   │                                                                           │
│   ├─> Add products to cart:                                                  │
│   │    └─> addToCart(44, 4) → 4x Full Moon added                            │
│   │                                                                           │
│   └─> Close popup, redirect to cart                                          │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ 17. WORDPRESS - Status Update                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ REST API: POST /intelligence/bundle-status                                   │
│                                                                               │
│ STEP 1: Update Bundle Status                                                 │
│   UPDATE wp_wg_bundle_offers SET                                             │
│     status = "added_to_cart",                                                │
│     responded_at = NOW()                                                      │
│   WHERE id = 93;                                                              │
│                                                                               │
│ STEP 2: Log Behavioral Event                                                 │
│   INSERT INTO wp_wg_behavioral_events:                                       │
│     event_type = "bundle_accepted"                                           │
│     customer_email = "jackwullems18@gmail.com"                               │
│     event_data = '{"offer_id":93,"status":"added_to_cart"}'                │
│                                                                               │
│ Response: { success: true }                                                   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                          [Success! Bundle accepted]
```

---

## Customer Recognition Flow

### Detailed Recognition Logic

```
┌────────────────────────────────────────────────────────────────────┐
│ DEVICE RECOGNITION - Priority Order                                │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ INPUT:                                                              │
│   ├─> browser_fingerprint: "990eb8b7..."                          │
│   └─> ip_address: "192.168.1.1" → ip_hash: "a3f5d2..."            │
│                                                                     │
│ QUERY (Supabase device_tracking):                                  │
│   SELECT customer_email, customer_id, MAX(last_seen) as last_seen │
│   FROM device_tracking                                              │
│   WHERE browser_fingerprint = "990eb8b7..."                        │
│      OR ip_hash = "a3f5d2..."                                      │
│   GROUP BY customer_email                                           │
│   ORDER BY last_seen DESC                                           │
│   LIMIT 1;                                                          │
│                                                                     │
│ PRIORITY LOGIC:                                                     │
│   1. ✅ Fingerprint Match → HIGHEST PRIORITY                       │
│      (Most reliable, persists across networks)                     │
│                                                                     │
│   2. ✅ IP Hash Match → MEDIUM PRIORITY                            │
│      (Less reliable, changes with network)                         │
│                                                                     │
│   3. ✅ Most Recent Match → TIEBREAKER                             │
│      (If multiple matches, use last_seen DESC)                     │
│                                                                     │
│ OUTPUT:                                                             │
│   customer_email: "jackwullems18@gmail.com"                        │
│   customer_id: null                                                 │
│   last_seen: "2024-10-01 12:34:56"                                │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### Multi-Device Scenarios

#### Scenario A: Same Device, Different Networks
```
DAY 1: User at Home
  └─> IP: 192.168.1.1 → hash: "abc123"
      Fingerprint: "xyz789"
      ✅ Tracked as new device

DAY 2: User at Work (same laptop)
  └─> IP: 10.0.0.1 → hash: "def456" (DIFFERENT)
      Fingerprint: "xyz789" (SAME)
      ✅ RECOGNIZED via fingerprint!
      ✅ Update existing record with new IP hash
```

#### Scenario B: Different Devices, Same Network
```
DEVICE 1: Laptop at Home
  └─> IP: 192.168.1.1 → hash: "abc123"
      Fingerprint: "laptop_fp"
      ✅ Tracked as device #1

DEVICE 2: Phone at Home (same Wi-Fi)
  └─> IP: 192.168.1.1 → hash: "abc123" (SAME)
      Fingerprint: "phone_fp" (DIFFERENT)
      ✅ RECOGNIZED via IP hash!
      ✅ Create NEW device record (different fingerprint)
```

#### Scenario C: Returning After Long Time
```
FIRST VISIT (6 months ago):
  └─> Email: user@example.com
      Fingerprint: "old_fp"
      Device record created

RETURN VISIT (today):
  └─> Fingerprint: "old_fp" (SAME)
      ✅ RECOGNIZED immediately!
      ✅ Update last_seen, increment visit_count
      ✅ Check prime window (likely eligible after 6 months)
```

---

## Bundle Generation Flow

### Eligibility Decision Tree

```
┌──────────────────────────────────────────────────────────────────┐
│ BUNDLE GENERATION ELIGIBILITY CHECK                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│ INPUT: customer_email                                            │
│                                                                   │
│ STEP 1: Profile Exists?                                          │
│   Query: SELECT * FROM wp_wg_customer_intelligence              │
│          WHERE customer_email = ?                                │
│                                                                   │
│   ❌ No → Return: "Profile not found, recalculate first"        │
│   ✅ Yes → Continue                                              │
│                                                                   │
│ STEP 2: In Prime Window?                                         │
│   Logic A: days_since_last_order >= 14?                         │
│     ✅ Yes → IN PRIME (re-engagement opportunity)               │
│     ❌ No → Check Logic B                                        │
│                                                                   │
│   Logic B: Within calculated window?                             │
│     window_start = last_order_date + (cycle × 0.8)              │
│     window_end = last_order_date + (cycle × 1.2)                │
│     NOW() >= window_start AND NOW() <= window_end?              │
│       ✅ Yes → IN PRIME                                          │
│       ❌ No → Return: "Not in prime window yet"                 │
│                                                                   │
│ STEP 3: Has Favorite Products?                                   │
│   favorite_products.length > 0?                                  │
│     ❌ No → Return: "No favorites identified"                   │
│     ✅ Yes → Continue                                            │
│                                                                   │
│ STEP 4: Has Valid (Non-Excluded) Products?                      │
│   Filter favorites: Remove product IDs 1893, 334999             │
│   valid_favorites.length > 0?                                    │
│     ❌ No → Return: "Only excluded products"                    │
│     ✅ Yes → Continue                                            │
│                                                                   │
│ STEP 5: Peak Spending Sufficient?                               │
│   peak_spending_quantity >= 3?                                   │
│   (target = peak + 1, minimum target = 4)                       │
│     ❌ No → Return: "Peak spending too low"                     │
│     ✅ Yes → ELIGIBLE! Generate bundle                          │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Bundle Composition Algorithm

```
┌────────────────────────────────────────────────────────────────┐
│ BUNDLE COMPOSITION CREATION                                     │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ INPUT:                                                          │
│   favorites = [                                                 │
│     { product_id: 44, name: "Full Moon", score: 15 },         │
│     { product_id: 38, name: "Blossom Drip", score: 9 },       │
│     { product_id: 55, name: "Sunrise", score: 6 }             │
│   ]                                                             │
│   target_quantity = 5 (peak + 1)                               │
│                                                                 │
│ ALGORITHM:                                                      │
│                                                                 │
│ CASE A: 2+ favorites available                                 │
│   ├─> Take top 2 favorites                                     │
│   ├─> Split quantity 60/40                                     │
│   │    primary_qty = ceil(5 × 0.6) = 3                        │
│   │    secondary_qty = 5 - 3 = 2                              │
│   └─> Bundle:                                                   │
│        [                                                         │
│          { product_id: 44, name: "Full Moon", quantity: 3 },   │
│          { product_id: 38, name: "Blossom Drip", quantity: 2 } │
│        ]                                                         │
│                                                                 │
│ CASE B: Only 1 favorite available                              │
│   └─> Use entire quantity for that product                     │
│        Bundle: [{ product_id: 44, quantity: 5 }]               │
│                                                                 │
│ OUTPUT:                                                         │
│   bundle_products = [                                           │
│     {                                                            │
│       product_id: 44,                                           │
│       name: "Full Moon",                                        │
│       slug: "full-moon",                                        │
│       quantity: 3,                                              │
│       unit_price: 14.95,                                        │
│       subtotal: 44.85                                           │
│     },                                                           │
│     {                                                            │
│       product_id: 38,                                           │
│       name: "Blossom Drip",                                     │
│       slug: "blossom-drip",                                     │
│       quantity: 2,                                              │
│       unit_price: 14.95,                                        │
│       subtotal: 29.90                                           │
│     }                                                            │
│   ]                                                              │
│   total_quantity: 5                                             │
│   base_price: 74.75                                             │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Pricing Calculation

```
┌────────────────────────────────────────────────────────────────┐
│ DYNAMIC DISCOUNT CALCULATION                                    │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ INPUT:                                                          │
│   total_quantity = 5                                            │
│   profile_score = 72                                            │
│   base_price = 74.75                                            │
│                                                                 │
│ STEP 1: Quantity-Based Discount                                │
│   if (quantity >= 7) → 15%                                     │
│   else if (quantity >= 5) → 12%    ← MATCH                    │
│   else if (quantity >= 4) → 10%                                │
│   else → 0%                                                     │
│                                                                 │
│   base_discount = 12%                                           │
│                                                                 │
│ STEP 2: Profile Score Bonus                                    │
│   if (score >= 80) → +3%                                       │
│   else if (score >= 60) → +2%     ← MATCH (score = 72)        │
│   else → +0%                                                    │
│                                                                 │
│   profile_bonus = 2%                                            │
│                                                                 │
│ STEP 3: Total Discount                                         │
│   total_discount = min(20%, base_discount + profile_bonus)     │
│   total_discount = min(20%, 12% + 2%)                          │
│   total_discount = 14%                                          │
│                                                                 │
│ STEP 4: Final Pricing                                          │
│   discount_amount = 74.75 × 0.14 = 10.47                       │
│   final_price = 74.75 - 10.47 = 64.28                          │
│                                                                 │
│ OUTPUT:                                                         │
│   pricing = {                                                    │
│     base_price: 74.75,                                          │
│     discount_percentage: 14,                                    │
│     discount_amount: 10.47,                                     │
│     final_price: 64.28                                          │
│   }                                                              │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Profile Recalculation Flow

### Automatic Recalculation (WordPress)

```
┌────────────────────────────────────────────────────────────────────┐
│ WOOCOMMERCE ORDER COMPLETED → PROFILE RECALCULATION                │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ TRIGGER:                                                            │
│   Hook: woocommerce_order_status_completed                         │
│   Hook: woocommerce_order_status_processing                        │
│                                                                     │
│ FUNCTION: wg_auto_recalculate_profile_on_order($order_id)         │
│                                                                     │
│ STEP 1: Get Order Data                                             │
│   $order = wc_get_order($order_id);                                │
│   $customer_email = $order->get_billing_email();                   │
│   $customer_id = $order->get_customer_id();                        │
│                                                                     │
│ STEP 2: Get All Orders                                             │
│   $orders = wc_get_orders([                                        │
│     'customer' => $customer_email,                                  │
│     'status' => 'completed',                                        │
│     'limit' => -1                                                   │
│   ]);                                                               │
│                                                                     │
│ STEP 3: Extract Products (Last 3 Orders)                           │
│   recent_orders = array_slice($orders, 0, 3);                     │
│                                                                     │
│   For each order:                                                   │
│     For each item:                                                  │
│       ├─> Get product ID, name, quantity                           │
│       ├─> Skip if excluded (1893, 334999)                          │
│       └─> Aggregate:                                                │
│            products[id].total_quantity += quantity                  │
│            products[id].appearances++                               │
│            products[id].order_numbers[] = order_number              │
│                                                                     │
│ STEP 4: Calculate Product Scores                                   │
│   For each product:                                                 │
│     score = (total_quantity × 2) + (appearances × 3)              │
│                                                                     │
│   Sort by score DESC                                                │
│   favorite_products = top 5 products                                │
│                                                                     │
│ STEP 5: Find Peak Spending                                         │
│   For each order:                                                   │
│     total_qty = sum(non-excluded items quantity)                   │
│     if (total_qty > peak_quantity):                                │
│       peak_quantity = total_qty                                     │
│       peak_amount = order.total                                     │
│       peak_order_id = order.id                                      │
│                                                                     │
│ STEP 6: Calculate Purchase Cycle                                   │
│   intervals = []                                                    │
│   For i in range(0, orders.length - 1):                           │
│     interval = orders[i].date - orders[i+1].date (in days)        │
│     intervals.push(interval)                                        │
│                                                                     │
│   purchase_cycle = AVG(intervals)                                   │
│   purchase_cycle = max(7, round(purchase_cycle))  // Min 7 days   │
│                                                                     │
│ STEP 7: Calculate Prime Window                                     │
│   last_order_date = orders[0].date                                 │
│   window_start = last_order_date + (cycle × 0.8) days             │
│   window_end = last_order_date + (cycle × 1.2) days               │
│                                                                     │
│ STEP 8: Calculate Profile Score (RFM)                              │
│   score = 0                                                         │
│                                                                     │
│   // Frequency (Orders): 0-30 points                               │
│   score += min(30, total_orders × 5)                              │
│                                                                     │
│   // Monetary (AOV): 0-30 points                                   │
│   score += min(30, (avg_order_value / 10) × 3)                    │
│                                                                     │
│   // Recency: 0-40 points                                          │
│   if (days_since_last <= 14) → +40                                │
│   else if (days_since_last <= 30) → +30                           │
│   else if (days_since_last <= 60) → +20                           │
│   else if (days_since_last <= 90) → +10                           │
│   else → +0                                                         │
│                                                                     │
│   profile_score = min(100, score)                                   │
│                                                                     │
│ STEP 9: Update MySQL                                               │
│   UPDATE wp_wg_customer_intelligence SET                           │
│     favorite_products = JSON,                                       │
│     peak_spending_quantity = X,                                     │
│     peak_spending_amount = X,                                       │
│     avg_order_value = X,                                            │
│     total_orders = X,                                               │
│     last_order_date = DATE,                                         │
│     days_since_last_order = X,                                      │
│     purchase_cycle_days = X,                                        │
│     next_prime_window_start = DATE,                                │
│     next_prime_window_end = DATE,                                   │
│     profile_score = X,                                              │
│     last_recalculated = NOW()                                       │
│   WHERE customer_email = ?                                          │
│                                                                     │
│ STEP 10: Sync to Supabase                                          │
│   WG_Supabase_Sync::sync_profile($email, $profile_data)           │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## Bundle Status Update Flow

### Status Lifecycle

```
┌────────────────────────────────────────────────────────────────┐
│ BUNDLE OFFER STATUS LIFECYCLE                                   │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ [pending]                                                       │
│    │                                                            │
│    ├─> User sees popup                                         │
│    │                                                            │
│    ↓                                                            │
│ [viewed]                                                        │
│    │                                                            │
│    ├─> User clicks "Accept"  ──→ [added_to_cart]              │
│    │                               │                            │
│    │                               ├─> User completes checkout │
│    │                               │                            │
│    │                               ↓                            │
│    │                            [purchased] ✅ CONVERSION!      │
│    │                                                            │
│    ├─> User clicks "Reject"  ──→ [rejected] ❌                │
│    │                                                            │
│    ├─> Expires (7 days)      ──→ [expired] ⏰                 │
│    │                                                            │
│    └─> User closes popup     ──→ [viewed] (no status change)  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Status Update Flow

```
┌────────────────────────────────────────────────────────────────────┐
│ FRONTEND → WORDPRESS → DATABASE                                     │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ STEP 1: User Action (Frontend)                                     │
│   User clicks "Accept" or "Reject" button                          │
│                                                                     │
│   BundleOfferPopup.handleAccept() OR handleReject():              │
│     POST https://wasgeurtje.nl/wp-json/wg/v1/intelligence/         │
│          bundle-status                                              │
│     Body: {                                                         │
│       offer_id: 93,                                                │
│       status: "added_to_cart" | "rejected",                        │
│       customer_email: "jackwullems18@gmail.com"                    │
│     }                                                               │
│                                                                     │
│ STEP 2: WordPress REST API                                         │
│   Endpoint: POST /intelligence/bundle-status                       │
│   Handler: WG_Customer_Intelligence_REST_API::                     │
│            update_bundle_status_endpoint()                          │
│                                                                     │
│   Validation:                                                       │
│     ├─> offer_id required?                                         │
│     ├─> status required?                                           │
│     └─> status valid? (pending, viewed, added_to_cart,            │
│         purchased, expired, rejected)                               │
│                                                                     │
│ STEP 3: Update MySQL                                               │
│   WG_Bundle_Generator::update_offer_status($offer_id, $status)    │
│                                                                     │
│   UPDATE wp_wg_bundle_offers SET                                   │
│     status = ?,                                                     │
│     responded_at = NOW(),                                           │
│     viewed_at = NOW() (if status = 'viewed' AND not set yet)      │
│   WHERE id = ?                                                      │
│                                                                     │
│ STEP 4: Log Behavioral Event                                       │
│   event_type = 'bundle_accepted' OR 'bundle_rejected'             │
│                                                                     │
│   INSERT INTO wp_wg_behavioral_events:                             │
│     event_type = ?,                                                │
│     customer_email = ?,                                            │
│     event_data = JSON({ offer_id, status }),                       │
│     timestamp = NOW()                                               │
│                                                                     │
│ STEP 5: Response                                                    │
│   Return: {                                                         │
│     success: true,                                                  │
│     message: "Status updated successfully",                        │
│     offer_id: 93,                                                   │
│     status: "added_to_cart"                                        │
│   }                                                                 │
│                                                                     │
│ NOTE: Supabase sync OPTIONAL (WordPress is source of truth)       │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## Data Synchronization Flow

### WordPress → Supabase Sync

```
┌────────────────────────────────────────────────────────────────────┐
│ BIDIRECTIONAL SYNC (WordPress = Source of Truth)                   │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ PROFILE SYNC:                                                       │
│   TRIGGER: Profile recalculation completed                         │
│   SOURCE: MySQL wp_wg_customer_intelligence                        │
│   TARGET: Supabase customer_intelligence                           │
│   METHOD: Upsert (Prefer: resolution=merge-duplicates)            │
│                                                                     │
│   Flow:                                                             │
│     1. Profile updated in MySQL                                    │
│     2. WG_Supabase_Sync::sync_profile($email, $data)              │
│     3. Transform data format (MySQL → Supabase schema)            │
│     4. POST /rest/v1/customer_intelligence                         │
│     5. Supabase upserts based on customer_email                    │
│                                                                     │
│ BUNDLE SYNC:                                                        │
│   TRIGGER: Bundle offer generated                                  │
│   SOURCE: MySQL wp_wg_bundle_offers                                │
│   TARGET: Supabase bundle_offers                                   │
│   METHOD: Insert (no upsert, always new offer)                     │
│                                                                     │
│   Flow:                                                             │
│     1. Bundle created in MySQL                                     │
│     2. WG_Supabase_Sync::sync_bundle_offer($offer_data)           │
│     3. Transform data format                                        │
│     4. POST /rest/v1/bundle_offers                                 │
│     5. Supabase inserts new record                                 │
│                                                                     │
│ DEVICE TRACKING SYNC:                                              │
│   TRIGGER: Session tracked via Next.js API                        │
│   SOURCE: Next.js API route                                        │
│   TARGET: Supabase device_tracking                                 │
│   METHOD: Upsert (onConflict: browser_fingerprint + customer_email)│
│                                                                     │
│   Flow:                                                             │
│     1. POST /api/intelligence/track-customer                       │
│     2. Device recognized → upsert device_tracking                  │
│     3. Supabase updates visit_count, last_seen                     │
│                                                                     │
│ BEHAVIORAL EVENTS SYNC:                                            │
│   TRIGGER: Important event logged                                  │
│   SOURCE: Next.js API route                                        │
│   TARGET: Supabase behavioral_events                               │
│   METHOD: Insert (always new event)                                │
│                                                                     │
│   Flow:                                                             │
│     1. Event logged via API                                        │
│     2. INSERT INTO behavioral_events                               │
│     3. No sync needed (direct write to Supabase)                   │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

**Einde Data Flow Documentatie**

