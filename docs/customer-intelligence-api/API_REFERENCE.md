# Customer Intelligence System - API Reference

**Versie:** 1.0  
**Laatst bijgewerkt:** 30 oktober 2024

---

## 📋 Inhoudsopgave

1. [WordPress REST API](#wordpress-rest-api)
2. [Next.js API Routes](#nextjs-api-routes)
3. [Authentication & Security](#authentication--security)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)

---

## WordPress REST API

**Base URL:** `https://wasgeurtje.nl/wp-json/wg/v1/`

### Endpoints Overview

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/intelligence/profile` | GET | Get customer profile | No |
| `/intelligence/recalculate` | POST | Recalculate profile | No |
| `/intelligence/bundle` | GET | Get/generate bundle | No |
| `/intelligence/bundle-status` | POST | Update bundle status | No |

---

### GET `/intelligence/profile`

Get customer intelligence profile by email.

**URL:** `https://wasgeurtje.nl/wp-json/wg/v1/intelligence/profile`

#### Request

**Method:** GET  
**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customer_email` | string | Yes | Customer email address |

**Example:**
```http
GET /wp-json/wg/v1/intelligence/profile?customer_email=jackwullems18@gmail.com
Host: wasgeurtje.nl
```

#### Response

**Success Response (200 OK):**
```json
{
  "success": true,
  "profile": {
    "id": 123,
    "customer_id": 42,
    "customer_email": "jackwullems18@gmail.com",
    "ip_hash": "a3f5d2c1...",
    "browser_fingerprint": "990eb8b7...",
    "geo_country": "NL",
    "geo_city": "Amsterdam",
    "favorite_products": [
      {
        "product_id": 44,
        "name": "Full Moon",
        "slug": "full-moon",
        "score": 15,
        "total_quantity": 6,
        "appearances": 3,
        "order_numbers": ["1001", "1045", "1067"]
      }
    ],
    "peak_spending_quantity": 3,
    "peak_spending_amount": 44.85,
    "avg_order_value": 38.50,
    "total_orders": 42,
    "last_order_date": "2024-10-01 12:34:56",
    "days_since_last_order": 30,
    "purchase_cycle_days": 10,
    "next_prime_window_start": "2024-10-07 00:00:00",
    "next_prime_window_end": "2024-10-11 23:59:59",
    "profile_score": 72.5,
    "last_recalculated": "2024-10-01 12:35:00",
    "created_at": "2024-01-15 10:20:30",
    "updated_at": "2024-10-01 12:35:00"
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "message": "Customer profile not found",
  "code": "profile_not_found"
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "customer_email parameter is required",
  "code": "missing_email"
}
```

#### Notes
- Profile moet eerst gecreëerd worden via tracking of recalculate endpoint
- Profile wordt automatisch geüpdatet na elke completed/processing order
- favorite_products is een JSON array met product details

---

### POST `/intelligence/recalculate`

Trigger manual profile recalculation based on WooCommerce order history.

**URL:** `https://wasgeurtje.nl/wp-json/wg/v1/intelligence/recalculate`

#### Request

**Method:** POST  
**Headers:**
```http
Content-Type: application/json
```

**Body:**
```json
{
  "customer_email": "jackwullems18@gmail.com"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customer_email` | string | Yes | Customer email address |

**Example:**
```http
POST /wp-json/wg/v1/intelligence/recalculate HTTP/1.1
Host: wasgeurtje.nl
Content-Type: application/json

{
  "customer_email": "jackwullems18@gmail.com"
}
```

#### Response

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile recalculated successfully",
  "data": {
    "favorite_products": [
      {
        "product_id": 44,
        "name": "Full Moon",
        "slug": "full-moon",
        "score": 15,
        "total_quantity": 6,
        "appearances": 3
      }
    ],
    "peak_spending": {
      "quantity": 3,
      "amount": 44.85,
      "order_id": 12345,
      "order_number": "1045",
      "order_date": "2024-08-15 10:20:30"
    },
    "purchase_cycle": 10,
    "prime_window": {
      "start": "2024-10-07 00:00:00",
      "end": "2024-10-11 23:59:59"
    },
    "profile_score": 72.5
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "message": "No orders found for customer",
  "code": "no_orders"
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "customer_email is required",
  "code": "missing_email"
}
```

#### Notes
- Analyzes last 3 completed WooCommerce orders
- Excludes product IDs: 1893, 334999
- Automatically syncs to Supabase after recalculation
- Usually called automatically after order completion
- Manual call useful for testing or forced refresh

---

### GET `/intelligence/bundle`

Get active bundle offer or generate new one if eligible.

**URL:** `https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle`

#### Request

**Method:** GET  
**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customer_email` | string | Yes | Customer email address |

**Example:**
```http
GET /wp-json/wg/v1/intelligence/bundle?customer_email=jackwullems18@gmail.com
Host: wasgeurtje.nl
```

#### Response

**Success Response (200 OK) - Bundle Generated:**
```json
{
  "success": true,
  "offer_id": 93,
  "bundle": [
    {
      "product_id": 44,
      "name": "Full Moon",
      "slug": "full-moon",
      "quantity": 3,
      "unit_price": 14.95,
      "subtotal": 44.85
    },
    {
      "product_id": 38,
      "name": "Blossom Drip",
      "slug": "blossom-drip",
      "quantity": 2,
      "unit_price": 14.95,
      "subtotal": 29.90
    }
  ],
  "pricing": {
    "base_price": 74.75,
    "discount_percentage": 14,
    "discount_amount": 10.47,
    "final_price": 64.28,
    "bundle_items": [...]
  },
  "bonus_points": 64,
  "target_quantity": 5,
  "message": "🎁 Speciale aanbieding! Bestel 3x Full Moon + 2x Blossom Drip voor slechts €64.28 (normaal €74.75) en ontvang 64 loyaliteitspunten!",
  "customer": {
    "first_name": "Rezgar",
    "last_name": "Kasim",
    "email": "jackwullems18@gmail.com"
  },
  "profile": {
    "total_orders": 43,
    "days_since_last_order": 30,
    "favorite_products": [...]
  }
}
```

**Error Response - Not in Prime Window (200 OK):**
```json
{
  "success": false,
  "message": "Customer not in prime buying window yet",
  "next_window": "2024-10-07 00:00:00"
}
```

**Error Response - No Favorites (200 OK):**
```json
{
  "success": false,
  "message": "No favorite products identified",
  "code": "no_favorites"
}
```

**Error Response - Only Excluded Products (200 OK):**
```json
{
  "success": false,
  "message": "Customer only purchased excluded products, no bundle offer allowed",
  "code": "only_excluded"
}
```

**Error Response - Peak Spending Too Low (200 OK):**
```json
{
  "success": false,
  "message": "Customer peak spending too low for bundle offer",
  "code": "peak_too_low"
}
```

**Error Response - Profile Not Found (404):**
```json
{
  "success": false,
  "message": "Customer profile not found. Please recalculate profile first.",
  "code": "profile_not_found"
}
```

#### Bundle Generation Logic

**Eligibility Criteria:**
1. ✅ Profile exists in database
2. ✅ In prime window: 
   - days_since_last_order >= 14 OR
   - Within calculated window (80-120% of purchase cycle)
3. ✅ Has favorite products (non-empty)
4. ✅ Has valid products (excluding 1893, 334999)
5. ✅ peak_spending_quantity >= 3 (target = peak + 1, min 4)

**Bundle Composition:**
- **Top 2 Favorites**: Primary (60%), Secondary (40%)
- **Target Quantity**: peak_spending_quantity + 1
- **Example**: Peak = 3 → Target = 4 → Bundle: 2x Product A, 2x Product B

**Discount Calculation:**
```
Base Discount (quantity-based):
  - 4+ items: 10%
  - 5+ items: 12%
  - 7+ items: 15%

Profile Bonus (score-based):
  - Score 60-79: +2%
  - Score 80+: +3%

Total Discount: min(20%, base + bonus)
```

**Loyalty Points:**
```
Base: floor(final_price)
Multiplier:
  - Score 60-79: 1.25x
  - Score 80+: 1.5x
```

#### Notes
- Bundle expires after 7 days
- Automatically saves to MySQL wp_wg_bundle_offers
- Automatically syncs to Supabase bundle_offers
- Returns existing active bundle if available
- Retrieves customer first_name/last_name from WooCommerce

---

### POST `/intelligence/bundle-status`

Update bundle offer status (viewed, accepted, rejected, etc.).

**URL:** `https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle-status`

#### Request

**Method:** POST  
**Headers:**
```http
Content-Type: application/json
```

**Body:**
```json
{
  "offer_id": 93,
  "status": "added_to_cart",
  "customer_email": "jackwullems18@gmail.com"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `offer_id` | integer | Yes | Bundle offer ID |
| `status` | string | Yes | New status (see valid statuses below) |
| `customer_email` | string | Optional | Customer email (for event logging) |

**Valid Statuses:**
- `pending`: Initial state
- `viewed`: Popup shown to customer
- `added_to_cart`: Customer clicked accept
- `purchased`: Order completed with bundle products
- `expired`: Offer expired (7 days)
- `rejected`: Customer clicked reject

**Example:**
```http
POST /wp-json/wg/v1/intelligence/bundle-status HTTP/1.1
Host: wasgeurtje.nl
Content-Type: application/json

{
  "offer_id": 93,
  "status": "viewed",
  "customer_email": "jackwullems18@gmail.com"
}
```

#### Response

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Status updated successfully",
  "offer_id": 93,
  "status": "viewed"
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Invalid status. Must be one of: pending, viewed, added_to_cart, purchased, expired, rejected",
  "code": "invalid_status"
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "offer_id and status required",
  "code": "missing_parameters"
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "message": "Bundle offer not found",
  "code": "offer_not_found"
}
```

#### Behavioral Events Logged

When `customer_email` is provided, the following events are logged:

| Status | Event Type | Event Data |
|--------|-----------|------------|
| `viewed` | `bundle_viewed` | `{ offer_id, status }` |
| `added_to_cart` | `bundle_accepted` | `{ offer_id, status }` |
| `rejected` | `bundle_rejected` | `{ offer_id, status }` |

#### Notes
- Updates wp_wg_bundle_offers table
- Logs behavioral event to wp_wg_behavioral_events
- Sets responded_at timestamp
- Sets viewed_at timestamp (first time status = 'viewed')
- Optional Supabase sync (WordPress is source of truth)

---

## Next.js API Routes

**Base URL:** `http://localhost:3000/api/intelligence/` (Development)  
**Base URL:** `https://wasgeurtje.nl/api/intelligence/` (Production)

### Endpoints Overview

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/track-customer` | POST | Track customer session | No |
| `/bundle` | GET | Get bundle offer | No |
| `/bundle-status-update` | POST | Update status (DEPRECATED) | No |

---

### POST `/api/intelligence/track-customer`

Track customer session, recognize via IP/fingerprint, sync profile.

**URL:** `http://localhost:3000/api/intelligence/track-customer`

#### Request

**Method:** POST  
**Headers:**
```http
Content-Type: application/json
```

**Body:**
```json
{
  "email": "jackwullems18@gmail.com",
  "customer_id": 42,
  "event_type": "checkout_email_entered",
  "fingerprint": "990eb8b7fb69ad20206fb31cda3944a701ea3a3b..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Optional | Customer email (if known) |
| `customer_id` | number | Optional | Customer ID (if logged in) |
| `event_type` | string | Optional | Event to log (important events only) |
| `fingerprint` | string | Optional | Browser fingerprint (from localStorage) |

**Important Event Types:**
- `checkout_email_entered`: Email entered in checkout
- `bundle_viewed`: Bundle popup shown
- `bundle_accepted`: Bundle accepted
- `bundle_rejected`: Bundle rejected
- `order_completed`: Order completed

**Example:**
```http
POST /api/intelligence/track-customer HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "email": "jackwullems18@gmail.com",
  "fingerprint": "990eb8b7fb69ad20206fb31cda3944a701ea3a3b6aae5f23316cbdaea789075a"
}
```

#### Response

**Success Response - Customer Recognized (200 OK):**
```json
{
  "success": true,
  "tracked": {
    "customer_email": "jackwullems18@gmail.com",
    "ip_hash": "a3f5d2c1b8e7...",
    "fingerprint": "990eb8b7fb69..."
  },
  "profile": {
    "id": "uuid-123...",
    "customer_email": "jackwullems18@gmail.com",
    "favorite_products": [...],
    "peak_spending_quantity": 3,
    "total_orders": 43,
    "days_since_last_order": 30,
    "profile_score": 72.5,
    ...
  }
}
```

**Success Response - Customer Not Recognized (200 OK):**
```json
{
  "success": true,
  "tracked": null,
  "profile": null
}
```

**Error Response (500 Internal Server Error):**
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Error message details"
}
```

#### Processing Flow

1. **Extract IP from Request Headers**
   - Check: X-Forwarded-For, X-Real-IP, CF-Connecting-IP, etc.
   - Hash IP: SHA-256 + salt

2. **Device Recognition (Supabase)**
   - Query device_tracking table
   - Match by: browser_fingerprint OR ip_hash
   - If match → customer_email recognized!

3. **Device Tracking Upsert**
   - If email provided → Upsert device record
   - Update: last_seen, visit_count, ip_hash, geo_data

4. **Profile Sync**
   - Query Supabase customer_intelligence
   - If missing/outdated → Fetch from WordPress
   - Upsert to Supabase

5. **Event Logging (Optional)**
   - Only if event_type provided
   - Only important events (see list above)
   - Insert to behavioral_events table

#### Notes
- Anonymous tracking possible (no email, only fingerprint)
- IP hashing for GDPR compliance
- Multi-device recognition via fingerprint
- Geo-location lookup via ip-api.com
- WordPress is source of truth for profile data

---

### GET `/api/intelligence/bundle`

Get active bundle offer or auto-generate via WordPress if eligible.

**URL:** `http://localhost:3000/api/intelligence/bundle`

#### Request

**Method:** GET  
**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customer_email` | string | Optional | Customer email address |
| `fingerprint` | string | Optional | Browser fingerprint |

**Note:** One of `customer_email` OR `fingerprint` is required.

**Example:**
```http
GET /api/intelligence/bundle?customer_email=jackwullems18@gmail.com
Host: localhost:3000
```

#### Response

**Success Response - Bundle Available (200 OK):**
```json
{
  "success": true,
  "offer_id": "uuid-93...",
  "bundle": [
    {
      "product_id": 44,
      "name": "Full Moon",
      "slug": "full-moon",
      "quantity": 3,
      "unit_price": 14.95,
      "subtotal": 44.85
    }
  ],
  "pricing": {
    "base_price": 74.75,
    "discount_percentage": 14,
    "discount_amount": 10.47,
    "final_price": 64.28
  },
  "bonus_points": 64,
  "customer": {
    "first_name": "Rezgar",
    "last_name": "Kasim",
    "email": "jackwullems18@gmail.com"
  },
  "profile": {
    "total_orders": 43,
    "days_since_last_order": 30,
    "favorite_products": [...]
  }
}
```

**Error Response - No Bundle Available (200 OK):**
```json
{
  "success": false,
  "message": "No active bundle offer found",
  "reason": "not_in_prime_window"
}
```

**Error Response - Customer Not Found (404):**
```json
{
  "success": false,
  "message": "Customer not found"
}
```

**Error Response - Missing Parameters (400):**
```json
{
  "success": false,
  "message": "Email or fingerprint required"
}
```

#### Processing Flow

1. **Find Customer**
   - If email → Direct lookup in Supabase
   - If fingerprint → Find via device_tracking table

2. **Check Existing Bundle (Supabase)**
   - Query bundle_offers table
   - Filter: customer_email + status='pending' + expires_at > NOW()
   - If found → Return bundle (SKIP WordPress)

3. **Generate Bundle (WordPress)**
   - If no bundle → Call WordPress REST API
   - GET `/wp-json/wg/v1/intelligence/bundle?customer_email=xxx`
   - WordPress checks eligibility, generates bundle
   - WordPress syncs to Supabase
   - Return bundle data

4. **Enrich Response**
   - Fetch customer profile from Supabase
   - Add first_name, total_orders, favorite_products
   - Format pricing, bundle items

#### Notes
- Auto-generation happens transparently
- WordPress handles all business logic
- Supabase used for fast data access
- Bundle expires after 7 days
- Returns most recent pending bundle

---

### POST `/api/intelligence/bundle-status-update` ⚠️ DEPRECATED

**Status:** This endpoint is DEPRECATED and should NOT be used.

**Reason:** WordPress REST API (`/intelligence/bundle-status`) is now the preferred method for updating bundle status. WordPress is the source of truth for all customer data.

**Alternative:** Use WordPress REST API endpoint:
```
POST https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle-status
```

---

## Authentication & Security

### WordPress REST API

**Authentication:**
- ✅ **No authentication required** for public endpoints
- ✅ Uses WordPress nonce validation for admin endpoints
- ✅ Rate limiting via WordPress built-in

**Security Measures:**
- IP-based rate limiting (500 requests per hour per IP)
- Input sanitization via `sanitize_text_field()`, `sanitize_email()`
- SQL injection prevention via `$wpdb->prepare()`
- XSS prevention via `esc_html()`, `wp_kses()`

### Next.js API Routes

**Authentication:**
- ✅ **No authentication required** (public data)
- ✅ Server-side validation only
- ✅ No sensitive data exposed

**Security Measures:**
- IP hashing (SHA-256 + salt)
- Fingerprint hashing (SHA-256)
- No PII in error messages
- CORS headers restricted
- Rate limiting via Vercel/Cloudflare

### GDPR Compliance

**IP Address:**
- ✅ SHA-256 hashed with AUTH_KEY salt
- ✅ Original IP never stored
- ✅ One-way hash (not reversible)

**Browser Fingerprint:**
- ✅ SHA-256 hash of device characteristics
- ✅ No PII collected
- ✅ Device/browser data only

**Data Retention:**
- ✅ Device tracking: 365 days (auto-cleanup)
- ✅ Customer profiles: Indefinite (business data)
- ✅ Behavioral events: Indefinite (analytics)

---

## Error Handling

### Standard Error Response Format

All API errors follow this structure:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "error_code_snake_case",
  "details": {
    "field": "Additional context"
  }
}
```

### Common Error Codes

#### WordPress REST API

| Code | Status | Description |
|------|--------|-------------|
| `missing_email` | 400 | customer_email parameter missing |
| `invalid_email` | 400 | Email format invalid |
| `profile_not_found` | 404 | Customer profile doesn't exist |
| `no_orders` | 404 | No completed orders found |
| `no_favorites` | 200 | No favorite products identified |
| `only_excluded` | 200 | Customer only purchased excluded products |
| `peak_too_low` | 200 | Peak spending insufficient for bundle |
| `not_in_prime_window` | 200 | Customer not in buying window |
| `invalid_status` | 400 | Bundle status value invalid |
| `offer_not_found` | 404 | Bundle offer ID doesn't exist |

#### Next.js API Routes

| Code | Status | Description |
|------|--------|-------------|
| `missing_parameters` | 400 | Required parameters missing |
| `customer_not_found` | 404 | Customer not found in database |
| `fingerprint_not_found` | 404 | Fingerprint not recognized |
| `internal_error` | 500 | Server error occurred |

### Error Logging

**WordPress:**
```php
error_log('[WG Intelligence] Error message here');
```
- Logged to WordPress debug.log
- View: `wp-content/debug.log`

**Next.js:**
```typescript
console.error('[API] Error message here');
```
- Logged to Vercel/server logs
- View: Vercel dashboard or terminal

---

## Rate Limiting

### WordPress REST API

**Built-in WordPress Rate Limiting:**
- **Limit**: 500 requests per hour per IP
- **Scope**: All REST API endpoints
- **Response**: 429 Too Many Requests
- **Headers**:
  ```http
  X-RateLimit-Limit: 500
  X-RateLimit-Remaining: 450
  X-RateLimit-Reset: 1698765432
  ```

### Next.js API Routes

**Vercel Rate Limiting (Free Tier):**
- **Limit**: 1000 requests per 10 seconds (global)
- **Response**: 429 Too Many Requests

**Cloudflare (if used):**
- **Limit**: Configurable (e.g., 100 req/min per IP)
- **Response**: 429 Too Many Requests

### Supabase API

**Supabase Rate Limiting (Free Tier):**
- **REST API**: 500 requests per minute
- **Realtime**: 200 concurrent connections
- **Storage**: 2GB bandwidth per month
- **Response**: 429 Too Many Requests

---

## Testing & Development

### cURL Examples

#### WordPress - Get Profile
```bash
curl -X GET "https://wasgeurtje.nl/wp-json/wg/v1/intelligence/profile?customer_email=test@example.com"
```

#### WordPress - Recalculate Profile
```bash
curl -X POST "https://wasgeurtje.nl/wp-json/wg/v1/intelligence/recalculate" \
  -H "Content-Type: application/json" \
  -d '{"customer_email":"test@example.com"}'
```

#### WordPress - Generate Bundle
```bash
curl -X GET "https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle?customer_email=test@example.com"
```

#### WordPress - Update Bundle Status
```bash
curl -X POST "https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle-status" \
  -H "Content-Type: application/json" \
  -d '{
    "offer_id": 93,
    "status": "viewed",
    "customer_email": "test@example.com"
  }'
```

#### Next.js - Track Customer
```bash
curl -X POST "http://localhost:3000/api/intelligence/track-customer" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "fingerprint": "abc123..."
  }'
```

#### Next.js - Get Bundle
```bash
curl -X GET "http://localhost:3000/api/intelligence/bundle?customer_email=test@example.com"
```

### Postman Collection

**Import URL:** (To be created)

### API Playground

**Swagger/OpenAPI:** (To be created)

---

**Einde API Reference Documentatie**

