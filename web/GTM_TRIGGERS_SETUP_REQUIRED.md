# ⚠️ GTM TRIGGERS SETUP REQUIRED

## **🔍 PROBLEEM GEDETECTEERD**

**Datum:** 2025-11-03  
**Test Locatie:** `wasgeurtje-nextjs.vercel.app` (Production)  
**GTM Container:** `GTM-5L34BNRM`  
**Test Tool:** GTM Preview Mode + Tag Assistant

### **Wat werkt ✅:**
- ✅ GTM container laadt correct op Next.js site
- ✅ DataLayer events worden gepusht (`add_to_cart`, `begin_checkout`, etc.)
- ✅ Klaviyo SDK werkt (direct tracking)
- ✅ Next.js tracking implementatie is **100% correct**

### **Wat NIET werkt ❌:**
- ❌ Facebook Pixel tags firen NIET
- ❌ Google Analytics 4 (GA4) tags firen NIET
- ❌ Google Ads conversion tags firen NIET
- ❌ Data Tags firen NIET

---

## **📊 ROOT CAUSE**

**GTM Triggers zijn NIET geconfigureerd in de GTM container!**

**Test Resultaat:**
```yaml
Event: add_to_cart
API Call: dataLayer.push({event: "add_to_cart", ...})  ✅
Tags Fired: None  ❌
Tags NOT Fired: 24 tags  ⚠️
```

**Belangrijk:** Dit betekent dat de **Next.js implementatie PERFECT werkt**, maar de GTM container nog **niet is ingesteld** om op deze events te reageren!

---

## **🚀 OPLOSSING: TRIGGERS INSTELLEN IN GTM**

### **Stap 1: Open GTM Container**

1. Ga naar [tagmanager.google.com](https://tagmanager.google.com)
2. Open container: **GTM-5L34BNRM**
3. Klik op **"Triggers"** in het linkermenu

---

### **Stap 2: Maak Custom Event Triggers**

Voor **ELKE** e-commerce event moet je een trigger aanmaken:

#### **A. Trigger: add_to_cart**

1. Klik **"New Trigger"**
2. Naam: `CE - add_to_cart`
3. Trigger Type: **Custom Event**
4. Event name: `add_to_cart`
5. This trigger fires on: **All Custom Events**
6. **Save**

#### **B. Trigger: begin_checkout**

1. Klik **"New Trigger"**
2. Naam: `CE - begin_checkout`
3. Trigger Type: **Custom Event**
4. Event name: `begin_checkout`
5. This trigger fires on: **All Custom Events**
6. **Save**

#### **C. Trigger: purchase**

1. Klik **"New Trigger"**
2. Naam: `CE - purchase`
3. Trigger Type: **Custom Event**
4. Event name: `purchase`
5. This trigger fires on: **All Custom Events**
6. **Save**

#### **D. Trigger: view_item**

1. Klik **"New Trigger"**
2. Naam: `CE - view_item`
3. Trigger Type: **Custom Event**
4. Event name: `view_item`
5. This trigger fires on: **All Custom Events**
6. **Save**

#### **E. Trigger: user_identified**

1. Klik **"New Trigger"**
2. Naam: `CE - user_identified`
3. Trigger Type: **Custom Event**
4. Event name: `user_identified`
5. This trigger fires on: **All Custom Events**
6. **Save**

---

### **Stap 3: Koppel Triggers aan Tags**

Nu moet je **elke tag** koppelen aan de juiste trigger:

#### **Facebook Pixel Tags:**

1. Open tag: **"FB - add_to_cart"**
2. Sectie **"Triggering"** → klik **"Edit"**
3. Selecteer: **`CE - add_to_cart`**
4. **Save**

5. Open tag: **"FB - initiate_checkout"**
6. Sectie **"Triggering"** → klik **"Edit"**
7. Selecteer: **`CE - begin_checkout`**
8. **Save**

9. Open tag: **"FB - purchase"**
10. Sectie **"Triggering"** → klik **"Edit"**
11. Selecteer: **`CE - purchase`**
12. **Save**

13. Open tag: **"FB - view_content"**
14. Sectie **"Triggering"** → klik **"Edit"**
15. Selecteer: **`CE - view_item`**
16. **Save**

#### **GA4 Tags:**

1. Open tag: **"GA4 - add_to_cart [stape]"**
2. Sectie **"Triggering"** → klik **"Edit"**
3. Selecteer: **`CE - add_to_cart`**
4. **Save**

5. Open tag: **"GA4 - begin_checkout [stape]"**
6. Sectie **"Triggering"** → klik **"Edit"**
7. Selecteer: **`CE - begin_checkout`**
8. **Save**

9. Open tag: **"GA4 - purchase [stape]"**
10. Sectie **"Triggering"** → klik **"Edit"**
11. Selecteer: **`CE - purchase`**
12. **Save**

13. Open tag: **"GA4 - view_item [stape]"**
14. Sectie **"Triggering"** → klik **"Edit"**
15. Selecteer: **`CE - view_item`**
16. **Save**

#### **Data Tags:**

Herhaal hetzelfde proces voor:
- **"DT - add_to_cart"** → trigger: `CE - add_to_cart`
- **"DT - begin_checkout"** → trigger: `CE - begin_checkout`
- **"DT - purchase"** → trigger: `CE - purchase`
- **"DT - view_item"** → trigger: `CE - view_item`

---

### **Stap 4: Publiceer Container**

1. Klik rechtsboven op **"Submit"**
2. Version Name: `E-commerce Tracking Setup`
3. Version Description: `Added triggers for add_to_cart, begin_checkout, purchase, view_item events`
4. Klik **"Publish"**

---

### **Stap 5: Test Opnieuw**

Na publicatie:

1. Open **GTM Preview Mode**
2. Voeg een product toe aan cart
3. Controleer in Tag Assistant:
   - ✅ `add_to_cart` event fired
   - ✅ **FB - add_to_cart** tag fired
   - ✅ **GA4 - add_to_cart** tag fired

---

## **📝 COMPLETE TAG → TRIGGER MAPPING**

| Tag Name | Tag Type | Trigger Event |
|----------|----------|---------------|
| FB - add_to_cart | Facebook Pixel | `add_to_cart` |
| FB - initiate_checkout | Facebook Pixel | `begin_checkout` |
| FB - purchase | Facebook Pixel | `purchase` |
| FB - view_content | Facebook Pixel | `view_item` |
| FB - page_view | Facebook Pixel | `gtm.js` (All Pages) |
| FB - lead | Facebook Pixel | `user_identified` |
| GA4 - add_to_cart [stape] | GA4 Event | `add_to_cart` |
| GA4 - begin_checkout [stape] | GA4 Event | `begin_checkout` |
| GA4 - purchase [stape] | GA4 Event | `purchase` |
| GA4 - view_item [stape] | GA4 Event | `view_item` |
| GA4 - page_view [stape] | GA4 Event | `gtm.js` (All Pages) |
| GA4 - generate_lead [stape] | GA4 Event | `user_identified` |
| DT - add_to_cart | Data Tag | `add_to_cart` |
| DT - begin_checkout | Data Tag | `begin_checkout` |
| DT - purchase | Data Tag | `purchase` |
| DT - view_item | Data Tag | `view_item` |

---

## **🎯 VERWACHTE RESULTAAT**

Na het instellen van de triggers zou je in Tag Assistant moeten zien:

### **Bij `add_to_cart` event:**
```yaml
Event: add_to_cart
Tags Fired:
  ✅ FB - add_to_cart (Facebook Pixel)
  ✅ GA4 - add_to_cart [stape] (GA4 Event)
  ✅ DT - add_to_cart (Data Tag)
```

### **Bij `begin_checkout` event:**
```yaml
Event: begin_checkout
Tags Fired:
  ✅ FB - initiate_checkout (Facebook Pixel)
  ✅ GA4 - begin_checkout [stape] (GA4 Event)
  ✅ DT - begin_checkout (Data Tag)
```

### **Bij `purchase` event:**
```yaml
Event: purchase
Tags Fired:
  ✅ FB - purchase (Facebook Pixel)
  ✅ GA4 - purchase [stape] (GA4 Event)
  ✅ DT - purchase (Data Tag)
```

---

## **🔧 WAAROM GEBEURDE DIT?**

De GTM container (`GTM-5L34BNRM`) is waarschijnlijk:
1. **Geïmporteerd** van een andere website
2. **Gedupliceerd** zonder triggers
3. **Nieuw aangemaakt** met alleen tags maar zonder triggers

Tags werken ALLEEN als ze gekoppeld zijn aan **triggers**! Een tag zonder trigger fir't NOOIT.

---

## **✅ NEXT.JS IMPLEMENTATIE IS PERFECT!**

**Belangrijk:** De Next.js tracking implementatie die we hebben gebouwd is **100% correct**:

✅ DataLayer events worden correct gepusht  
✅ Event structuur is WordPress GTM-compatible  
✅ Klaviyo SDK tracking werkt (direct)  
✅ Event properties (sku, id, stockstatus, etc.) zijn compleet  

**Het enige dat ontbreekt is GTM trigger configuratie in de container zelf!**

---

## **📞 SUPPORT**

Als je hulp nodig hebt bij het instellen van de triggers, neem dan contact op met je GTM specialist of digital marketing team.

**Geschatte tijd voor setup:** 30-45 minuten  
**Moeilijkheidsgraad:** Gemiddeld (vereist GTM kennis)

---

**Document aangemaakt:** 2025-11-03  
**Laatste update:** 2025-11-03  
**Status:** ⚠️ GTM triggers vereist voor volledige functionaliteit

