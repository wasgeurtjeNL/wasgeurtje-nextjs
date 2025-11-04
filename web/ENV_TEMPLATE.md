# Environment Variables Template

## 📋 Overzicht

Dit bestand bevat een overzicht van alle benodigde environment variabelen voor de migratie.

## 🔧 Development Setup (.env.local)

Maak een `.env.local` bestand in de `web/` directory met:

```bash
# ============================================
# API CONFIGURATION
# ============================================

# API Base URL
# Development: gebruik de huidige WordPress site
API_BASE_URL=https://wasgeurtje.nl

# ============================================
# WOOCOMMERCE CONFIGURATION
# ============================================

# WooCommerce API URL
WOOCOMMERCE_API_URL=https://wasgeurtje.nl/wp-json/wc/v3

# WooCommerce Consumer Key
WOOCOMMERCE_CONSUMER_KEY=ck_your_consumer_key_here

# WooCommerce Consumer Secret
WOOCOMMERCE_CONSUMER_SECRET=cs_your_consumer_secret_here

# ============================================
# STRIPE CONFIGURATION
# ============================================

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# ============================================
# FACEBOOK PIXEL / META
# ============================================

NEXT_PUBLIC_FACEBOOK_PIXEL_ID=your_pixel_id_here
FACEBOOK_ACCESS_TOKEN=your_access_token_here

# ============================================
# GOOGLE TAG MANAGER
# ============================================

NEXT_PUBLIC_GTM_ID=GTM-XXXXXX

# ============================================
# OTHER
# ============================================

NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 🚀 Production Setup (Vercel)

In Vercel Dashboard → Project Settings → Environment Variables:

```bash
# ============================================
# API CONFIGURATION (BELANGRIJK!)
# ============================================

# Let op: hier gebruik je api.wasgeurtje.nl i.p.v. wasgeurtje.nl
API_BASE_URL=https://api.wasgeurtje.nl

# ============================================
# WOOCOMMERCE CONFIGURATION
# ============================================

WOOCOMMERCE_API_URL=https://api.wasgeurtje.nl/wp-json/wc/v3
WOOCOMMERCE_CONSUMER_KEY=ck_live_your_production_key
WOOCOMMERCE_CONSUMER_SECRET=cs_live_your_production_secret

# ============================================
# STRIPE CONFIGURATION
# ============================================

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key
STRIPE_SECRET_KEY=sk_live_your_live_key
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret

# ============================================
# FACEBOOK PIXEL / META
# ============================================

NEXT_PUBLIC_FACEBOOK_PIXEL_ID=your_live_pixel_id
FACEBOOK_ACCESS_TOKEN=your_live_access_token

# ============================================
# GOOGLE TAG MANAGER
# ============================================

NEXT_PUBLIC_GTM_ID=GTM-XXXXXX

# ============================================
# OTHER
# ============================================

NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://wasgeurtje.nl
```

## 🔑 Waar vind je deze keys?

### WooCommerce Keys
1. Log in op WordPress admin
2. Ga naar WooCommerce → Settings → Advanced → REST API
3. Klik op "Add key"
4. Geef een beschrijving (bijv. "Next.js Frontend")
5. Stel permissions in op "Read/Write"
6. Kopieer de Consumer Key en Consumer Secret

### Stripe Keys
1. Log in op [Stripe Dashboard](https://dashboard.stripe.com)
2. Ga naar Developers → API keys
3. Kopieer de Publishable key en Secret key
4. Voor webhook secret: ga naar Developers → Webhooks

### Facebook Pixel
1. Log in op [Facebook Business Manager](https://business.facebook.com)
2. Ga naar Events Manager
3. Selecteer je Pixel
4. Kopieer de Pixel ID

### Google Tag Manager
1. Log in op [Google Tag Manager](https://tagmanager.google.com)
2. Selecteer je container
3. De Container ID is het GTM-XXXXXX nummer

## ⚠️ Belangrijke Opmerkingen

1. **NOOIT** commit je `.env.local` naar Git
2. `.env.local` wordt automatisch genegeerd door `.gitignore`
3. Gebruik **TEST keys** in development en **LIVE keys** in production
4. In Vercel, zet alle environment variabelen op "Production" environment
5. Na het toevoegen van env vars in Vercel, **redeploy** je project

## 🔄 Migratie Volgorde

### Fase 1: Development (huidige situatie)
```
API_BASE_URL=https://wasgeurtje.nl
```
Je test lokaal en maakt calls naar de bestaande WordPress site.

### Fase 2: Staging/Testing (optioneel)
```
API_BASE_URL=https://staging.wasgeurtje.nl
```
Test met een staging versie van WordPress.

### Fase 3: Production (na migratie)
```
API_BASE_URL=https://api.wasgeurtje.nl
```
Live op Vercel, WordPress backend draait op api subdomain.

## 🧪 Testen

Na het instellen van environment variabelen:

```bash
# Test of variabelen correct geladen worden
npm run dev

# In je code (server-side):
console.log('API Base URL:', process.env.API_BASE_URL);
```

## 📚 Referenties

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

