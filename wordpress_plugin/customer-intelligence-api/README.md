# Customer Intelligence API Plugin

## Installatie

1. Upload de hele `customer-intelligence-api` folder naar `/wp-content/plugins/`
2. Ga naar WordPress Admin → Plugins
3. Activeer "Customer Intelligence API"
4. Tabellen worden automatisch aangemaakt

## Database Tabellen

Na activatie worden deze tabellen aangemaakt:
- `wp_wg_customer_intelligence` - Klant profielen met IP, geo-data, favorieten
- `wp_wg_bundle_offers` - Gepersonaliseerde bundle aanbiedingen
- `wp_wg_behavioral_events` - Sessie tracking en events

## REST API Endpoints

### 1. Track Session (IP + Customer)
```
POST /wp-json/wg/v1/intelligence/track-session
Body: {
  "customer_id": 123,
  "customer_email": "test@example.com",
  "ip_address": "optional - auto-detected if not provided"
}
```

### 2. Recalculate Profile (Analyze Purchase History)
```
POST /wp-json/wg/v1/intelligence/recalculate
Body: {
  "customer_email": "test@example.com",
  "customer_id": 123
}
```

### 3. Get Customer Profile
```
GET /wp-json/wg/v1/intelligence/profile?customer_email=test@example.com
```

### 4. Generate Bundle Suggestion
```
GET /wp-json/wg/v1/intelligence/bundle?customer_email=test@example.com
```

### 5. Get Active Offers
```
GET /wp-json/wg/v1/intelligence/active-offers?customer_email=test@example.com
```

### 6. Update Bundle Status
```
POST /wp-json/wg/v1/intelligence/bundle-status
Body: {
  "offer_id": 1,
  "status": "viewed|added_to_cart|purchased|rejected",
  "conversion_value": 99.99 (optional)
}
```

### 7. Log Event
```
POST /wp-json/wg/v1/intelligence/log-event
Body: {
  "event_type": "cart_update",
  "event_data": {"cart_items": 3},
  "customer_email": "test@example.com"
}
```

## Test Workflow

1. **Track Session:**
   ```bash
   curl -X POST https://wasgeurtje.nl/wp-json/wg/v1/intelligence/track-session \
     -H "Content-Type: application/json" \
     -d '{"customer_email":"jackwullems18@gmail.com"}'
   ```

2. **Recalculate Profile (analyze orders):**
   ```bash
   curl -X POST https://wasgeurtje.nl/wp-json/wg/v1/intelligence/recalculate \
     -H "Content-Type: application/json" \
     -d '{"customer_email":"jackwullems18@gmail.com"}'
   ```

3. **Check Profile in DB:**
   ```sql
   SELECT * FROM wp_wg_customer_intelligence 
   WHERE customer_email = 'jackwullems18@gmail.com';
   ```

4. **Generate Bundle:**
   ```bash
   curl https://wasgeurtje.nl/wp-json/wg/v1/intelligence/bundle?customer_email=jackwullems18@gmail.com
   ```

5. **Check Bundle in DB:**
   ```sql
   SELECT * FROM wp_wg_bundle_offers 
   WHERE customer_email = 'jackwullems18@gmail.com'
   ORDER BY offered_at DESC;
   ```

## Logica Uitleg

### Purchase Pattern Analysis
- Analyseert laatste 2-3 bestellingen
- Excludeert: wasparfum, wasstrips, proefpakket, cadeauset
- Berekent favoriet producten op basis van:
  - Totale quantity per product
  - Aantal keer besteld (appearances)
  - Score = (qty × 2) + (appearances × 3)

### Peak Spending Detection
- Vindt hoogste aantal items ooit besteld
- Bepaalt grootste bestelbedrag
- Target quantity = peak + 1 fles

### Prime Window Calculation
- Berekent gemiddelde dagen tussen bestellingen
- Window start = 80% van purchase cycle
- Window end = 120% van purchase cycle
- Alleen in dit window worden bundles aangeboden

### Bundle Composition
- Neemt top 2 favoriete producten
- Primaire favoriet krijgt 60% van quantity
- Secundaire favoriet krijgt 40%
- Voorbeeld: 7 stuks → 4x primair + 3x secundair

### Dynamic Pricing
- Basis korting op quantity:
  - 7+ items: 15%
  - 5-6 items: 12%
  - 4 items: 10%
- Extra korting voor hoge profile score:
  - Score 80+: +3%
  - Score 60+: +2%
- Maximum korting: 20%

### Loyalty Points Bonus
- Basis: 1 punt per euro
- Multiplier voor goede klanten:
  - Score 80+: 1.5x
  - Score 60+: 1.25x

## GDPR Compliance
- IP adressen worden NOOIT plain-text opgeslagen
- Alleen SHA-256 hash met salt (AUTH_KEY)
- Geo-data wordt gecached voor 7 dagen
- Session data wordt anoniem bijgehouden

## Debugging

Activeer WordPress debug mode:
```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
```

Check logs: `wp-content/debug.log`

