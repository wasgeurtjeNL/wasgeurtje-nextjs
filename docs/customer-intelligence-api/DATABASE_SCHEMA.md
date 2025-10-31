# Customer Intelligence System - Database Schema

**Versie:** 1.0  
**Laatst bijgewerkt:** 30 oktober 2024

---

## 📋 Inhoudsopgave

1. [Database Overview](#database-overview)
2. [Supabase Tables (PostgreSQL)](#supabase-tables-postgresql)
3. [WordPress Tables (MySQL)](#wordpress-tables-mysql)
4. [Table Relationships](#table-relationships)
5. [Common Queries](#common-queries)
6. [Indexes & Performance](#indexes--performance)

---

## Database Overview

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ DUAL DATABASE ARCHITECTURE                                   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ WordPress MySQL (Source of Truth)                            │
│   ├─> wp_wg_customer_intelligence                           │
│   ├─> wp_wg_device_tracking                                 │
│   ├─> wp_wg_bundle_offers                                   │
│   └─> wp_wg_behavioral_events                               │
│                                                               │
│           │ Sync (WordPress → Supabase)                      │
│           ↓                                                   │
│                                                               │
│ Supabase PostgreSQL (Read Optimized)                        │
│   ├─> customer_intelligence                                  │
│   ├─> device_tracking (Direct write from Next.js)           │
│   ├─> bundle_offers                                          │
│   └─> behavioral_events (Direct write from Next.js)         │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Database Responsibilities

**WordPress MySQL:**
- ✅ **Source of Truth**: All customer intelligence data originates here
- ✅ **WooCommerce Integration**: Direct access to order history
- ✅ **Profile Recalculation**: Runs analysis algorithms
- ✅ **Bundle Generation**: Creates personalized offers
- ✅ **Auto-sync**: Pushes updates to Supabase

**Supabase PostgreSQL:**
- ✅ **Real-Time Access**: Fast reads for Next.js frontend
- ✅ **Device Tracking**: Direct writes from Next.js API
- ✅ **Event Logging**: Direct writes from Next.js API
- ✅ **Bundle Retrieval**: Quick lookups for popups
- ✅ **Row Level Security**: Built-in access control

---

## Supabase Tables (PostgreSQL)

### Table: `customer_intelligence`

Customer profile with purchase patterns and predictions.

#### Schema

```sql
CREATE TABLE customer_intelligence (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id INTEGER,
  customer_email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  ip_hash TEXT NOT NULL,
  browser_fingerprint TEXT,
  geo_country TEXT,
  geo_city TEXT,
  favorite_products JSONB,
  peak_spending_quantity INTEGER DEFAULT 0,
  peak_spending_amount DECIMAL(10, 2) DEFAULT 0,
  avg_order_value DECIMAL(10, 2) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  last_order_date TIMESTAMP,
  days_since_last_order INTEGER DEFAULT 0,
  purchase_cycle_days INTEGER DEFAULT 14,
  next_prime_window_start TIMESTAMP,
  next_prime_window_end TIMESTAMP,
  profile_score DECIMAL(5, 2) DEFAULT 0,
  last_recalculated TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_customer_intelligence_email 
  ON customer_intelligence(customer_email);
CREATE INDEX idx_customer_intelligence_fingerprint 
  ON customer_intelligence(browser_fingerprint);
CREATE INDEX idx_customer_intelligence_ip_hash 
  ON customer_intelligence(ip_hash);
```

#### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | INTEGER | WooCommerce customer ID (nullable for guests) |
| `customer_email` | TEXT | Customer email (UNIQUE) |
| `first_name` | TEXT | First name from WooCommerce |
| `last_name` | TEXT | Last name from WooCommerce |
| `ip_hash` | TEXT | SHA-256 hash of most recent IP |
| `browser_fingerprint` | TEXT | SHA-256 hash of device characteristics |
| `geo_country` | TEXT | Country code (e.g., "NL") |
| `geo_city` | TEXT | City name (e.g., "Amsterdam") |
| `favorite_products` | JSONB | Array of favorite product objects |
| `peak_spending_quantity` | INTEGER | Highest item count in single order |
| `peak_spending_amount` | DECIMAL | Highest order total amount |
| `avg_order_value` | DECIMAL | Average order value |
| `total_orders` | INTEGER | Total completed orders |
| `last_order_date` | TIMESTAMP | Date of most recent order |
| `days_since_last_order` | INTEGER | Days since last order |
| `purchase_cycle_days` | INTEGER | Average days between orders |
| `next_prime_window_start` | TIMESTAMP | Predicted buy window start |
| `next_prime_window_end` | TIMESTAMP | Predicted buy window end |
| `profile_score` | DECIMAL | RFM score (0-100) |
| `last_recalculated` | TIMESTAMP | Last profile recalculation |
| `created_at` | TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

#### JSONB Structure: `favorite_products`

```json
[
  {
    "product_id": 44,
    "name": "Full Moon",
    "slug": "full-moon",
    "score": 15,
    "total_quantity": 6,
    "appearances": 3,
    "order_numbers": ["1001", "1045", "1067"],
    "order_details": [
      {
        "order_id": 12345,
        "order_number": "1001",
        "quantity": 2,
        "date": "2024-08-15 10:20:30"
      }
    ]
  }
]
```

---

### Table: `device_tracking`

Multi-device history for customer recognition across devices and networks.

#### Schema

```sql
CREATE TABLE device_tracking (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_email TEXT NOT NULL,
  customer_id INTEGER,
  ip_hash TEXT NOT NULL,
  browser_fingerprint TEXT,
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  visit_count INTEGER DEFAULT 1,
  user_agent TEXT,
  geo_country TEXT,
  geo_city TEXT,
  UNIQUE(browser_fingerprint, customer_email)
);

CREATE INDEX idx_device_tracking_fingerprint 
  ON device_tracking(browser_fingerprint);
CREATE INDEX idx_device_tracking_ip_hash 
  ON device_tracking(ip_hash);
CREATE INDEX idx_device_tracking_email 
  ON device_tracking(customer_email);
CREATE INDEX idx_device_tracking_last_seen 
  ON device_tracking(last_seen DESC);
```

#### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_email` | TEXT | Customer email |
| `customer_id` | INTEGER | WooCommerce customer ID (nullable) |
| `ip_hash` | TEXT | SHA-256 hash of IP address |
| `browser_fingerprint` | TEXT | SHA-256 hash of device |
| `first_seen` | TIMESTAMP | First time device was seen |
| `last_seen` | TIMESTAMP | Most recent access |
| `visit_count` | INTEGER | Number of visits from this device |
| `user_agent` | TEXT | Browser user agent string |
| `geo_country` | TEXT | Country code |
| `geo_city` | TEXT | City name |

#### Unique Constraint

```sql
UNIQUE(browser_fingerprint, customer_email)
```
- One record per device per customer
- Upsert updates `last_seen` and `visit_count`

---

### Table: `bundle_offers`

Personalized bundle offers with pricing and status tracking.

#### Schema

```sql
CREATE TABLE bundle_offers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id INTEGER,
  customer_email TEXT NOT NULL,
  bundle_products JSONB NOT NULL,
  total_quantity INTEGER NOT NULL,
  base_price DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) NOT NULL,
  final_price DECIMAL(10, 2) NOT NULL,
  bonus_points INTEGER DEFAULT 0,
  trigger_reason TEXT,
  cart_snapshot JSONB,
  status TEXT DEFAULT 'pending',
  offered_at TIMESTAMP DEFAULT NOW(),
  viewed_at TIMESTAMP,
  responded_at TIMESTAMP,
  expires_at TIMESTAMP,
  conversion_value DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bundle_offers_email 
  ON bundle_offers(customer_email);
CREATE INDEX idx_bundle_offers_status 
  ON bundle_offers(status);
CREATE INDEX idx_bundle_offers_expires_at 
  ON bundle_offers(expires_at);
```

#### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `customer_id` | INTEGER | WooCommerce customer ID (nullable) |
| `customer_email` | TEXT | Customer email |
| `bundle_products` | JSONB | Array of bundle products |
| `total_quantity` | INTEGER | Total item count in bundle |
| `base_price` | DECIMAL | Original price before discount |
| `discount_amount` | DECIMAL | Total discount amount |
| `final_price` | DECIMAL | Final price after discount |
| `bonus_points` | INTEGER | Loyalty points bonus |
| `trigger_reason` | TEXT | Why bundle was generated (e.g., "prime_window") |
| `cart_snapshot` | JSONB | Cart state when offer generated |
| `status` | TEXT | Current status (see below) |
| `offered_at` | TIMESTAMP | When bundle was created |
| `viewed_at` | TIMESTAMP | When customer viewed popup |
| `responded_at` | TIMESTAMP | When customer accepted/rejected |
| `expires_at` | TIMESTAMP | Expiration date (7 days) |
| `conversion_value` | DECIMAL | Final order value if purchased |
| `created_at` | TIMESTAMP | Record creation |
| `updated_at` | TIMESTAMP | Last update |

#### Status Values

| Status | Description |
|--------|-------------|
| `pending` | Bundle generated, not yet shown |
| `viewed` | Popup displayed to customer |
| `added_to_cart` | Customer accepted offer |
| `purchased` | Order completed with bundle |
| `expired` | Offer expired (7 days) |
| `rejected` | Customer declined offer |

#### JSONB Structure: `bundle_products`

```json
[
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
]
```

---

### Table: `behavioral_events`

Event logging for analytics and behavioral tracking.

#### Schema

```sql
CREATE TABLE behavioral_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id TEXT,
  customer_id INTEGER,
  customer_email TEXT,
  ip_hash TEXT,
  browser_fingerprint TEXT,
  event_type TEXT NOT NULL,
  event_data JSONB,
  page_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_behavioral_events_email 
  ON behavioral_events(customer_email);
CREATE INDEX idx_behavioral_events_type 
  ON behavioral_events(event_type);
CREATE INDEX idx_behavioral_events_created_at 
  ON behavioral_events(created_at DESC);
CREATE INDEX idx_behavioral_events_fingerprint 
  ON behavioral_events(browser_fingerprint);
```

#### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `session_id` | TEXT | Session identifier |
| `customer_id` | INTEGER | WooCommerce customer ID (nullable) |
| `customer_email` | TEXT | Customer email (nullable for anonymous) |
| `ip_hash` | TEXT | SHA-256 hash of IP |
| `browser_fingerprint` | TEXT | SHA-256 hash of device |
| `event_type` | TEXT | Event type (see below) |
| `event_data` | JSONB | Additional event data |
| `page_url` | TEXT | Page where event occurred |
| `created_at` | TIMESTAMP | Event timestamp |

#### Important Event Types

| Event Type | Description | When Logged |
|------------|-------------|-------------|
| `checkout_email_entered` | Email entered in checkout | On blur/submit |
| `bundle_viewed` | Bundle popup shown | Popup mount |
| `bundle_accepted` | Bundle offer accepted | Accept button click |
| `bundle_rejected` | Bundle offer rejected | Reject button click |
| `order_completed` | Order successfully placed | WC order complete |

#### JSONB Structure: `event_data`

```json
{
  "offer_id": 93,
  "status": "viewed",
  "products": [...],
  "cart_value": 45.90,
  "custom_field": "value"
}
```

---

## WordPress Tables (MySQL)

### Table: `wp_wg_customer_intelligence`

Identical structure to Supabase `customer_intelligence` but in MySQL.

#### Schema

```sql
CREATE TABLE wp_wg_customer_intelligence (
  id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT(20) UNSIGNED,
  customer_email VARCHAR(255) NOT NULL,
  ip_hash VARCHAR(64) NOT NULL,
  browser_fingerprint VARCHAR(64),
  geo_country VARCHAR(2),
  geo_city VARCHAR(100),
  favorite_products LONGTEXT,
  peak_spending_quantity INT(11) DEFAULT 0,
  peak_spending_amount DECIMAL(10, 2) DEFAULT 0,
  avg_order_value DECIMAL(10, 2) DEFAULT 0,
  total_orders INT(11) DEFAULT 0,
  last_order_date DATETIME,
  days_since_last_order INT(11) DEFAULT 0,
  purchase_cycle_days INT(11) DEFAULT 14,
  next_prime_window_start DATETIME,
  next_prime_window_end DATETIME,
  profile_score DECIMAL(5, 2) DEFAULT 0,
  last_recalculated DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY customer_email (customer_email),
  KEY idx_fingerprint (browser_fingerprint),
  KEY idx_ip_hash (ip_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Key Differences from Supabase:**
- Uses `BIGINT` auto-increment instead of UUID
- Uses `LONGTEXT` for JSON (pre-MySQL 5.7.8)
- Uses `DATETIME` instead of `TIMESTAMP`

---

### Table: `wp_wg_device_tracking`

Device tracking history in MySQL.

#### Schema

```sql
CREATE TABLE wp_wg_device_tracking (
  id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_email VARCHAR(255) NOT NULL,
  customer_id BIGINT(20) UNSIGNED,
  ip_hash VARCHAR(64) NOT NULL,
  browser_fingerprint VARCHAR(64),
  first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  visit_count INT(11) DEFAULT 1,
  user_agent TEXT,
  geo_country VARCHAR(2),
  geo_city VARCHAR(100),
  KEY idx_email (customer_email),
  KEY idx_fingerprint (browser_fingerprint),
  KEY idx_ip_hash (ip_hash),
  KEY idx_last_seen (last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### Table: `wp_wg_bundle_offers`

Bundle offers in MySQL (source of truth).

#### Schema

```sql
CREATE TABLE wp_wg_bundle_offers (
  id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT(20) UNSIGNED,
  customer_email VARCHAR(255) NOT NULL,
  bundle_products LONGTEXT NOT NULL,
  total_quantity INT(11) NOT NULL,
  base_price DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) NOT NULL,
  final_price DECIMAL(10, 2) NOT NULL,
  bonus_points INT(11) DEFAULT 0,
  trigger_reason VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  offered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  viewed_at DATETIME,
  responded_at DATETIME,
  expires_at DATETIME,
  conversion_value DECIMAL(10, 2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_email (customer_email),
  KEY idx_status (status),
  KEY idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### Table: `wp_wg_behavioral_events`

Event logging in MySQL.

#### Schema

```sql
CREATE TABLE wp_wg_behavioral_events (
  id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255),
  customer_id BIGINT(20) UNSIGNED,
  customer_email VARCHAR(255),
  ip_hash VARCHAR(64),
  browser_fingerprint VARCHAR(64),
  event_type VARCHAR(100) NOT NULL,
  event_data LONGTEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_email (customer_email),
  KEY idx_event_type (event_type),
  KEY idx_timestamp (timestamp),
  KEY idx_fingerprint (browser_fingerprint)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Table Relationships

### Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ CUSTOMER INTELLIGENCE SYSTEM - ER DIAGRAM                         │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────────────┐
│ customer_intelligence       │
│ ─────────────────────────── │
│ PK: id (UUID)              │
│ UK: customer_email         │
│     customer_id            │
│     ip_hash                 │
│     browser_fingerprint     │
│     favorite_products       │
│     ...                     │
└─────────────────────────────┘
        │
        │ 1:N (customer_email)
        ↓
┌─────────────────────────────┐
│ device_tracking             │
│ ─────────────────────────── │
│ PK: id (UUID)              │
│ FK: customer_email         │◄──── Multi-device tracking
│     ip_hash                 │      One customer, many devices
│     browser_fingerprint     │
│     visit_count             │
│     ...                     │
└─────────────────────────────┘

┌─────────────────────────────┐
│ customer_intelligence       │
└─────────────────────────────┘
        │
        │ 1:N (customer_email)
        ↓
┌─────────────────────────────┐
│ bundle_offers               │
│ ─────────────────────────── │
│ PK: id (UUID)              │
│ FK: customer_email         │◄──── Bundle offers
│     bundle_products         │      One customer, many offers
│     status                  │
│     expires_at              │
│     ...                     │
└─────────────────────────────┘

┌─────────────────────────────┐
│ customer_intelligence       │
└─────────────────────────────┘
        │
        │ 1:N (customer_email)
        ↓
┌─────────────────────────────┐
│ behavioral_events           │
│ ─────────────────────────── │
│ PK: id (UUID)              │
│ FK: customer_email         │◄──── Event history
│     event_type              │      One customer, many events
│     event_data              │
│     created_at              │
│     ...                     │
└─────────────────────────────┘
```

### Relationships

1. **customer_intelligence → device_tracking (1:N)**
   - One customer can have multiple devices
   - Relationship: `customer_email`
   - Example: User on laptop + phone + work PC = 3 device records

2. **customer_intelligence → bundle_offers (1:N)**
   - One customer can have multiple bundle offers over time
   - Relationship: `customer_email`
   - Example: Monthly bundle offers = 12 records per year

3. **customer_intelligence → behavioral_events (1:N)**
   - One customer can have many events
   - Relationship: `customer_email`
   - Example: Checkout events, bundle views, etc.

---

## Common Queries

### Customer Recognition Queries

#### Find Customer by Fingerprint or IP

```sql
-- Supabase/PostgreSQL
SELECT customer_email, customer_id, MAX(last_seen) as last_seen
FROM device_tracking
WHERE browser_fingerprint = '990eb8b7...'
   OR ip_hash = 'a3f5d2...'
GROUP BY customer_email, customer_id
ORDER BY last_seen DESC
LIMIT 1;
```

#### Find Customer by Email

```sql
-- Supabase/PostgreSQL
SELECT *
FROM customer_intelligence
WHERE customer_email = 'jackwullems18@gmail.com';
```

---

### Bundle Offer Queries

#### Get Active Bundle for Customer

```sql
-- Supabase/PostgreSQL
SELECT *
FROM bundle_offers
WHERE customer_email = 'jackwullems18@gmail.com'
  AND status = 'pending'
  AND expires_at > NOW()
ORDER BY offered_at DESC
LIMIT 1;
```

#### Get Bundle Conversion Rate

```sql
-- Supabase/PostgreSQL
SELECT 
  COUNT(*) FILTER (WHERE status = 'purchased') AS converted,
  COUNT(*) FILTER (WHERE status IN ('viewed', 'added_to_cart', 'rejected')) AS total,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'purchased')::decimal / 
    COUNT(*) FILTER (WHERE status IN ('viewed', 'added_to_cart', 'rejected')) * 100, 
    2
  ) AS conversion_rate_percent
FROM bundle_offers
WHERE offered_at >= NOW() - INTERVAL '30 days';
```

---

### Behavioral Event Queries

#### Get Recent Events for Customer

```sql
-- Supabase/PostgreSQL
SELECT *
FROM behavioral_events
WHERE customer_email = 'jackwullems18@gmail.com'
ORDER BY created_at DESC
LIMIT 50;
```

#### Count Events by Type (Last 30 Days)

```sql
-- Supabase/PostgreSQL
SELECT 
  event_type,
  COUNT(*) as event_count
FROM behavioral_events
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY event_type
ORDER BY event_count DESC;
```

---

### Device Tracking Queries

#### Get All Devices for Customer

```sql
-- Supabase/PostgreSQL
SELECT *
FROM device_tracking
WHERE customer_email = 'jackwullems18@gmail.com'
ORDER BY last_seen DESC;
```

#### Find Customers Using Same Device

```sql
-- Supabase/PostgreSQL
SELECT 
  customer_email,
  MAX(last_seen) as last_used
FROM device_tracking
WHERE browser_fingerprint = '990eb8b7...'
GROUP BY customer_email
ORDER BY last_used DESC;
```

---

### Analytics Queries

#### Top Customers by Profile Score

```sql
-- Supabase/PostgreSQL
SELECT 
  customer_email,
  profile_score,
  total_orders,
  avg_order_value
FROM customer_intelligence
WHERE total_orders > 0
ORDER BY profile_score DESC
LIMIT 100;
```

#### Customers in Prime Window (Next 7 Days)

```sql
-- Supabase/PostgreSQL
SELECT 
  customer_email,
  total_orders,
  days_since_last_order,
  next_prime_window_start,
  next_prime_window_end
FROM customer_intelligence
WHERE next_prime_window_start BETWEEN NOW() AND NOW() + INTERVAL '7 days'
  AND total_orders >= 3
ORDER BY next_prime_window_start ASC;
```

#### Bundle Acceptance by Discount Tier

```sql
-- Supabase/PostgreSQL
SELECT 
  CASE 
    WHEN discount_amount / base_price * 100 >= 15 THEN '15%+'
    WHEN discount_amount / base_price * 100 >= 10 THEN '10-15%'
    ELSE '< 10%'
  END as discount_tier,
  COUNT(*) FILTER (WHERE status = 'purchased') as accepted,
  COUNT(*) as total,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'purchased')::decimal / COUNT(*) * 100, 
    2
  ) as acceptance_rate
FROM bundle_offers
WHERE status IN ('viewed', 'purchased', 'rejected')
GROUP BY discount_tier
ORDER BY discount_tier;
```

---

## Indexes & Performance

### Index Strategy

#### Customer Intelligence Table

**Indexes:**
```sql
CREATE INDEX idx_customer_intelligence_email 
  ON customer_intelligence(customer_email);
CREATE INDEX idx_customer_intelligence_fingerprint 
  ON customer_intelligence(browser_fingerprint);
CREATE INDEX idx_customer_intelligence_ip_hash 
  ON customer_intelligence(ip_hash);
```

**Use Cases:**
- Email lookup: Primary key for all customer queries
- Fingerprint lookup: Fast device recognition
- IP hash lookup: Fallback recognition method

---

#### Device Tracking Table

**Indexes:**
```sql
CREATE INDEX idx_device_tracking_fingerprint 
  ON device_tracking(browser_fingerprint);
CREATE INDEX idx_device_tracking_ip_hash 
  ON device_tracking(ip_hash);
CREATE INDEX idx_device_tracking_email 
  ON device_tracking(customer_email);
CREATE INDEX idx_device_tracking_last_seen 
  ON device_tracking(last_seen DESC);
```

**Use Cases:**
- Fingerprint/IP lookup: Core recognition logic
- Email lookup: Get all devices for customer
- last_seen DESC: Sort by recency for recognition priority

---

#### Bundle Offers Table

**Indexes:**
```sql
CREATE INDEX idx_bundle_offers_email 
  ON bundle_offers(customer_email);
CREATE INDEX idx_bundle_offers_status 
  ON bundle_offers(status);
CREATE INDEX idx_bundle_offers_expires_at 
  ON bundle_offers(expires_at);
```

**Use Cases:**
- Email lookup: Find active bundle for customer
- Status filtering: Get pending/viewed offers
- Expiration check: Filter expired offers

---

#### Behavioral Events Table

**Indexes:**
```sql
CREATE INDEX idx_behavioral_events_email 
  ON behavioral_events(customer_email);
CREATE INDEX idx_behavioral_events_type 
  ON behavioral_events(event_type);
CREATE INDEX idx_behavioral_events_created_at 
  ON behavioral_events(created_at DESC);
CREATE INDEX idx_behavioral_events_fingerprint 
  ON behavioral_events(browser_fingerprint);
```

**Use Cases:**
- Email lookup: Get customer event history
- Event type filtering: Analytics queries
- Timestamp DESC: Recent events first
- Fingerprint: Anonymous event tracking

---

### Performance Optimization

#### Query Optimization Tips

1. **Use Indexes Effectively**
   - Always filter by indexed columns first
   - Avoid functions on indexed columns
   - Use `EXPLAIN ANALYZE` to check query plans

2. **Limit Result Sets**
   - Use `LIMIT` for pagination
   - Avoid `SELECT *` when specific columns needed
   - Use `OFFSET` carefully (can be slow)

3. **JSONB Queries**
   - Create GIN indexes for JSONB columns if querying frequently:
     ```sql
     CREATE INDEX idx_favorite_products_gin 
       ON customer_intelligence USING GIN (favorite_products);
     ```

4. **Composite Indexes**
   - For multi-column queries:
     ```sql
     CREATE INDEX idx_bundle_offers_email_status 
       ON bundle_offers(customer_email, status);
     ```

5. **Partitioning** (Future)
   - Consider partitioning `behavioral_events` by month
   - Archive old data to reduce table size

---

### Database Maintenance

#### Supabase

**Auto-Vacuum:**
- Enabled by default
- Runs periodically to reclaim space

**Backup:**
- Daily automatic backups (free tier: 7 days retention)
- Manual backups via Supabase dashboard

**Monitoring:**
- Query performance via Supabase dashboard
- Slow query log available

#### WordPress MySQL

**GDPR Cleanup Script:**
```sql
-- Delete inactive devices (365+ days)
DELETE FROM wp_wg_device_tracking
WHERE last_seen < DATE_SUB(NOW(), INTERVAL 365 DAY);
```

**WP-CLI Command:**
```bash
wp eval "WG_Device_Tracker::cleanup_old_devices(365);"
```

---

## Data Migration

### WordPress → Supabase Sync

**Manual Sync (All Profiles):**
```php
// Run in WordPress admin or WP-CLI
global $wpdb;
$table = $wpdb->prefix . 'wg_customer_intelligence';
$profiles = $wpdb->get_results("SELECT * FROM $table");

foreach ($profiles as $profile) {
    WG_Supabase_Sync::sync_profile(
        $profile->customer_email, 
        (array) $profile
    );
}
```

**Bulk Export (CSV):**
```sql
-- Export customer_intelligence to CSV
COPY customer_intelligence 
TO '/tmp/customer_intelligence.csv' 
WITH CSV HEADER;
```

---

**Einde Database Schema Documentatie**

