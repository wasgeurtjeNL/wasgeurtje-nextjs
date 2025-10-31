# Customer Intelligence System - File Tree & Uitleg

**Versie:** 1.0  
**Laatst bijgewerkt:** 30 oktober 2024

---

## 📂 Complete File Structure

```
wasguerjte-main/
│
├── wordpress_plugin/
│   └── customer-intelligence-api/              # WordPress Plugin Root
│       ├── customer-intelligence-api.php       # ⭐ Main plugin file
│       ├── includes/                            # PHP Classes
│       │   ├── class-rest-api.php              # ⭐ REST API endpoints
│       │   ├── class-ip-tracker.php            # ⭐ IP tracking & hashing
│       │   ├── class-device-tracker.php        # ⭐ Multi-device tracking
│       │   ├── class-purchase-analyzer.php     # ⭐ Purchase pattern analysis
│       │   ├── class-bundle-generator.php      # ⭐ Bundle generation logic
│       │   └── class-supabase-sync.php         # ⭐ WordPress → Supabase sync
│       ├── README.md                            # Plugin documentation
│       └── INSTALLATION.md                      # Installation instructions
│
├── web/                                         # Next.js Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   └── intelligence/               # API Routes
│   │   │   │       ├── track-customer/
│   │   │   │       │   └── route.ts            # ⭐ Customer tracking API
│   │   │   │       ├── bundle/
│   │   │   │       │   └── route.ts            # ⭐ Bundle fetch/generate API
│   │   │   │       └── bundle-status-update/
│   │   │   │           └── route.ts            # Bundle status update (DEPRECATED)
│   │   │   └── layout.tsx                       # Root layout (mounts GlobalBundleOfferManager)
│   │   │
│   │   ├── components/
│   │   │   ├── GlobalBundleOfferManager.tsx    # ⭐ Bundle offer orchestrator
│   │   │   └── BundleOfferPopup.tsx            # ⭐ Bundle popup UI
│   │   │
│   │   ├── hooks/
│   │   │   └── useCustomerTracking.ts          # ⭐ Customer tracking hook
│   │   │
│   │   ├── utils/
│   │   │   └── fingerprint.ts                  # ⭐ Browser fingerprinting
│   │   │
│   │   ├── lib/
│   │   │   └── supabase.ts                     # ⭐ Supabase client & helpers
│   │   │
│   │   └── context/
│   │       └── AuthContext.tsx                  # User authentication context
│   │
│   ├── .env.local                               # Environment variables
│   ├── package.json                             # Dependencies
│   └── next.config.js                           # Next.js configuration
│
└── docs/
    └── customer-intelligence-api/               # Deze documentatie
        ├── ARCHITECTURE.md                      # ⭐ Architectuur overzicht
        ├── FILE_TREE.md                         # ⭐ Dit bestand
        ├── DATA_FLOW.md                         # ⭐ Data flows (volgende)
        ├── API_REFERENCE.md                     # ⭐ API endpoints (volgende)
        └── DATABASE_SCHEMA.md                   # ⭐ Database schema (volgende)
```

---

## 📝 Bestand Details

### **WordPress Plugin Files**

#### `wordpress_plugin/customer-intelligence-api/customer-intelligence-api.php`
**Type:** PHP - Main Plugin File  
**Verantwoordelijkheden:**
- Plugin metadata (name, version, author)
- Database table creation (`wp_wg_customer_intelligence`, `wp_wg_device_tracking`, `wp_wg_bundle_offers`, `wp_wg_behavioral_events`)
- Class autoloading
- WordPress hooks registration
- Automatic profile recalculation on order completion

**Belangrijke Functions:**
```php
function wg_auto_recalculate_profile_on_order($order_id)
```
- **Trigger**: `woocommerce_order_status_completed`, `woocommerce_order_status_processing`
- **Actie**: Recalculate customer profile + sync to Supabase

**Database Tables Created:**
- `wp_wg_customer_intelligence`: Customer profiles
- `wp_wg_device_tracking`: Multi-device history
- `wp_wg_bundle_offers`: Bundle offers
- `wp_wg_behavioral_events`: Event logs

---

#### `wordpress_plugin/customer-intelligence-api/includes/class-rest-api.php`
**Type:** PHP Class  
**Klasse:** `WG_Customer_Intelligence_REST_API`  
**Verantwoordelijkheden:**
- WordPress REST API endpoints registration
- Request validation & sanitization
- Response formatting
- Error handling

**REST Endpoints:**

1. **`GET /wp-json/wg/v1/intelligence/profile`**
   - Get customer profile by email
   - **Parameters**: `customer_email` (required)
   - **Returns**: Customer intelligence profile
   - **Handler**: `get_profile_endpoint()`

2. **`POST /wp-json/wg/v1/intelligence/recalculate`**
   - Trigger profile recalculation
   - **Parameters**: `customer_email` (required)
   - **Returns**: Updated profile data
   - **Handler**: `recalculate_profile_endpoint()`
   - **Calls**: `WG_Purchase_Analyzer::recalculate_profile()`

3. **`GET /wp-json/wg/v1/intelligence/bundle`**
   - Get/generate bundle offer
   - **Parameters**: `customer_email` (required)
   - **Returns**: Bundle offer data
   - **Handler**: `get_bundle_endpoint()`
   - **Calls**: `WG_Bundle_Generator::generate_bundle()`
   - **Auto-sync**: Yes (Supabase)

4. **`POST /wp-json/wg/v1/intelligence/bundle-status`**
   - Update bundle offer status
   - **Parameters**: `offer_id`, `status`, `customer_email`
   - **Valid Statuses**: pending, viewed, added_to_cart, purchased, expired, rejected
   - **Returns**: Success confirmation
   - **Handler**: `update_bundle_status_endpoint()`
   - **Calls**: `WG_Bundle_Generator::update_offer_status()`

**Code Example:**
```php
register_rest_route('wg/v1', '/intelligence/bundle', [
    'methods' => 'GET',
    'callback' => [$this, 'get_bundle_endpoint'],
    'permission_callback' => '__return_true'
]);
```

---

#### `wordpress_plugin/customer-intelligence-api/includes/class-ip-tracker.php`
**Type:** PHP Class  
**Klasse:** `WG_IP_Tracker`  
**Verantwoordelijkheden:**
- IP address hashing (SHA-256 + AUTH_KEY salt)
- Client IP detection (proxy-aware)
- Geo-location lookup (ip-api.com)
- Customer recognition via IP/fingerprint
- Session tracking
- Behavioral event logging

**Belangrijke Methods:**

```php
public static function hash_ip($ip_address)
```
- Hash IP met SHA-256 + AUTH_KEY salt voor GDPR compliance
- **Input**: `192.168.1.1`
- **Output**: `a3f5...` (64-char hex)

```php
public static function get_client_ip()
```
- Detect client IP (proxy-aware)
- **Checks**: `HTTP_CF_CONNECTING_IP`, `HTTP_X_FORWARDED_FOR`, `HTTP_X_REAL_IP`, `REMOTE_ADDR`
- **Returns**: Client IP string

```php
public static function find_customer_by_ip($ip_address = null)
```
- Find customer via device tracking history
- **Delegates to**: `WG_Device_Tracker::find_customer_by_device()`
- **Returns**: Customer object or null

```php
public static function find_customer_by_fingerprint($browser_fingerprint)
```
- Find customer via fingerprint
- **Delegates to**: `WG_Device_Tracker::find_customer_by_device()`
- **Returns**: Customer object or null

```php
public static function track_session($customer_id, $customer_email, $ip_address, $browser_fingerprint, $event_type, $event_data)
```
- Main tracking function
- **Flow**:
  1. Hash IP
  2. Get geo data
  3. Recognize customer via devices
  4. Track device (upsert)
  5. Update customer intelligence profile
  6. Log important events only

```php
public static function log_event($event_type, $event_data, ...)
```
- Log behavioral event to wp_wg_behavioral_events
- **Important Events Only**:
  - checkout_start, checkout_email_entered
  - bundle_viewed, bundle_accepted, bundle_rejected
  - order_completed

---

#### `wordpress_plugin/customer-intelligence-api/includes/class-device-tracker.php`
**Type:** PHP Class  
**Klasse:** `WG_Device_Tracker`  
**Verantwoordelijkheden:**
- Multi-device/network history tracking
- Device recognition (IP + fingerprint)
- Visit count tracking (upsert logic)
- Device cleanup (GDPR: 365 days retention)

**Belangrijke Methods:**

```php
public static function track_device($customer_email, $customer_id, $ip_address, $browser_fingerprint, $user_agent)
```
- Track/update device for customer
- **Unique Key**: `ip_hash + browser_fingerprint + customer_email`
- **Logic**: Upsert (update if exists, insert if new)
- **On Update**: Increment visit_count, update last_seen
- **Returns**: `{ success, action: 'created'|'updated', device_id, visit_count, is_new_device }`

```php
public static function find_customer_by_device($ip_address, $browser_fingerprint)
```
- Find customer across all devices
- **Search**: Match by ip_hash OR browser_fingerprint
- **Returns**: Most recent customer match (by last_seen DESC)
- **SQL**: `SELECT ... WHERE ip_hash = ? OR browser_fingerprint = ? ORDER BY last_seen DESC LIMIT 1`

```php
public static function get_customer_devices($customer_email)
```
- Get all devices for a customer
- **Returns**: Array of device records (ordered by last_seen DESC)

```php
public static function cleanup_old_devices($days_inactive = 365)
```
- GDPR compliance: Delete devices inactive for X days
- **Default**: 365 days
- **Returns**: Number of records deleted

---

#### `wordpress_plugin/customer-intelligence-api/includes/class-purchase-analyzer.php`
**Type:** PHP Class  
**Klasse:** `WG_Purchase_Analyzer`  
**Verantwoordelijkheden:**
- WooCommerce order analysis
- Favorite products calculation
- Peak spending detection
- Purchase cycle calculation
- Prime window prediction
- Profile score calculation (RFM model)

**Belangrijke Methods:**

```php
public static function recalculate_profile($customer_email, $customer_id = null)
```
- **Main function**: Recalculate complete customer profile
- **Flow**:
  1. Get all completed WooCommerce orders
  2. Extract products from last 3 orders (exclude 1893, 334999)
  3. Calculate product scores (frequency + recency)
  4. Find peak spending (highest quantity order)
  5. Calculate purchase cycle (avg days between orders)
  6. Calculate next prime window (80-120% of cycle)
  7. Calculate profile score (0-100, RFM model)
  8. Update MySQL wp_wg_customer_intelligence
  9. Sync to Supabase (via `WG_Supabase_Sync`)

```php
private static function calculate_product_scores($products)
```
- **Scoring Formula**: `score = (total_quantity × 2) + (appearances × 3)`
- **Weight**: Frequency (appearances) > Quantity
- **Returns**: Top 5 products sorted by score

```php
private static function find_peak_spending($orders)
```
- Find order with highest non-excluded product quantity
- **Returns**: `{ quantity, amount, order_id, order_number, order_date }`

```php
private static function calculate_purchase_cycle($orders)
```
- Calculate average days between orders
- **Minimum**: 7 days
- **Default** (< 2 orders): 14 days
- **Formula**: `AVG(order[i].date - order[i+1].date)`

```php
private static function calculate_prime_window($last_order_date, $purchase_cycle)
```
- Predict next buying window
- **Window Start**: last_order_date + (cycle × 0.8)
- **Window End**: last_order_date + (cycle × 1.2)
- **Returns**: `{ start, end }` (datetime strings)

```php
private static function calculate_profile_score($metrics)
```
- RFM Model (Recency, Frequency, Monetary)
- **Weights**:
  - Orders: 0-30 points (5 points per order)
  - AOV: 0-30 points ((avg_order_value / 10) × 3)
  - Recency: 0-40 points (40 if ≤14 days, 30 if ≤30 days, ...)
- **Max Score**: 100

**Product Exclusion:**
```php
private static $excluded_product_ids = [1893, 334999];
```
- These products never appear in favorite products
- Never included in bundle offers
- Reason: Special products (samples, tests, etc.)

---

#### `wordpress_plugin/customer-intelligence-api/includes/class-bundle-generator.php`
**Type:** PHP Class  
**Klasse:** `WG_Bundle_Generator`  
**Verantwoordelijkheden:**
- Personalized bundle generation
- Prime window eligibility check
- Bundle composition creation
- Dynamic discount calculation
- Loyalty points calculation
- Bundle offer storage (MySQL + Supabase)

**Belangrijke Methods:**

```php
public static function generate_bundle($customer_email, $customer_id = null)
```
- **Main function**: Generate personalized bundle offer
- **Eligibility Checks**:
  1. Profile exists? → If not: return error
  2. In prime window? → days_since_last_order >= 14 OR within calculated window
  3. Has favorite products? → If empty: return error
  4. Has valid (non-excluded) products? → If only 1893/334999: return error
  5. Peak spending >= 3? → target_quantity = peak + 1, minimum 4
- **Flow**:
  1. Get profile from MySQL
  2. Check prime window
  3. Get favorites (filter excluded products)
  4. Calculate target quantity
  5. Create bundle composition
  6. Calculate pricing
  7. Calculate loyalty points
  8. Save to MySQL wp_wg_bundle_offers
  9. Sync to Supabase
  10. Get customer name from WooCommerce
  11. Return bundle data

```php
private static function is_in_prime_window($profile)
```
- **Logic**:
  - **Case 1**: days_since_last_order >= 14 → ALWAYS IN PRIME (re-engagement!)
  - **Case 2**: days_since_last_order < 14 → Check calculated window
- **Returns**: boolean

```php
private static function create_bundle_composition($favorites, $target_quantity)
```
- **Strategy**: Top 2 favorites, 60/40 split
- **Example**: 
  - Target: 5 items
  - Product A (favorite #1): 3 items (60%)
  - Product B (favorite #2): 2 items (40%)
- **Returns**: Array of bundle items

```php
private static function calculate_bundle_pricing($bundle, $profile)
```
- **Base Discount**:
  - 4+ items: 10%
  - 5+ items: 12%
  - 7+ items: 15%
- **Profile Bonus**:
  - Score 60-79: +2%
  - Score 80+: +3%
- **Max Discount**: 20%
- **Returns**: `{ base_price, discount_percentage, discount_amount, final_price, bundle_items }`

```php
private static function calculate_bonus_points($final_price, $profile)
```
- **Base**: 1 point per euro
- **Multiplier**:
  - Score 60-79: 1.25x
  - Score 80+: 1.5x
- **Returns**: Integer points

```php
public static function get_active_offers($customer_email)
```
- Get all active bundle offers for customer
- **Filter**: status IN ('pending', 'viewed') AND expires_at > NOW()
- **Returns**: Array of offers

```php
public static function update_offer_status($offer_id, $status, $conversion_value)
```
- Update bundle offer status
- **Statuses**: pending → viewed → added_to_cart → purchased | rejected | expired
- **Tracks**: viewed_at, responded_at, conversion_value

---

#### `wordpress_plugin/customer-intelligence-api/includes/class-supabase-sync.php`
**Type:** PHP Class  
**Klasse:** `WG_Supabase_Sync`  
**Verantwoordelijkheden:**
- WordPress → Supabase synchronization
- Profile upsert to Supabase
- Bundle offer insert to Supabase
- Customer name retrieval (WooCommerce)

**Configuration:**
```php
private static $supabase_url = 'https://dqddlmniyacbiviovgfw.supabase.co';
private static $supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**Belangrijke Methods:**

```php
public static function sync_profile($customer_email, $profile_data)
```
- Sync customer intelligence profile to Supabase
- **Method**: POST (with Prefer: resolution=merge-duplicates → UPSERT)
- **Endpoint**: `/rest/v1/customer_intelligence`
- **Data Transform**: WordPress format → Supabase format
- **Returns**: boolean success

```php
public static function sync_bundle_offer($offer_data)
```
- Sync bundle offer to Supabase
- **Method**: POST (INSERT only, no upsert)
- **Endpoint**: `/rest/v1/bundle_offers`
- **Data**: bundle_products (JSONB), pricing, status, timestamps
- **Returns**: boolean success

```php
public static function get_profile_data($customer_email)
```
- Get complete profile data from WordPress MySQL
- **Includes**: first_name, last_name from WooCommerce
- **Fallback**: Get name from most recent order if customer_id missing
- **Returns**: Profile array

**Error Handling:**
- All errors logged via `error_log()`
- Graceful failure (returns false, doesn't throw)
- Detailed error messages in WordPress debug.log

---

### **Next.js Frontend Files**

#### `web/src/app/api/intelligence/track-customer/route.ts`
**Type:** TypeScript - Next.js API Route  
**Method:** POST  
**Endpoint:** `/api/intelligence/track-customer`  
**Verantwoordelijkheden:**
- Customer session tracking
- IP hash generation
- Device recognition (IP + fingerprint)
- Device tracking upsert
- WordPress profile sync
- Behavioral event logging (important events only)

**Request Body:**
```typescript
{
  email?: string;              // Customer email (optional)
  customer_id?: number;        // Customer ID (optional)
  event_type?: string;         // Event type (optional)
  fingerprint?: string;        // Browser fingerprint (optional)
}
```

**Response:**
```typescript
{
  success: boolean;
  tracked: {
    customer_email: string;
    ip_hash: string;
    fingerprint: string | null;
  };
  profile: CustomerIntelligence | null;
}
```

**Flow:**
1. Parse request body
2. Get client IP from headers (X-Forwarded-For, X-Real-IP)
3. Hash IP (SHA-256 + crypto.createHash)
4. **Device Recognition**:
   - Query Supabase device_tracking by fingerprint OR ip_hash
   - If match found → customer_email recognized!
5. **Device Tracking**:
   - Upsert device_tracking record (increment visit_count)
6. **Profile Sync**:
   - Fetch profile from Supabase
   - If missing/outdated → Fetch from WordPress `/intelligence/profile`
   - Upsert to Supabase
7. **Event Logging** (only if event_type provided):
   - Important events only: checkout_email_entered, bundle_viewed, etc.
   - Insert to behavioral_events table
8. Return response

**Important Events:**
```typescript
const importantEvents = [
  'checkout_start',
  'checkout_email_entered',
  'bundle_viewed',
  'bundle_accepted',
  'bundle_rejected',
  'order_completed'
];
```

---

#### `web/src/app/api/intelligence/bundle/route.ts`
**Type:** TypeScript - Next.js API Route  
**Method:** GET  
**Endpoint:** `/api/intelligence/bundle`  
**Verantwoordelijkheden:**
- Bundle offer retrieval from Supabase
- Automatic bundle generation via WordPress (if not exists)
- Customer profile enrichment
- Response formatting

**Query Parameters:**
```typescript
?customer_email=xxx@example.com
// OR
?fingerprint=abc123...
```

**Response:**
```typescript
{
  success: boolean;
  offer_id: number;
  bundle: Array<{
    product_id: number;
    name: string;
    slug: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
  pricing: {
    base_price: number;
    discount_percentage: number;
    discount_amount: number;
    final_price: number;
  };
  bonus_points: number;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
  };
  profile: {
    total_orders: number;
    days_since_last_order: number;
    favorite_products: Array<...>;
  };
}
```

**Flow:**
1. Parse query params (email or fingerprint required)
2. **Find Customer**:
   - If email provided → Direct lookup
   - If fingerprint → Find via device_tracking
3. **Check Existing Bundle** (Supabase):
   - Query bundle_offers: email + status='pending' + expires_at > NOW()
   - If found → SKIP WordPress call (return existing)
4. **Generate Bundle** (WordPress):
   - If no bundle → Call `GET /wp-json/wg/v1/intelligence/bundle?customer_email=xxx`
   - WordPress generates + saves + syncs to Supabase
   - Returns bundle data
5. **Enrich Response**:
   - Fetch customer profile from Supabase
   - Add first_name, favorite_products, etc.
6. Return complete bundle offer

**Auto-Generation Logic:**
```typescript
if (!bundleOffer) {
  console.log(`[Bundle API] No bundle found, generating via WordPress...`);
  
  const wpResponse = await fetch(
    `https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle?customer_email=${email}`,
    { method: 'GET', cache: 'no-store' }
  );
  
  const wpData = await wpResponse.json();
  
  if (wpData.success) {
    // Bundle generated! Check Supabase again
    bundleOffer = await db.bundle_offers.findActiveByEmail(email);
  }
}
```

---

#### `web/src/app/api/intelligence/bundle-status-update/route.ts`
**Type:** TypeScript - Next.js API Route  
**Method:** POST  
**Endpoint:** `/api/intelligence/bundle-status-update`  
**Status:** **DEPRECATED** ⚠️  

**Waarom Deprecated:**
- Originally designed for direct Supabase updates
- Now using WordPress REST API for bundle status updates
- WordPress is source of truth for all customer data
- WordPress automatically syncs to Supabase

**Current Implementation:**
- Frontend calls WordPress endpoint: `POST /wp-json/wg/v1/intelligence/bundle-status`
- WordPress updates MySQL wp_wg_bundle_offers
- WordPress syncs to Supabase (optional, not required)
- WordPress logs behavioral event

**Migration Note:**
This API route folder kan verwijderd worden in toekomstige cleanup.

---

#### `web/src/components/GlobalBundleOfferManager.tsx`
**Type:** React Component (Client-Side)  
**Verantwoordelijkheden:**
- Global bundle offer orchestrator
- Customer recognition trigger
- Bundle availability check
- Popup display management

**Props:** None (global component)

**State:**
```typescript
const [customerEmail, setCustomerEmail] = useState<string | null>(null);
const [showOffer, setShowOffer] = useState(false);
const [hasChecked, setHasChecked] = useState(false);
```

**Excluded Pages:**
```typescript
const isExcludedPage = pathname?.startsWith('/checkout') || 
                       pathname?.startsWith('/payment') ||
                       pathname?.startsWith('/cart');
```

**Flow:**

1. **On Mount** (useEffect):
   - Skip if excluded page or already checked
   - **Case A: Logged-in User**:
     - Get email from AuthContext
     - Fetch bundle via `/api/intelligence/bundle?customer_email=xxx`
     - Show popup after 5 seconds delay
   - **Case B: Anonymous User**:
     - Wait 2 seconds (page load delay)
     - Get fingerprint from localStorage (`wg_device_fp`)
     - Call `/api/intelligence/track-customer` (recognition attempt)
     - If recognized (email found in response):
       - Fetch bundle via `/api/intelligence/bundle?customer_email=xxx`
       - Show popup after 5 seconds delay

2. **Console Logging:**
   ```typescript
   console.log('[Bundle] IP/Fingerprint recognized! Customer:', email);
   console.log('[Bundle] Offer available! Showing popup...');
   console.log('[Bundle] No offer available for this customer');
   console.log('[Bundle] IP/Fingerprint not recognized');
   ```

3. **Render**:
   - If excluded page OR no offer OR no email → return null
   - Else → render `<BundleOfferPopup />`

**Event Handlers:**
```typescript
onAccept={() => {
  console.log('✅ Bundle offer accepted');
  setShowOffer(false);
  // TODO: Add products to cart
}}

onReject={() => {
  console.log('❌ Bundle offer rejected');
  setShowOffer(false);
}}

onClose(() => {
  console.log('ℹ️ Bundle offer closed');
  setShowOffer(false);
}}
```

**Mount Location:**
```typescript
// app/layout.tsx
<GlobalBundleOfferManager />
```

---

#### `web/src/components/BundleOfferPopup.tsx`
**Type:** React Component (Client-Side)  
**Verantwoordelijkheden:**
- Bundle offer UI display
- Personalized messaging
- Timer/countdown display
- Accept/Reject actions
- Status updates to WordPress

**Props:**
```typescript
interface BundleOfferPopupProps {
  customerEmail: string;
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
}
```

**State:**
```typescript
const [offer, setOffer] = useState<BundleOfferData | null>(null);
const [isOpen, setIsOpen] = useState(false);
const [timeLeft, setTimeLeft] = useState<string>('');
```

**Flow:**

1. **On Mount** (useEffect):
   - Fetch bundle offer: `GET /api/intelligence/bundle?customer_email=xxx`
   - If success + bundle exists:
     - Set offer state
     - Open popup (`setIsOpen(true)`)
     - **Log "viewed" event**:
       ```typescript
       fetch('https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle-status', {
         method: 'POST',
         body: JSON.stringify({
           offer_id: data.offer_id,
           status: 'viewed',
           customer_email: customerEmail
         })
       });
       ```

2. **Timer Update** (useEffect):
   - Calculate time left until `expires_at`
   - Update every second
   - Format: "Verloopt over 4:55" (days:hours)

3. **Accept Handler:**
   ```typescript
   const handleAccept = async () => {
     // Update status to "added_to_cart"
     await fetch('https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle-status', {
       method: 'POST',
       body: JSON.stringify({
         offer_id: offer.offer_id,
         status: 'added_to_cart',
         customer_email: customerEmail
       })
     });
     
     // Add products to cart
     for (const item of offer.bundle) {
       await addToCart(item.product_id, item.quantity);
     }
     
     // Close popup
     onAccept();
   };
   ```

4. **Reject Handler:**
   ```typescript
   const handleReject = async () => {
     // Update status to "rejected"
     await fetch('https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle-status', {
       method: 'POST',
       body: JSON.stringify({
         offer_id: offer.offer_id,
         status: 'rejected',
         customer_email: customerEmail
       })
     });
     
     // Close popup
     onReject();
   };
   ```

**UI Elements:**
- Personalized greeting: "Hé {first_name}! 👋"
- Bundle title: "Jouw persoonlijke bundel: 2x Full Moon, 1x Blossom Drip"
- Discount badge: "Bespaar 22%!"
- Pricing: ~~€44.85~~ → **€34.85 VIP prijs**
- Loyalty points: "🎁 BONUS: +150 loyaliteitspunten!"
- Timer: "⚡ Verloopt over 4:55"
- CTA Button: "{first_name}, claim jouw 22% korting! 🎉"
- Reject link: "Nee bedankt"

---

#### `web/src/hooks/useCustomerTracking.ts`
**Type:** React Hook  
**Verantwoordelijkheden:**
- Customer tracking abstraction
- Session management
- Fingerprint integration
- Event type handling

**Hook Signature:**
```typescript
function useCustomerTracking(options: TrackingOptions): {
  trackCustomer: (email?: string, customerId?: number) => Promise<void>;
  hasTracked: boolean;
}

interface TrackingOptions {
  email?: string;
  customerId?: number;
  eventType?: string;
  oncePerSession?: boolean;
}
```

**Usage Examples:**

1. **Auto-track on mount:**
   ```typescript
   useCustomerTracking({ 
     email: 'user@example.com',
     oncePerSession: true 
   });
   ```

2. **Manual tracking:**
   ```typescript
   const { trackCustomer } = useCustomerTracking();
   
   const handleCheckout = async () => {
     await trackCustomer('user@example.com');
   };
   ```

**Exported Helper Functions:**

1. **`trackCheckoutEmail(email: string)`**
   - Track email entry in checkout
   - Event type: `checkout_email_entered`
   - Auto-includes fingerprint

2. **`trackUserLogin(email: string, customerId: number)`**
   - Track user login
   - NO event_type (device update only, no event logging)
   - Updates device tracking with latest fingerprint

**Implementation:**
```typescript
export function useCustomerTracking(options: TrackingOptions = {}) {
  const hasTracked = useRef(false);
  const { email, customerId, eventType, oncePerSession = true } = options;

  const trackCustomer = useCallback(async (trackEmail?: string, trackCustomerId?: number) => {
    if (oncePerSession && hasTracked.current) return;

    const finalEmail = trackEmail || email;
    const fingerprint = await getStoredFingerprint();

    const response = await fetch('/api/intelligence/track-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: finalEmail,
        customer_id: trackCustomerId || customerId,
        event_type: eventType,
        fingerprint: fingerprint
      })
    });

    const data = await response.json();
    if (data.success) {
      hasTracked.current = true;
    }
  }, [email, customerId, eventType, oncePerSession]);

  // Auto-track on mount if email/ID provided
  useEffect(() => {
    if (email || customerId) {
      trackCustomer();
    }
  }, [email, customerId, trackCustomer]);

  return { trackCustomer, hasTracked: hasTracked.current };
}
```

---

#### `web/src/utils/fingerprint.ts`
**Type:** TypeScript Utility  
**Verantwoordelijkheden:**
- Browser fingerprint generation
- Device characteristics collection (40+ data points)
- SHA-256 hashing
- localStorage persistence

**Main Functions:**

```typescript
export async function generateFingerprint(): Promise<string>
```
- Generate unique fingerprint from device characteristics
- **Returns**: 64-character SHA-256 hex string
- **Method**: `crypto.subtle.digest('SHA-256', ...)`

```typescript
export async function getStoredFingerprint(): Promise<string>
```
- Get fingerprint from localStorage or generate new
- **Storage Key**: `wg_device_fp`
- **Persistence**: Permanent (until localStorage cleared)
- **Returns**: Fingerprint string

**Fingerprint Components (40+ data points):**

1. **Basic Browser Info:**
   - `userAgent`, `language`

2. **Screen & Display:**
   - `colorDepth`, `deviceMemory`, `hardwareConcurrency`
   - `screenResolution`, `availableScreenResolution`

3. **Time & Location:**
   - `timezoneOffset`, `timezone`

4. **Storage Capabilities:**
   - `sessionStorage`, `localStorage`, `indexedDb`
   - `addBehavior`, `openDatabase`

5. **Platform Info:**
   - `cpuClass`, `platform`, `doNotTrack`

6. **Plugins:**
   - Array of installed plugin names (sorted)

7. **Canvas Fingerprint:**
   - Render text + shapes to canvas
   - Convert to data URL
   - **Example**: `data:image/png;base64,iVBORw0KG...`

8. **WebGL Fingerprint:**
   - WebGL vendor + renderer info
   - **Example**: `Google Inc.~ANGLE (Intel HD Graphics 620)`

9. **Audio Fingerprint:**
   - Audio context oscillator analysis
   - First 50 chars of waveform data

10. **Touch Support:**
    - `maxTouchPoints`, `TouchEvent support`, `ontouchstart`

11. **Font Detection:**
    - Check 11 common fonts
    - **Method**: Canvas text measurement comparison

**Privacy Considerations:**
- No PII collected
- Only device/browser characteristics
- GDPR-compliant
- User can clear localStorage to reset

**Code Example:**
```typescript
const fingerprint = await getStoredFingerprint();
console.log(fingerprint); // "990eb8b7fb69ad20206fb31cda3944a701ea3a3b..."
```

---

#### `web/src/lib/supabase.ts`
**Type:** TypeScript - Supabase Client Configuration  
**Verantwoordelijkheden:**
- Supabase client initialization
- Database helper functions
- TypeScript type definitions

**Clients:**
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});
```

**Database Helpers:**

1. **`db.customer_intelligence.*`**
   ```typescript
   findByEmail(email: string): Promise<CustomerIntelligence | null>
   findByFingerprint(fingerprint: string): Promise<CustomerIntelligence | null>
   upsert(profile: any): Promise<CustomerIntelligence | null>
   ```

2. **`db.device_tracking.*`**
   ```typescript
   findByFingerprint(fingerprint: string): Promise<DeviceTracking | null>
   upsert(device: any): Promise<DeviceTracking | null>
   ```

3. **`db.bundle_offers.*`**
   ```typescript
   findActiveByEmail(email: string): Promise<BundleOffer | null>
   updateStatus(offerId: string, status: string): Promise<BundleOffer | null>
   create(offer: any): Promise<BundleOffer | null>
   ```

4. **`db.behavioral_events.*`**
   ```typescript
   create(event: any): Promise<BehavioralEvent | null>
   ```

**TypeScript Types:**
```typescript
export interface CustomerIntelligence {
  id: string;
  customer_id: number | null;
  customer_email: string;
  ip_hash: string;
  browser_fingerprint: string | null;
  favorite_products: any | null;
  peak_spending_quantity: number;
  // ... etc
}

export interface BundleOffer {
  id: string;
  customer_email: string;
  bundle_products: any;
  base_price: number;
  final_price: number;
  status: 'pending' | 'viewed' | 'added_to_cart' | 'purchased' | 'expired' | 'rejected';
  // ... etc
}
```

**Usage Example:**
```typescript
import { db } from '@/lib/supabase';

// Find customer
const profile = await db.customer_intelligence.findByEmail('user@example.com');

// Find bundle
const bundle = await db.bundle_offers.findActiveByEmail('user@example.com');

// Update status
await db.bundle_offers.updateStatus(bundle.id, 'viewed');

// Log event
await db.behavioral_events.create({
  customer_email: 'user@example.com',
  event_type: 'bundle_viewed',
  event_data: { offer_id: bundle.id }
});
```

---

## 🔄 File Dependencies

### WordPress → Supabase Flow
```
customer-intelligence-api.php
  └─> (Hook) woocommerce_order_status_completed
      └─> WG_Purchase_Analyzer::recalculate_profile()
          └─> WG_Supabase_Sync::sync_profile()
              └─> POST Supabase /customer_intelligence

class-rest-api.php
  └─> /intelligence/bundle endpoint
      └─> WG_Bundle_Generator::generate_bundle()
          ├─> WG_Supabase_Sync::sync_bundle_offer()
          │   └─> POST Supabase /bundle_offers
          └─> Return bundle data
```

### Frontend → Backend Flow
```
GlobalBundleOfferManager.tsx
  └─> POST /api/intelligence/track-customer
      ├─> Query Supabase device_tracking
      ├─> Upsert device_tracking
      └─> Return customer_email (if recognized)
  
  └─> GET /api/intelligence/bundle?email=xxx
      ├─> Query Supabase bundle_offers
      ├─> If no bundle:
      │   └─> GET /wp-json/wg/v1/intelligence/bundle
      │       └─> WordPress generates + syncs
      └─> Return bundle data

BundleOfferPopup.tsx
  └─> On mount: POST /wp-json/wg/v1/intelligence/bundle-status
      └─> WordPress updates status + logs event
  
  └─> On accept: POST /wp-json/wg/v1/intelligence/bundle-status
      └─> WordPress updates to "added_to_cart"
  
  └─> On reject: POST /wp-json/wg/v1/intelligence/bundle-status
      └─> WordPress updates to "rejected"
```

---

## 📊 Import/Export Map

### WordPress Classes (PHP)
```php
// customer-intelligence-api.php
require_once plugin_dir_path(__FILE__) . 'includes/class-rest-api.php';
require_once plugin_dir_path(__FILE__) . 'includes/class-ip-tracker.php';
require_once plugin_dir_path(__FILE__) . 'includes/class-device-tracker.php';
require_once plugin_dir_path(__FILE__) . 'includes/class-purchase-analyzer.php';
require_once plugin_dir_path(__FILE__) . 'includes/class-bundle-generator.php';
require_once plugin_dir_path(__FILE__) . 'includes/class-supabase-sync.php';
```

### Next.js Imports (TypeScript)
```typescript
// GlobalBundleOfferManager.tsx
import BundleOfferPopup from './BundleOfferPopup';
import { useAuth } from '@/context/AuthContext';

// BundleOfferPopup.tsx
// No critical imports

// track-customer/route.ts
import { db } from '@/lib/supabase';

// bundle/route.ts
import { db } from '@/lib/supabase';

// useCustomerTracking.ts
import { getStoredFingerprint } from '@/utils/fingerprint';

// fingerprint.ts
// No imports (pure utility)

// supabase.ts
import { createClient } from '@supabase/supabase-js';
```

---

**Einde File Tree Documentatie**

