# 🔍 WordPress vs Next.js Tracking Vergelijking

## **📊 OVERZICHT**

Dit document vergelijkt de **exacte event structuren** tussen de oude WordPress/WooCommerce site en de nieuwe Next.js implementatie om te zorgen dat alle GTM triggers blijven werken.

---

## **✅ EVENT NAMEN VERGELIJKING**

| Event Naam | WordPress | Next.js | Status |
|------------|-----------|---------|--------|
| `page_view` | ✅ | ✅ | ✅ Identiek |
| `view_item` | ✅ | ✅ | ✅ Identiek |
| `add_to_cart` | ✅ | ✅ | ✅ Identiek |
| `begin_checkout` | ✅ | ✅ | ✅ Identiek |
| `purchase` | ✅ | ✅ | ✅ Identiek |

---

## **🔍 GEDETAILLEERDE STRUCTUUR VERGELIJKING**

### **1. begin_checkout Event**

#### **WordPress WooCommerce Structuur:**
```javascript
{
  "event": "begin_checkout",
  "ecommerce": {
    "currency": "EUR",
    "value": 14.95,
    "items": [
      {
        "item_id": 334999,                          // Number format
        "item_name": "Wasparfum – Luxe Aroma",
        "sku": "WSG-WP-LUX-100",                    // ✅ EXTRA
        "price": 14.95,                              // Direct number
        "stocklevel": null,                          // ✅ EXTRA
        "stockstatus": "instock",                    // ✅ EXTRA
        "google_business_vertical": "retail",        // ✅ EXTRA
        "item_category": "wasparfum proefpakket",
        "id": "gla_334999",                          // ✅ EXTRA (GLA prefixed)
        "quantity": 1
      }
    ]
  },
  "gtm.uniqueEventId": 9
}
```

#### **Next.js Implementatie Structuur:**
```javascript
{
  "event": "begin_checkout",
  "ecommerce": {
    "items": [
      {
        "item_id": "1425",                           // String format
        "item_name": "Full Moon",
        "item_brand": "Wasgeurtje",                  // ✅ EXTRA (maar WordPress heeft dit leeg)
        "item_category": "Wasparfum",
        "price": 14.95,                               // Direct number
        "quantity": 2,
        "currency": "EUR"                             // ✅ EXTRA (per item)
      }
    ],
    "currency": "EUR",
    "value": 59.8
  },
  "gtm.uniqueEventId": 3
}
```

---

### **2. add_to_cart Event**

#### **WordPress WooCommerce Structuur:**
```javascript
{
  "0": "event",
  "1": "add_to_cart",
  "2": {
    "send_to": "GLA",
    "ecomm_pagetype": "cart",
    "event_category": "ecommerce",
    "items": [
      {
        "id": "gla_334999",                          // GLA prefixed ID
        "quantity": "1",
        "google_business_vertical": "retail"
      }
    ]
  }
}
```

**⚠️ LET OP:** WordPress gebruikt **gtag()** syntax (array format: `["event", "add_to_cart", {...}]`)

#### **Next.js Implementatie Structuur:**
```javascript
{
  "event": "add_to_cart",
  "ecommerce": {
    "items": [
      {
        "item_id": "1425",
        "item_name": "Full Moon",
        "item_brand": "Wasgeurtje",
        "item_category": "Wasparfum",
        "price": 14.95,
        "quantity": 1,
        "currency": "EUR"
      }
    ],
    "value": 14.95,
    "currency": "EUR"
  },
  "gtm.uniqueEventId": 11
}
```

**⚠️ LET OP:** Next.js gebruikt **GTM dataLayer** syntax (object format)

---

### **3. user_identified Event (Klaviyo)**

#### **WordPress WooCommerce:**
```javascript
// Niet gevonden in WordPress dataLayer
// Waarschijnlijk direct via Klaviyo SDK
```

#### **Next.js Implementatie:**
```javascript
{
  "event": "user_identified",
  "user_id": undefined,
  "user_email_hash": "dGVzdE...",  // Base64 encoded
  "gtm.uniqueEventId": 4
}
```

**✅ NIEUW:** Dit is een extra event in Next.js voor GTM tracking van user identification.

---

## **❌ CRUCIALE VERSCHILLEN**

### **1. Ontbrekende Properties in Next.js** ⚠️

Deze properties bestaan in WordPress maar **ontbreken** in Next.js:

| Property | WordPress Waarde | Next.js Waarde | Impact |
|----------|------------------|----------------|--------|
| `sku` | `"WSG-WP-LUX-100"` | ❌ Ontbreekt | ⚠️ **HOOG** - SKU tracking voor inventory |
| `stockstatus` | `"instock"` | ❌ Ontbreekt | ⚠️ **MEDIUM** - Out-of-stock tracking |
| `google_business_vertical` | `"retail"` | ❌ Ontbreekt | ⚠️ **MEDIUM** - Google Shopping feed |
| `id` (GLA prefixed) | `"gla_334999"` | ❌ Ontbreekt | ⚠️ **HOOG** - Google Ads tracking |

### **2. Extra Properties in Next.js** ✅

Deze properties bestaan in Next.js maar **ontbreken** in WordPress:

| Property | WordPress Waarde | Next.js Waarde | Impact |
|----------|------------------|----------------|--------|
| `item_brand` | `""` (leeg) | `"Wasgeurtje"` | ✅ **GOED** - Betere product tracking |
| `currency` (per item) | ❌ Ontbreekt | `"EUR"` | ✅ **GOED** - Multi-currency support |
| `user_identified` event | ❌ Ontbreekt | ✅ Aanwezig | ✅ **GOED** - Extra tracking point |

### **3. Format Verschillen**

| Aspect | WordPress | Next.js | Impact |
|--------|-----------|---------|--------|
| `item_id` format | Number: `334999` | String: `"1425"` | ⚠️ **MEDIUM** - Type inconsistency |
| `add_to_cart` syntax | gtag() array | dataLayer object | ⚠️ **LAAG** - GTM handles both |
| Event volgorde | Willekeurig | Consistent | ✅ **GOED** - More predictable |

---

## **🔧 AANBEVELINGEN**

### **KRITIEK - MOET GEFIXED WORDEN** 🔴

1. **Toevoegen `sku` property**
   - Huidige situatie: SKU ontbreekt volledig
   - Impact: Product identificatie en inventory tracking werkt niet
   - **Oplossing:** Voeg `sku` toe aan items in `CheckoutTracker`, `CartTracker`, en `useTracking`

2. **Toevoegen `id` met GLA prefix**
   - Huidige situatie: Google Ads tracking ID ontbreekt
   - Impact: Google Shopping feed en conversie tracking werkt niet correct
   - **Oplossing:** Voeg `id: "gla_" + item_id` toe aan alle items

3. **Consistente `item_id` format**
   - Huidige situatie: String in Next.js, Number in WordPress
   - Impact: GTM variabelen kunnen problemen hebben
   - **Oplossing:** Converteer naar Number (of blijf consistent met String)

### **BELANGRIJK - MOET TOEGEVOEGD WORDEN** 🟡

4. **Toevoegen `stockstatus` property**
   - Huidige situatie: Out-of-stock status ontbreekt
   - Impact: Kan geen out-of-stock conversies tracken
   - **Oplossing:** Voeg `stockstatus: "instock"` toe (dynamisch indien mogelijk)

5. **Toevoegen `google_business_vertical` property**
   - Huidige situatie: Google Shopping categorie ontbreekt
   - Impact: Google Shopping feed classificatie werkt niet
   - **Oplossing:** Voeg `google_business_vertical: "retail"` toe

### **OPTIONEEL - NICE TO HAVE** 🟢

6. **Behoud `item_brand`**
   - Huidige situatie: ✅ Al aanwezig in Next.js, ontbreekt in WordPress
   - Impact: Betere product tracking
   - **Actie:** Geen, dit is een verbetering

7. **Behoud per-item `currency`**
   - Huidige situatie: ✅ Al aanwezig in Next.js, ontbreekt in WordPress
   - Impact: Multi-currency support
   - **Actie:** Geen, dit is een verbetering

---

## **✅ WAT AL GOED IS**

- ✅ Event namen zijn **identiek**
- ✅ `ecommerce` object structuur is **consistent**
- ✅ `currency` en `value` op top-level zijn **aanwezig**
- ✅ `items` array formaat is **correct**
- ✅ Core properties (`item_id`, `item_name`, `price`, `quantity`, `item_category`) zijn **aanwezig**
- ✅ GTM `uniqueEventId` wordt automatisch gegenereerd

---

## **📋 ACTIEPLAN**

### **Stap 1: Update `types.ts`** 

Voeg ontbrekende properties toe aan `AnalyticsItem`:

```typescript
export interface AnalyticsItem {
  item_id: string | number;           // Support both formats
  item_name: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  price: number;
  quantity: number;
  currency?: string;
  
  // 🔴 TOEVOEGEN:
  sku?: string;                        // Product SKU
  id?: string;                         // GLA prefixed ID (e.g. "gla_1425")
  stockstatus?: 'instock' | 'outofstock' | 'onbackorder';
  google_business_vertical?: string;   // Usually "retail"
}
```

### **Stap 2: Update Item Conversie Functies**

In **`CheckoutTracker.tsx`**, **`CartTracker.tsx`**, en **`useTracking.ts`**:

```typescript
function convertCartItemToAnalyticsItem(item: CartItem): AnalyticsItem {
  return {
    item_id: item.id,                                    // Keep as string (consistent)
    item_name: item.title,
    item_brand: 'Wasgeurtje',
    item_category: 'Wasparfum',
    price: item.price,
    quantity: item.quantity,
    currency: 'EUR',
    item_variant: item.variant,
    
    // 🔴 TOEVOEGEN:
    sku: item.sku || `WSG-WP-${item.id}`,                // Product SKU (fallback)
    id: `gla_${item.id}`,                                 // GLA prefixed ID
    stockstatus: 'instock',                               // Default (kan dynamisch worden)
    google_business_vertical: 'retail',                   // Default voor shopping
  };
}
```

### **Stap 3: Update `CartContext` (indien nodig)**

Als `sku` beschikbaar is in product data, voeg toe aan `CartItem`:

```typescript
export interface CartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  variant?: string;
  image?: string;
  
  // 🔴 TOEVOEGEN (indien beschikbaar):
  sku?: string;                        // Product SKU
  stockStatus?: 'instock' | 'outofstock' | 'onbackorder';
}
```

### **Stap 4: Test alle events opnieuw**

Na updates, test:
- ✅ `add_to_cart` - Check `sku`, `id` (GLA), `stockstatus`
- ✅ `begin_checkout` - Check alle properties
- ✅ `purchase` - Check alle properties

---

## **🎯 VERWACHT RESULTAAT**

Na deze fixes zal de **Next.js dataLayer** **100% compatible** zijn met de **WordPress GTM configuratie**, en alle bestaande GTM triggers, variabelen, en tags blijven werken zonder aanpassingen.

**Voor:**
```javascript
{
  "item_id": "1425",
  "item_name": "Full Moon",
  "price": 14.95,
  "quantity": 1
}
```

**Na:**
```javascript
{
  "item_id": "1425",
  "item_name": "Full Moon",
  "sku": "WSG-WP-1425",                    // ✅ TOEGEVOEGD
  "price": 14.95,
  "quantity": 1,
  "id": "gla_1425",                        // ✅ TOEGEVOEGD
  "stockstatus": "instock",                // ✅ TOEGEVOEGD
  "google_business_vertical": "retail"     // ✅ TOEGEVOEGD
}
```

---

## **📚 REFERENTIE**

- WordPress dataLayer bron: `wasgeurtje.nl`
- Next.js dataLayer bron: `localhost:3000`
- Test datum: November 3, 2025
- GTM Container: `GTM-5L34BNRM`
- Klaviyo Company ID: `VGLBJh`

---

**Status:** ⚠️ **ACTIE VEREIST** - Ontbrekende properties moeten worden toegevoegd voor volledige GTM compatibility.

