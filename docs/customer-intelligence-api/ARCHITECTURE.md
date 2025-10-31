# Customer Intelligence & Bundle Offer System - Architectuur

**Versie:** 1.0  
**Laatst bijgewerkt:** 30 oktober 2024  
**Status:** Productie  

---

## 📋 Inhoudsopgave

1. [Systeem Overzicht](#systeem-overzicht)
2. [Technologie Stack](#technologie-stack)
3. [Architectuur Componenten](#architectuur-componenten)
4. [Data Flow](#data-flow)
5. [Primaire Functionaliteiten](#primaire-functionaliteiten)
6. [Security & Privacy](#security--privacy)

---

## Systeem Overzicht

Het Customer Intelligence & Bundle Offer System is een volledig geautomatiseerd systeem dat:

1. **Klanten herkent** via IP-hashing en browser fingerprinting (GDPR-compliant)
2. **Aankooppatronen analyseert** op basis van WooCommerce ordergeschiedenis
3. **Gepersonaliseerde bundelaanbiedingen genereert** op basis van favoriete producten en prime buying windows
4. **Automatisch synchroniseert** tussen WordPress (source of truth) en Supabase (real-time database)
5. **Bundle popups toont** aan returning customers op het juiste moment

### Kernprincipes

- ✅ **WordPress als Source of Truth**: Alle customer data komt uit WooCommerce
- ✅ **Supabase voor Real-Time**: Snelle data-access voor frontend
- ✅ **Privacy-First**: GDPR-compliant IP hashing en fingerprinting zonder PII
- ✅ **Automatische Synchronisatie**: WordPress → Supabase sync bij elke wijziging
- ✅ **On-Demand Generation**: Bundle offers worden gegenereerd wanneer klant de site bezoekt

---

## Technologie Stack

### Backend (WordPress)
- **Platform**: WordPress 6.x + WooCommerce 8.x
- **Plugin**: `customer-intelligence-api`
- **Database**: MySQL (WordPress standard)
- **REST API**: WordPress REST API v2
- **PHP Version**: 7.4+

### Frontend (Next.js)
- **Framework**: Next.js 15.5.2 (App Router)
- **React**: 18.x
- **TypeScript**: 5.x
- **Styling**: Tailwind CSS
- **State Management**: React Context + Hooks

### Database (Supabase)
- **Platform**: Supabase (PostgreSQL)
- **Real-time**: Supabase Realtime (niet actief gebruikt, maar beschikbaar)
- **API**: REST API + TypeScript Client
- **URL**: `https://dqddlmniyacbiviovgfw.supabase.co`

### Tracking & Analytics
- **Browser Fingerprinting**: Custom SHA-256 implementation
- **IP Tracking**: SHA-256 hashing met AUTH_KEY salt
- **Geo-location**: ip-api.com (free tier)
- **Session Tracking**: Custom session ID generation

---

## Architectuur Componenten

### 1. WordPress Backend Layer

#### **Plugin: `customer-intelligence-api`**
Locatie: `wordpress_plugin/customer-intelligence-api/`

**Kern Classes:**

1. **`WG_IP_Tracker`** (`class-ip-tracker.php`)
   - IP hashing (SHA-256 + AUTH_KEY salt)
   - Client IP detection (proxy-aware)
   - Geo-location lookup (ip-api.com)
   - Customer recognition via IP/fingerprint
   - Multi-device tracking via `WG_Device_Tracker`

2. **`WG_Device_Tracker`** (`class-device-tracker.php`)
   - Multi-device/network history tracking
   - Upsert logic: update visit count ipv nieuwe records
   - Customer recognition across devices
   - GDPR cleanup (365 dagen retention)

3. **`WG_Purchase_Analyzer`** (`class-purchase-analyzer.php`)
   - WooCommerce order analysis
   - Favorite products calculation (frequency + recency scoring)
   - Peak spending detection
   - Purchase cycle berekening (average days between orders)
   - Prime window calculation (80%-120% van purchase cycle)
   - Profile score (0-100 based on RFM model)
   - Product exclusion logic (IDs: 1893, 334999)

4. **`WG_Bundle_Generator`** (`class-bundle-generator.php`)
   - Personalized bundle creation
   - Prime window checking
   - Dynamic discount calculation (10-20% based on quantity + profile score)
   - Loyalty points bonus calculation
   - Bundle composition (top 2 favorites, 60/40 split)
   - Minimum eligibility: 4+ items in target bundle

5. **`WG_Supabase_Sync`** (`class-supabase-sync.php`)
   - Profile sync: WordPress → Supabase
   - Bundle offer sync: WordPress → Supabase
   - Automatic sync on profile recalculation
   - Automatic sync on bundle generation

6. **`WG_Customer_Intelligence_REST_API`** (`class-rest-api.php`)
   - REST endpoint registration
   - Request validation
   - Response formatting
   - WordPress → Supabase bridge

**WordPress Hooks:**
```php
add_action('woocommerce_order_status_completed', 'wg_auto_recalculate_profile_on_order');
add_action('woocommerce_order_status_processing', 'wg_auto_recalculate_profile_on_order');
```
→ Automatische profile recalculation na elke completed/processing order

---

### 2. Next.js Frontend Layer

#### **API Routes** (`web/src/app/api/intelligence/`)

1. **`/api/intelligence/track-customer`** (`track-customer/route.ts`)
   - **Method**: POST
   - **Purpose**: Customer session tracking + device recognition
   - **Flow**:
     1. Receive: email, customer_id, fingerprint, event_type (optional)
     2. Hash IP address
     3. Check device recognition (IP + fingerprint)
     4. Upsert device tracking record
     5. Get/sync customer profile from WordPress
     6. Log important events only (checkout_email_entered, etc.)
   - **Returns**: `{ success, tracked, profile }`

2. **`/api/intelligence/bundle`** (`bundle/route.ts`)
   - **Method**: GET
   - **Purpose**: Fetch bundle offer + auto-generate if needed
   - **Flow**:
     1. Receive: customer_email or fingerprint (query params)
     2. Find customer in Supabase
     3. Check active bundle offer in Supabase
     4. If no bundle: Call WordPress `/intelligence/bundle` (auto-generates)
     5. Fetch customer profile
     6. Return bundle + pricing + customer info
   - **Returns**: `{ success, bundle, customer, profile, offer_id }`

3. **`/api/intelligence/bundle-status-update`** (`bundle-status-update/route.ts`)
   - **Method**: POST  
   - **Purpose**: Update bundle offer status
   - **Note**: **DEPRECATED** - Nu gebruikt WordPress endpoint
   - **Reden**: WordPress is source of truth, dit was een Next.js experiment

#### **React Components** (`web/src/components/`)

1. **`GlobalBundleOfferManager.tsx`**
   - **Purpose**: Global component die bundle offers checkt
   - **Mount locatie**: Root layout (`app/layout.tsx`)
   - **Logic**:
     - Excluded pages: checkout, payment, cart
     - Check 1: Logged-in user? → Direct email ophalen
     - Check 2: Anonymous user? → IP/fingerprint recognition via `/api/intelligence/track-customer`
     - If recognized → Fetch bundle via `/api/intelligence/bundle`
     - If bundle available → Show popup after 5 seconds
   - **State**: `customerEmail`, `showOffer`, `hasChecked`

2. **`BundleOfferPopup.tsx`**
   - **Purpose**: UI component voor bundle offer display
   - **Features**:
     - Personalized greeting (first name)
     - Product list met quantities
     - Pricing: base price, discount, final price
     - Loyalty points bonus
     - Countdown timer (expires in X days)
     - Accept/Reject buttons
   - **Events**:
     - On mount: Log "viewed" event via WordPress API
     - On accept: Update status to "added_to_cart", add products to cart
     - On reject: Update status to "rejected"
   - **API Calls**: 
     - `POST https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle-status`

#### **Utilities** (`web/src/utils/` & `web/src/hooks/`)

1. **`fingerprint.ts`**
   - **Functions**:
     - `generateFingerprint()`: SHA-256 hash van device characteristics
     - `getStoredFingerprint()`: Get from localStorage or generate new
   - **Fingerprint Components** (40+ data points):
     - User agent, language, timezone
     - Screen resolution, color depth, device memory
     - Hardware concurrency, platform
     - Canvas fingerprint, WebGL fingerprint
     - Audio fingerprint, font detection
     - Touch support, plugins
   - **Storage Key**: `wg_device_fp` (localStorage)

2. **`useCustomerTracking.ts`**
   - **Hook**: `useCustomerTracking(options)`
   - **Functions**:
     - `trackCustomer(email, customerId)`: Track customer session
     - `trackCheckoutEmail(email)`: Track email entry in checkout
     - `trackUserLogin(email, customerId)`: Track login (device update only)
   - **Options**:
     - `email`, `customerId`, `eventType`, `oncePerSession`

3. **`supabase.ts`**
   - **Clients**:
     - `supabase`: Browser client
     - `supabaseServer`: Server client
   - **Database Helpers**:
     - `db.customer_intelligence.*`: Profile operations
     - `db.device_tracking.*`: Device operations
     - `db.bundle_offers.*`: Bundle operations
     - `db.behavioral_events.*`: Event logging

---

### 3. Database Layer (Supabase PostgreSQL)

#### **Tables**

1. **`customer_intelligence`**
   - **Purpose**: Customer profile met purchase patterns
   - **Primary Key**: `id` (UUID)
   - **Unique Key**: `customer_email`
   - **Key Fields**:
     - `customer_id`, `customer_email`, `first_name`, `last_name`
     - `ip_hash`, `browser_fingerprint`
     - `geo_country`, `geo_city`
     - `favorite_products` (JSONB)
     - `peak_spending_quantity`, `peak_spending_amount`
     - `avg_order_value`, `total_orders`
     - `last_order_date`, `days_since_last_order`
     - `purchase_cycle_days`
     - `next_prime_window_start`, `next_prime_window_end`
     - `profile_score` (0-100)
   - **Data Source**: WordPress (synced via `WG_Supabase_Sync`)

2. **`device_tracking`**
   - **Purpose**: Multi-device/network history voor customer recognition
   - **Primary Key**: `id` (UUID)
   - **Unique Key**: `browser_fingerprint + customer_email`
   - **Key Fields**:
     - `customer_email`, `customer_id`
     - `ip_hash`, `browser_fingerprint`
     - `first_seen`, `last_seen`, `visit_count`
     - `user_agent`, `geo_country`, `geo_city`
   - **Update Logic**: Upsert op bestaand record, increment visit_count

3. **`bundle_offers`**
   - **Purpose**: Personalized bundle aanbiedingen
   - **Primary Key**: `id` (UUID)
   - **Key Fields**:
     - `customer_email`, `customer_id`
     - `bundle_products` (JSONB array)
     - `total_quantity`, `base_price`, `discount_amount`, `final_price`
     - `bonus_points`
     - `trigger_reason` ('prime_window', 'high_value_customer')
     - `status` ('pending', 'viewed', 'added_to_cart', 'purchased', 'expired', 'rejected')
     - `offered_at`, `viewed_at`, `responded_at`, `expires_at`
     - `conversion_value`
   - **Data Source**: WordPress (synced via `WG_Supabase_Sync`)

4. **`behavioral_events`**
   - **Purpose**: Event logging voor analytics
   - **Primary Key**: `id` (UUID)
   - **Key Fields**:
     - `session_id`, `customer_email`, `customer_id`
     - `ip_hash`, `browser_fingerprint`
     - `event_type`, `event_data` (JSONB)
     - `page_url`, `created_at`
   - **Important Events**:
     - `checkout_email_entered`
     - `bundle_viewed`, `bundle_accepted`, `bundle_rejected`
     - `order_completed`

---

## Data Flow

### 1. Customer Recognition Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: Page Load                                                   │
├─────────────────────────────────────────────────────────────────────┤
│ Browser → Generate/Retrieve Fingerprint → localStorage              │
│           (getStoredFingerprint)                                     │
│                                                                       │
│ React Component → GlobalBundleOfferManager mounts                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Recognition Attempt                                         │
├─────────────────────────────────────────────────────────────────────┤
│ Frontend → POST /api/intelligence/track-customer                    │
│            Body: { fingerprint }                                     │
│                                                                       │
│ Next.js API Route:                                                  │
│   1. Get client IP from request headers                            │
│   2. Hash IP (SHA-256 + salt)                                       │
│   3. Query Supabase device_tracking:                                │
│      - Match by ip_hash OR browser_fingerprint                      │
│   4. If match found → customer_email recognized!                    │
│   5. Upsert device tracking (update visit_count)                    │
│   6. Fetch customer profile from Supabase                           │
│   7. If profile missing/outdated → Sync from WordPress              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Response                                                    │
├─────────────────────────────────────────────────────────────────────┤
│ Response: {                                                          │
│   success: true,                                                     │
│   tracked: { customer_email, ip_hash, fingerprint },               │
│   profile: { ...customer_intelligence_data }                        │
│ }                                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Bundle Generation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: Customer Recognized                                         │
├─────────────────────────────────────────────────────────────────────┤
│ Frontend → GET /api/intelligence/bundle?customer_email=xxx          │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Check Existing Bundle (Supabase)                           │
├─────────────────────────────────────────────────────────────────────┤
│ Next.js API → Query Supabase bundle_offers:                        │
│   - customer_email = xxx                                            │
│   - status = 'pending'                                              │
│   - expires_at > NOW()                                              │
│                                                                       │
│ If found → Return bundle (SKIP WordPress call)                      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓ (No bundle found)
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Generate Bundle (WordPress)                                │
├─────────────────────────────────────────────────────────────────────┤
│ Next.js API → GET https://wasgeurtje.nl/wp-json/wg/v1/             │
│                   intelligence/bundle?customer_email=xxx            │
│                                                                       │
│ WordPress REST API (class-rest-api.php):                            │
│   1. Get customer profile from MySQL                                │
│   2. WG_Bundle_Generator::generate_bundle():                        │
│      a. Check prime window eligibility                              │
│      b. Get favorite products (excluding 1893, 334999)             │
│      c. Calculate target quantity (peak + 1)                        │
│      d. Create bundle composition (top 2 favorites, 60/40)          │
│      e. Calculate pricing (10-20% discount)                         │
│      f. Calculate loyalty points bonus                              │
│      g. Save to MySQL wp_wg_bundle_offers                           │
│   3. WG_Supabase_Sync::sync_bundle_offer()                          │
│      → POST to Supabase bundle_offers table                         │
│   4. Get customer name from WC_Customer                             │
│   5. Return bundle data                                             │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: Return to Frontend                                          │
├─────────────────────────────────────────────────────────────────────┤
│ Response: {                                                          │
│   success: true,                                                     │
│   offer_id: 93,                                                      │
│   bundle: [                                                          │
│     { product_id: 44, name: "Full Moon", quantity: 3, ... }        │
│   ],                                                                 │
│   pricing: {                                                         │
│     base_price: 59.80,                                              │
│     discount_percentage: 10,                                         │
│     discount_amount: 5.98,                                          │
│     final_price: 53.82                                              │
│   },                                                                 │
│   bonus_points: 53,                                                  │
│   customer: { first_name: "Rezgar", ... }                           │
│ }                                                                    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: Show Popup                                                  │
├─────────────────────────────────────────────────────────────────────┤
│ Frontend → BundleOfferPopup renders                                 │
│   - On mount: Log "viewed" event to WordPress                       │
│   - POST /wp-json/wg/v1/intelligence/bundle-status                  │
│     Body: { offer_id: 93, status: "viewed" }                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 3. Profile Recalculation Flow (WordPress)

```
┌─────────────────────────────────────────────────────────────────────┐
│ TRIGGER: WooCommerce Order Completed/Processing                     │
├─────────────────────────────────────────────────────────────────────┤
│ WordPress Hook: woocommerce_order_status_completed                  │
│ Function: wg_auto_recalculate_profile_on_order($order_id)          │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ WG_Purchase_Analyzer::recalculate_profile($email)                  │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Get all completed WooCommerce orders (wc_get_orders)            │
│ 2. Extract products from last 3 orders                              │
│    - Exclude product IDs: 1893, 334999                              │
│ 3. Calculate product scores:                                        │
│    - score = (total_quantity × 2) + (appearances × 3)              │
│    - Sort by score, take top 5                                      │
│ 4. Find peak spending (highest quantity order)                      │
│ 5. Calculate purchase cycle (avg days between orders)               │
│ 6. Calculate next prime window:                                     │
│    - start = last_order_date + (cycle × 0.8)                       │
│    - end = last_order_date + (cycle × 1.2)                         │
│ 7. Calculate profile score (0-100, RFM model)                       │
│ 8. Update MySQL wp_wg_customer_intelligence                         │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ WG_Supabase_Sync::sync_profile($email, $profile_data)              │
├─────────────────────────────────────────────────────────────────────┤
│ POST https://dqddlmniyacbiviovgfw.supabase.co/rest/v1/             │
│      customer_intelligence                                           │
│                                                                       │
│ Headers:                                                             │
│   - Prefer: resolution=merge-duplicates (UPSERT)                    │
│   - apikey: [SUPABASE_ANON_KEY]                                     │
│                                                                       │
│ Body: { customer_email, favorite_products, peak_spending, ... }    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Primaire Functionaliteiten

### 1. Browser Fingerprinting
- **40+ data points** verzameld voor unieke identificatie
- **SHA-256 hashing** voor privacy
- **localStorage persistence** (key: `wg_device_fp`)
- **Cross-session tracking** mogelijk
- **GDPR-compliant** (geen PII)

### 2. IP-based Recognition
- **SHA-256 + AUTH_KEY salt** voor security
- **Proxy-aware** IP detection
- **Geo-location** via ip-api.com
- **Multi-device support** via device_tracking table

### 3. Purchase Pattern Analysis
- **RFM Model**: Recency, Frequency, Monetary
- **Favorite Products**: Frequency + recency scoring
- **Peak Spending**: Highest quantity ever ordered
- **Purchase Cycle**: Average days between orders
- **Prime Windows**: 80-120% van purchase cycle

### 4. Bundle Generation
- **Eligibility**:
  - In prime window (days_since_last_order >= 14 OR within calculated window)
  - Has favorite products (excluding 1893, 334999)
  - Peak spending >= 3 (target bundle = peak + 1, min 4)
- **Composition**:
  - Top 2 favorites (60/40 split)
  - Target quantity = peak_spending + 1
- **Pricing**:
  - Base discount: 10% (4+ items), 12% (5+ items), 15% (7+ items)
  - Profile bonus: +2% (score 60-79), +3% (score 80+)
  - Max discount: 20%
- **Loyalty Points**:
  - Base: 1 point per euro
  - Multiplier: 1.25x (score 60-79), 1.5x (score 80+)

### 5. Bundle Offer Display
- **Trigger**: Customer recognition via IP/fingerprint
- **Timing**: 5 seconds after page load
- **Excluded Pages**: checkout, payment, cart
- **Personalization**: First name greeting
- **Countdown**: Expires in X days
- **Actions**: Accept (add to cart) / Reject

### 6. Event Tracking
- **Important Events Only**:
  - `checkout_email_entered`
  - `bundle_viewed`, `bundle_accepted`, `bundle_rejected`
  - `order_completed`
- **Data Logged**:
  - session_id, customer_email, ip_hash, fingerprint
  - event_type, event_data (JSONB)
  - page_url, timestamp
- **Storage**: Supabase behavioral_events table

---

## Security & Privacy

### GDPR Compliance

1. **IP Address Hashing**
   - SHA-256 met AUTH_KEY salt
   - Original IP never stored
   - One-way hash (niet reversible)

2. **Browser Fingerprinting**
   - Geen PII collected
   - Device characteristics only
   - SHA-256 hash stored
   - localStorage opt-out mogelijk

3. **Data Retention**
   - Device tracking: 365 dagen (GDPR max)
   - Cleanup via `WG_Device_Tracker::cleanup_old_devices()`
   - Behavioral events: Geen auto-cleanup (business analytics)

4. **Data Access**
   - Supabase RLS (Row Level Security) actief
   - Anon key heeft read-only access
   - Service key alleen in WordPress backend

### Security Measures

1. **API Authentication**
   - WordPress REST API: WordPress nonce validation
   - Supabase: API key authentication
   - Next.js API Routes: Server-side validation

2. **Input Validation**
   - Email validation (filter_var FILTER_VALIDATE_EMAIL)
   - SQL injection prevention (WordPress $wpdb->prepare)
   - XSS prevention (WordPress sanitize functions)

3. **Rate Limiting**
   - WordPress REST API: Built-in rate limiting
   - Supabase: API rate limits (free tier: 500 req/min)

4. **Error Handling**
   - No sensitive data in error messages
   - WordPress debug.log voor server errors
   - Frontend console.error voor client errors

---

## Performance Optimizations

### Database
- **Indexes**: customer_email, ip_hash, browser_fingerprint
- **Upsert Logic**: Update existing records ipv insert duplicates
- **Supabase Connection Pooling**: Automatic
- **Query Optimization**: Single queries where possible

### Frontend
- **Lazy Loading**: BundleOfferPopup only when needed
- **Debouncing**: 2-5 second delay before API calls
- **localStorage Caching**: Fingerprint cached for 30+ days
- **React Optimization**: useCallback, useMemo where needed

### API
- **Caching**: No caching (always fresh data)
- **Timeouts**: 15 seconds voor WordPress API calls
- **Error Recovery**: Graceful fallbacks

---

## Deployment

### WordPress Plugin Installation
1. Upload plugin folder naar `wp-content/plugins/`
2. Activate plugin via WordPress admin
3. Configure Supabase credentials (zie plugin README)

### Next.js Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=https://dqddlmniyacbiviovgfw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Supabase Tables
- Tables worden automatisch aangemaakt door WordPress plugin
- RLS policies moeten handmatig worden geconfigureerd

---

## Troubleshooting

### Bundle Popup Niet Zichtbaar
1. Check console logs: `[Bundle] ...`
2. Verify fingerprint: `localStorage.getItem('wg_device_fp')`
3. Check Supabase device_tracking: Match op fingerprint/ip_hash?
4. Check bundle eligibility:
   - In prime window? (days_since_last_order >= 14)
   - Has favorite products? (excluding 1893, 334999)
   - Peak spending >= 3?

### Customer Niet Herkend
1. Check IP hashing: Consistent tussen Next.js en WordPress?
2. Check fingerprint: Stored in localStorage?
3. Check device_tracking table: Record bestaat?
4. Check profile sync: WordPress → Supabase sync successful?

### Bundle Generation Faalt
1. Check WordPress profile: Exists in wp_wg_customer_intelligence?
2. Check favorite products: Any non-excluded products?
3. Check prime window calculation: Correct dates?
4. Check WordPress error_log: Any PHP errors?

---

## Toekomstige Verbeteringen

1. **Real-time Updates**: Supabase Realtime voor instant bundle updates
2. **A/B Testing**: Different bundle compositions, discounts
3. **Email Integration**: Bundle offers via email
4. **Mobile App**: React Native implementation
5. **Machine Learning**: Predictive analytics voor churn prevention
6. **Multi-language**: i18n support voor bundle messages

---

## Contact & Support

Voor vragen of support:
- **Documentation**: `/docs/customer-intelligence-api/`
- **WordPress Plugin**: `wordpress_plugin/customer-intelligence-api/`
- **Next.js Implementation**: `web/src/`

---

**Einde Architectuur Documentatie**

