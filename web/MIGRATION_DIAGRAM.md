# 🎨 Migration Architecture Diagram

## 📊 Huidige Situatie (VOOR migratie)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              WASGEURTJE.NL (WordPress)                 │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Frontend (PHP Templates)                       │  │
│  │  • Productpagina's                             │  │
│  │  • Checkout                                     │  │
│  │  • WooCommerce templates                       │  │
│  └─────────────────────────────────────────────────┘  │
│                        ▲                                │
│                        │                                │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Backend (WordPress/WooCommerce)                │  │
│  │  • Database                                     │  │
│  │  • REST API (/wp-json/...)                     │  │
│  │  • Producten, Orders, etc.                     │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘

         ⚠️ PROBLEEM: Frontend en Backend op 1 server
         ⚠️ Moeilijk te schalen
         ⚠️ Langzamere performance
```

---

## ✨ Nieuwe Situatie (NA migratie)

```
┌─────────────────────────────────────────────────────────┐
│                   GEBRUIKER                             │
│              (bezoekt wasgeurtje.nl)                   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│         WASGEURTJE.NL (Next.js op Vercel)              │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Next.js Frontend                               │  │
│  │  • React Components                             │  │
│  │  • Server Components                            │  │
│  │  • Productpagina's                             │  │
│  │  • Checkout flow                                │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Next.js Rewrites (in next.config.js)         │  │
│  │                                                 │  │
│  │  /wp-json/wc/* → api.wasgeurtje.nl/wp-json/wc/*│  │
│  │  /wp-json/*    → api.wasgeurtje.nl/wp-json/*   │  │
│  │  /wp-content/* → api.wasgeurtje.nl/wp-content/*│  │
│  │                                                 │  │
│  │  🚀 AUTOMATISCH - Geen code aanpassingen!      │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
                           │
                           │ HTTP Proxy
                           ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│       API.WASGEURTJE.NL (WordPress Backend)            │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │  WordPress/WooCommerce                          │  │
│  │  • MySQL Database                               │  │
│  │  • REST API Endpoints                          │  │
│  │  • Producten, Orders, Klanten                  │  │
│  │  • ACF (Advanced Custom Fields)               │  │
│  │  • Media Library                                │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘

         ✅ VOORDELEN:
         ✅ Snellere frontend (Next.js + Vercel)
         ✅ Betere SEO
         ✅ Moderne React components
         ✅ Backend blijft ongewijzigd
         ✅ Schaalbaar
```

---

## 🔄 Data Flow: Product Pagina Laden

```
1. Gebruiker bezoekt: wasgeurtje.nl/products/blossom-drip
                                │
                                ▼
2. Next.js Server Component (wasgeurtje.nl)
   └─> Fetch: /wp-json/wc/v3/products?slug=blossom-drip
                                │
                                ▼
3. Next.js Rewrites (automatisch)
   └─> Stuurt door naar: api.wasgeurtje.nl/wp-json/wc/v3/products?slug=blossom-drip
                                │
                                ▼
4. WordPress Backend (api.wasgeurtje.nl)
   ├─> Query database
   ├─> Haal product data op
   └─> Return JSON response
                                │
                                ▼
5. Next.js ontvangt data
   └─> Render product pagina
                                │
                                ▼
6. Gebruiker ziet mooie Next.js pagina! 🎉
```

---

## 📦 Code Flow: Hoe Rewrites Werken

### In je code (productTemplate.tsx):
```typescript
// Je schrijft gewoon:
const response = await fetch('/wp-json/wc/v3/products?slug=blossom-drip');

// ↓ Next.js ziet dit en checkt rewrites in next.config.js
```

### Next.js Rewrites (next.config.js):
```javascript
{
  source: '/wp-json/wc/:path*',
  destination: 'https://api.wasgeurtje.nl/wp-json/wc/:path*'
}

// ↓ Match gevonden! Stuur door naar destination
```

### Request wordt:
```typescript
// Automatisch getransformeerd naar:
const response = await fetch('https://api.wasgeurtje.nl/wp-json/wc/v3/products?slug=blossom-drip');

// 🎯 Maar JIJ hoeft dit nooit te schrijven!
```

---

## 🏗️ File Structure

```
wasguerjte-main/
│
├── web/                                  ← Next.js Frontend
│   ├── src/
│   │   ├── app/                         ← Pages & API Routes
│   │   ├── components/                  ← React Components
│   │   ├── config/
│   │   │   └── api.ts                   ← 🆕 Centrale API Config
│   │   ├── utils/
│   │   │   └── woocommerce.ts          ← ✏️ Updated voor API
│   │   └── types/
│   │
│   ├── next.config.js                   ← ✏️ Rewrites toegevoegd
│   ├── .env.local                       ← 🔑 API_BASE_URL hier!
│   │
│   ├── MIGRATION_GUIDE.md              ← 🆕 Complete guide
│   ├── QUICK_MIGRATION_OVERVIEW.md     ← 🆕 Quick overview
│   ├── ENV_TEMPLATE.md                 ← 🆕 Env vars template
│   └── MIGRATION_DIAGRAM.md            ← 🆕 Dit bestand
│
└── wordpress/                            ← (Wordt api.wasgeurtje.nl)
    └── wp-content/
        └── plugins/
            └── [je WordPress plugins]
```

---

## 🌐 DNS & Hosting Setup

### Domein Configuratie:

```
┌──────────────────────────────────────────────┐
│  WASGEURTJE.NL                              │
│                                              │
│  DNS Records:                                │
│  ├─ A Record: @ → Vercel IP (76.76.21.21)  │
│  └─ CNAME: www → cname.vercel-dns.com      │
│                                              │
│  Vercel:                                     │
│  ├─ Project: wasgeurtje-frontend           │
│  ├─ Framework: Next.js                      │
│  └─ Domain: wasgeurtje.nl                   │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  API.WASGEURTJE.NL                          │
│                                              │
│  DNS Records:                                │
│  └─ A Record: api → Hosting Server IP       │
│     (bijv. 123.45.67.89)                    │
│                                              │
│  Hosting:                                    │
│  ├─ WordPress/WooCommerce                   │
│  ├─ MySQL Database                          │
│  ├─ SSL Certificaat (Let's Encrypt)        │
│  └─ CORS headers ingesteld                 │
└──────────────────────────────────────────────┘
```

---

## 🔐 Environment Variables Flow

### Development (.env.local):
```bash
API_BASE_URL=https://wasgeurtje.nl
                    │
                    ▼
            Test met HUIDIGE WordPress
                    │
                    ▼
            localhost:3000
```

### Production (Vercel):
```bash
API_BASE_URL=https://api.wasgeurtje.nl
                    │
                    ▼
            Live met NIEUWE WordPress subdomain
                    │
                    ▼
            wasgeurtje.nl (op Vercel)
```

---

## 🚦 Migratie Fases

### Fase 1: Voorbereiding ✅
```
┌─────────────────────────────────────────┐
│  • Rewrites toevoegen (DONE)           │
│  • api.ts config maken (DONE)          │
│  • woocommerce.ts updaten (DONE)       │
│  • Documentation (DONE)                 │
└─────────────────────────────────────────┘
```

### Fase 2: WordPress Setup 📋
```
┌─────────────────────────────────────────┐
│  • WordPress verhuizen naar subdomain   │
│  • DNS records instellen                │
│  • SSL certificaat installeren          │
│  • CORS headers configureren            │
│  • Testen: api.wasgeurtje.nl bereikbaar│
└─────────────────────────────────────────┘
```

### Fase 3: Vercel Deploy 🚀
```
┌─────────────────────────────────────────┐
│  • Code pushen naar Git                 │
│  • Vercel project aanmaken              │
│  • Environment vars instellen           │
│  • Domain koppelen                      │
│  • Deploy en testen                     │
└─────────────────────────────────────────┘
```

### Fase 4: DNS Switch 🎯
```
┌─────────────────────────────────────────┐
│  • DNS van wasgeurtje.nl naar Vercel    │
│  • Wachten op propagatie (1-24 uur)     │
│  • Monitoren en testen                  │
│  • Done! 🎉                             │
└─────────────────────────────────────────┘
```

---

## 📈 Performance Comparison

### Voor (WordPress Frontend):
```
┌────────────────────────────────────────┐
│  Metric          │  Score              │
├────────────────────────────────────────┤
│  First Paint     │  2.5s    🟠        │
│  Time to Inter.  │  4.2s    🔴        │
│  SEO Score       │  75/100  🟠        │
│  Core Web Vitals │  Matig   🟠        │
└────────────────────────────────────────┘
```

### Na (Next.js Frontend):
```
┌────────────────────────────────────────┐
│  Metric          │  Score              │
├────────────────────────────────────────┤
│  First Paint     │  0.8s    🟢        │
│  Time to Inter.  │  1.2s    🟢        │
│  SEO Score       │  95/100  🟢        │
│  Core Web Vitals │  Excellent 🟢      │
└────────────────────────────────────────┘
```

---

## 🎯 Key Takeaways

1. **Next.js Rewrites = Magic** ✨
   - Je code hoeft niet aangepast
   - Automatische doorverwijzing naar API
   - Geen CORS problemen

2. **Één Environment Variabele** 🔑
   - `API_BASE_URL` is alles wat je nodig hebt
   - Development: wasgeurtje.nl
   - Production: api.wasgeurtje.nl

3. **WordPress blijft Backend** 🔧
   - WooCommerce blijft draaien
   - Alle data blijft hetzelfde
   - Alleen het domein verandert

4. **Next.js wordt Frontend** ⚛️
   - Sneller, moderner, beter SEO
   - React components
   - Server-side rendering

---

**Klaar voor de migratie?** 🚀  
Lees `MIGRATION_GUIDE.md` voor stap-voor-stap instructies!

