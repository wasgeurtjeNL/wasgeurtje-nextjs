# WooCommerce Phone Lookup API - Installatie Instructies

## 🚀 Wat doet deze plugin?

Deze plugin voegt een **super snelle** REST API endpoint toe die orders kan zoeken op telefoonnummer via **directe SQL queries** in plaats van de trage WooCommerce REST API.

**Performance verschil:**
- ❌ **Oude methode**: 200+ orders ophalen via REST API (~3-5 seconden)
- ✅ **Nieuwe methode**: Direct SQL query op `_billing_phone` meta_key (~0.1 seconden)

## 📋 Installatie Stappen

### 1. Upload de Plugin

**Via FTP/File Manager:**
```bash
1. Ga naar: wp-content/plugins/
2. Upload: phone-lookup-api.php
```

**Via WordPress Admin:**
```bash
1. Ga naar: Plugins > Add New > Upload Plugin
2. Upload: phone-lookup-api.php
3. Klik op: Install Now
```

### 2. Activeer de Plugin

1. Ga naar **Plugins** in WordPress admin
2. Zoek naar: **WooCommerce Phone Lookup API**
3. Klik op: **Activate**

### 3. Test de Plugin

Open in je browser:
```
https://wasgeurtje.nl/wp-json/custom/v1/orders-by-phone?phone=0618993614
```

**Verwacht resultaat (als telefoon gevonden):**
```json
{
  "found": true,
  "order": {
    "orderId": 304434,
    "orderDate": "2024-07-12 10:30:00",
    "billing": {
      "firstName": "Naam",
      "lastName": "Achternaam",
      "phone": "+31 6 18993614",
      "email": "jack@example.com",
      "address1": "jouw adres",
      "address2": "",
      "city": "Almere",
      "postcode": "1343 AS",
      "country": "NL",
      "fullAddress": "Smientlaan 12"
    }
  }
}
```

**Als telefoon NIET gevonden:**
```json
{
  "found": false,
  "order": null
}
```

## 🔍 SQL Query Details

De plugin gebruikt deze efficiënte query:

```sql
SELECT 
    p.ID as order_id,
    p.post_date as order_date,
    MAX(CASE WHEN pm.meta_key = '_billing_phone' THEN pm.meta_value END) as billing_phone,
    MAX(CASE WHEN pm.meta_key = '_billing_first_name' THEN pm.meta_value END) as billing_first_name,
    -- ... andere billing velden ...
FROM wp_posts p
INNER JOIN wp_postmeta pm ON p.ID = pm.post_id
WHERE p.post_type = 'shop_order'
    AND p.post_status IN ('wc-completed', 'wc-processing', 'wc-on-hold', 'wc-pending')
    AND pm.meta_key = '_billing_phone'
GROUP BY p.ID, p.post_date
HAVING billing_phone LIKE '%0618993614%'
ORDER BY p.post_date DESC
LIMIT 10
```

## 🧪 Testen

### Test 1: Bekende klant
```bash
curl "https://wasgeurtje.nl/wp-json/custom/v1/orders-by-phone?phone=0618993614"
```

### Test 2: Onbekend nummer
```bash
curl "https://wasgeurtje.nl/wp-json/custom/v1/orders-by-phone?phone=0699999999"
```

### Test 3: Verschillende formaten
```bash
# Deze moeten allemaal hetzelfde order vinden:
curl "https://wasgeurtje.nl/wp-json/custom/v1/orders-by-phone?phone=0618993614"
curl "https://wasgeurtje.nl/wp-json/custom/v1/orders-by-phone?phone=%2B31618993614"  # +31
curl "https://wasgeurtje.nl/wp-json/custom/v1/orders-by-phone?phone=06%2018993614"  # met spaties
```

## 🔐 Beveiliging

- ✅ Endpoint is **read-only** (geen data modificatie mogelijk)
- ✅ Gebruikt **prepared statements** (SQL injection veilig)
- ✅ Alleen completed/processing orders (geen draft orders)
- ✅ Limiet van 10 orders per zoekopdracht
- ⚠️ **Publiek toegankelijk** - overweeg authentication toe te voegen voor productie

## 📊 Server Logs

De plugin logt alle lookups naar WordPress error log:

```
Phone lookup for: 0618993614 (normalized: 0618993614)
Found 1 orders
Comparing: '0618993614' vs '0618993614'
Match found: Order #304434
```

**Logs bekijken:**
```bash
# Via WP-CLI
wp log show

# Via FTP
/wp-content/debug.log
```

## ⚡ Performance Tips

1. **Database Index**: Voeg een index toe aan `meta_key` voor snellere queries:
```sql
ALTER TABLE wp_postmeta ADD INDEX idx_meta_key_value (meta_key, meta_value(20));
```

2. **Object Caching**: Gebruik Redis/Memcached voor nog betere performance

3. **CDN**: Cache de API responses met Cloudflare (TTL: 60 seconden)

## 🐛 Troubleshooting

### Error: "404 Not Found"
- ✅ Check of plugin geactiveerd is
- ✅ Flush permalinks: Settings > Permalinks > Save Changes

### Error: "No orders found"
- ✅ Check of telefoonnummer correct is
- ✅ Check of er daadwerkelijk orders zijn met dat nummer
- ✅ Bekijk server logs voor details

### Error: "Database error"
- ✅ Check database credentials
- ✅ Check of WooCommerce correct geïnstalleerd is
- ✅ Check WordPress error log

## 📞 Contact

Voor vragen of problemen, check de WordPress error logs of neem contact op met de developer.

