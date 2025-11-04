# ⚡ Quick Migration Overview

## 🎯 Wat is het probleem?

Je hebt veel endpoints zoals:
```
wasgeurtje.nl/wp-json/wc/v3/products
wasgeurtje.nl/wp-json/acf/v3/product/123
wasgeurtje.nl/wp-content/uploads/image.jpg
```

Deze moeten worden:
```
api.wasgeurtje.nl/wp-json/wc/v3/products
api.wasgeurtje.nl/wp-json/acf/v3/product/123
api.wasgeurtje.nl/wp-content/uploads/image.jpg
```

**Probleem**: Je wilt niet overal handmatig endpoints aanpassen! 😱

## ✅ De Oplossing: Next.js Rewrites

**Met Next.js rewrites hoef je GEEN ENKELE regel code aan te passen!**

### Hoe werkt het?

1. **Je code blijft simpel:**
   ```typescript
   fetch('/wp-json/wc/v3/products')  // ← geen domein nodig!
   ```

2. **Next.js stuurt automatisch door:**
   ```javascript
   // In next.config.js (AL GEDAAN ✅)
   {
     source: '/wp-json/wc/:path*',
     destination: 'https://api.wasgeurtje.nl/wp-json/wc/:path*'
   }
   ```

3. **Resultaat:**
   - Development: calls gaan naar `wasgeurtje.nl`
   - Production: calls gaan naar `api.wasgeurtje.nl`
   - Je code hoeft niet aangepast! 🎉

## 📁 Wat is er al gedaan?

### ✅ Bestanden toegevoegd/aangepast:

1. **`next.config.js`** - Rewrites toegevoegd
   - Stuurt automatisch alle `/wp-json/*` calls door naar API backend
   - Stuurt `/wp-content/uploads/*` door voor images

2. **`src/config/api.ts`** - Centrale API configuratie (NIEUW)
   - `getServerApiBaseUrl()` - Voor server-side calls
   - `getClientApiBaseUrl()` - Voor client-side calls  
   - `API_ENDPOINTS` - Object met alle endpoints
   - `WOOCOMMERCE_CONFIG` - WooCommerce specifieke config

3. **`src/utils/woocommerce.ts`** - Aangepast
   - Gebruikt nu centrale `api.ts` configuratie
   - Geen hardcoded URLs meer

4. **`MIGRATION_GUIDE.md`** - Complete guide (NIEUW)
   - Stap-voor-stap instructies
   - Troubleshooting
   - Checklist

5. **`ENV_TEMPLATE.md`** - Environment variabelen template (NIEUW)
   - Development setup
   - Production setup
   - Waar je keys kunt vinden

## 🚀 Wat moet je nog doen?

### Stap 1: Environment variabele instellen

**Development** (lokaal):
```bash
# In web/.env.local
API_BASE_URL=https://wasgeurtje.nl
```

**Production** (Vercel):
```bash
# In Vercel Dashboard → Environment Variables
API_BASE_URL=https://api.wasgeurtje.nl
```

### Stap 2: WordPress verhuizen naar api.wasgeurtje.nl

1. Verhuiz je WordPress installatie naar een subdomain
2. Update DNS records voor `api.wasgeurtje.nl`
3. Installeer SSL certificaat
4. Stel CORS headers in (zie MIGRATION_GUIDE.md)

### Stap 3: Deploy naar Vercel

1. Push code naar GitHub
2. Koppel repository aan Vercel
3. Voeg environment variabelen toe
4. Deploy! 🎉

## 🔑 Belangrijkste voordelen

| Kenmerk | Voor | Na |
|---------|------|-----|
| **Endpoints aanpassen** | 100+ plekken | 1 plek (next.config.js) |
| **Code complexiteit** | Hoog | Laag |
| **Flexibiliteit** | Moeilijk te wijzigen | Makkelijk te wijzigen |
| **CORS problemen** | Ja | Nee (proxied door Next.js) |
| **Type safety** | Nee | Ja (TypeScript) |

## 📊 Vergelijking Methodes

### ❌ Methode 1: Overal vervangen
```typescript
// 100+ plekken aanpassen 😱
fetch('https://api.wasgeurtje.nl/wp-json/wc/v3/products')
```

### ❌ Methode 2: Env vars overal
```typescript
// Nog steeds veel werk 😕
fetch(`${process.env.API_BASE_URL}/wp-json/wc/v3/products`)
```

### ✅ Methode 3: Next.js Rewrites (Onze oplossing!)
```typescript
// Clean, simpel, werkt overal! 🎉
fetch('/wp-json/wc/v3/products')
```

## 🎯 Samenvatting

**Je hoeft niks aan je code te doen!** ✨

De rewrites in `next.config.js` zorgen ervoor dat:
- Alle `/wp-json/*` calls automatisch naar `api.wasgeurtje.nl` gaan
- Je code clean en simpel blijft
- Je makkelijk kunt switchen tussen environments
- Geen CORS problemen ontstaan

**Volgende stap**: Lees `MIGRATION_GUIDE.md` voor de complete implementatie.

---

**Vragen?** Check de MIGRATION_GUIDE.md of ENV_TEMPLATE.md! 📚

