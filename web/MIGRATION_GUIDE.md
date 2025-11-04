# 🚀 Migratie Guide: WordPress naar Next.js Frontend + API Backend

## 📋 Overzicht

Deze guide beschrijft hoe je efficiënt kunt migreren van:
- **OUD**: wasgeurtje.nl (WordPress/WooCommerce op één domein)
- **NIEUW**: 
  - wasgeurtje.nl (Next.js frontend op Vercel)
  - api.wasgeurtje.nl (WordPress/WooCommerce backend)

## 🎯 Voordelen van deze aanpak

✅ **GEEN code hoeft aangepast** - rewrites in `next.config.js` doen het werk  
✅ **Flexibel** - eenvoudig switchen tussen development en production  
✅ **Backwards compatible** - oude endpoints blijven werken  
✅ **Gecentraliseerd** - één plek om API configuratie te beheren  
✅ **Type-safe** - TypeScript support voor alle endpoints  

## 🏗️ Architectuur

### Hoe werkt het?

```
┌─────────────────────────────────────────────────────────┐
│  Browser (gebruiker bezoekt wasgeurtje.nl)             │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Next.js Frontend (Vercel: wasgeurtje.nl)              │
│                                                         │
│  Code maakt call naar: /wp-json/wc/v3/products         │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Next.js Rewrites (automatisch in next.config.js)      │
│                                                         │
│  /wp-json/* → api.wasgeurtje.nl/wp-json/*             │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  WordPress Backend (api.wasgeurtje.nl)                 │
│                                                         │
│  Verwerkt request en stuurt data terug                 │
└─────────────────────────────────────────────────────────┘
```

### Rewrites in Next.js

Next.js rewrites zijn als een **invisible proxy**:
- Code gebruikt `/wp-json/...` (relative URLs)
- Next.js stuurt deze automatisch door naar `api.wasgeurtje.nl/wp-json/...`
- De gebruiker ziet alleen `wasgeurtje.nl` in de browser
- **GEEN CORS problemen** omdat het door Next.js wordt geproxied

## 📦 Wat is er al geïmplementeerd?

### 1. **next.config.js** - Rewrites configuratie

```javascript
async rewrites() {
  const apiBaseUrl = process.env.API_BASE_URL || 'https://api.wasgeurtje.nl';
  
  return [
    // WooCommerce API
    { source: '/wp-json/wc/:path*', destination: `${apiBaseUrl}/wp-json/wc/:path*` },
    // WordPress REST API
    { source: '/wp-json/:path*', destination: `${apiBaseUrl}/wp-json/:path*` },
    // ACF API
    { source: '/wp-json/acf/:path*', destination: `${apiBaseUrl}/wp-json/acf/:path*` },
    // WordPress uploads (images)
    { source: '/wp-content/uploads/:path*', destination: `${apiBaseUrl}/wp-content/uploads/:path*` },
  ];
}
```

### 2. **src/config/api.ts** - Centrale API configuratie

Dit bestand bevat alle API endpoints en helper functies:
- `getServerApiBaseUrl()` - Voor server-side calls
- `getClientApiBaseUrl()` - Voor client-side calls (gebruikt rewrites)
- `API_ENDPOINTS` - Object met alle endpoints
- `buildApiUrl()` - Helper om URLs te bouwen

### 3. **src/utils/woocommerce.ts** - Updated om centrale config te gebruiken

Gebruikt nu `WOOCOMMERCE_CONFIG` en `getServerApiBaseUrl()` uit de centrale config.

## 🔧 Setup Stappen

### Stap 1: Environment Variabelen instellen

#### **Development** (.env.local)
```bash
# Development gebruikt nog de oude WordPress site
API_BASE_URL=https://wasgeurtje.nl
WOOCOMMERCE_API_URL=https://wasgeurtje.nl/wp-json/wc/v3
WOOCOMMERCE_CONSUMER_KEY=your_key_here
WOOCOMMERCE_CONSUMER_SECRET=your_secret_here
```

#### **Production** (Vercel Environment Variables)
```bash
# Production gebruikt de nieuwe API subdomain
API_BASE_URL=https://api.wasgeurtje.nl
WOOCOMMERCE_API_URL=https://api.wasgeurtje.nl/wp-json/wc/v3
WOOCOMMERCE_CONSUMER_KEY=your_key_here
WOOCOMMERCE_CONSUMER_SECRET=your_secret_here
```

### Stap 2: WordPress Backend voorbereiden op api.wasgeurtje.nl

1. **Verhuiz WordPress naar api.wasgeurtje.nl**
   - Gebruik een plugin zoals "All-in-One WP Migration" of "Duplicator"
   - Of maak handmatig een database dump en zet de files over

2. **Update WordPress siteurl**
   ```sql
   UPDATE wp_options SET option_value = 'https://api.wasgeurtje.nl' 
   WHERE option_name IN ('siteurl', 'home');
   ```

3. **CORS headers instellen** (in .htaccess of wp-config.php)
   ```apache
   # In .htaccess
   <IfModule mod_headers.c>
       Header set Access-Control-Allow-Origin "https://wasgeurtje.nl"
       Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
       Header set Access-Control-Allow-Headers "Content-Type, Authorization"
   </IfModule>
   ```

   Of in `wp-config.php`:
   ```php
   // Allow CORS for frontend
   header("Access-Control-Allow-Origin: https://wasgeurtje.nl");
   header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
   header("Access-Control-Allow-Headers: Content-Type, Authorization");
   ```

4. **DNS instellen**
   - Maak een A-record of CNAME voor `api.wasgeurtje.nl`
   - Wijs deze naar je hosting server waar WordPress draait
   - Installeer SSL certificaat voor api.wasgeurtje.nl

### Stap 3: Next.js Frontend deployen naar Vercel

1. **Push je code naar GitHub/GitLab**
   ```bash
   git add .
   git commit -m "Add API migration setup"
   git push
   ```

2. **Vercel Project Setup**
   - Ga naar [vercel.com](https://vercel.com)
   - Import je repository
   - Voeg environment variabelen toe (zie Stap 1 - Production)

3. **Domain configuratie in Vercel**
   - Ga naar Project Settings → Domains
   - Voeg `wasgeurtje.nl` toe
   - Vercel geeft je DNS instructies

4. **DNS aanpassen**
   - Wijzig A-record van `wasgeurtje.nl` naar Vercel IP (wordt getoond)
   - Of gebruik CNAME naar `cname.vercel-dns.com`

### Stap 4: Testen

#### Test 1: Locale development
```bash
npm run dev
```
Bezoek `http://localhost:3000` en controleer of producten laden.

#### Test 2: Production deployment
Na deployment op Vercel, test:
- Producten pagina: `https://wasgeurtje.nl/products`
- Detail pagina: `https://wasgeurtje.nl/products/blossom-drip`
- Checkout flow

#### Test 3: API calls monitoren
Open Chrome DevTools → Network tab:
- Kijk of `/wp-json/...` calls succesvol zijn (status 200)
- Controleer of data correct wordt opgehaald

## 🎨 Voordelen van Rewrites vs Andere Methoden

### ❌ Methode 1: Overal endpoints vervangen (SLECHT)
```typescript
// Moet 100+ keer aangepast worden in code
fetch('https://api.wasgeurtje.nl/wp-json/wc/v3/products')
```
**Nadelen**: Veel werk, foutgevoelig, moeilijk te onderhouden

### ❌ Methode 2: Environment variabelen overal gebruiken (MATIG)
```typescript
// Moet overal ${process.env.API_BASE_URL} gebruiken
fetch(`${process.env.API_BASE_URL}/wp-json/wc/v3/products`)
```
**Nadelen**: Nog steeds veel code aanpassen, verbosity

### ✅ Methode 3: Next.js Rewrites (BESTE) ⭐
```typescript
// Code blijft simpel en clean
fetch('/wp-json/wc/v3/products')
```
**Voordelen**: 
- Geen code hoeft aangepast
- Clean en leesbaar
- Centraal beheerd in next.config.js
- Werkt automatisch met Next.js caching
- Geen CORS problemen

## 📚 Handige Commando's

### Development
```bash
# Start development server
npm run dev

# Check of rewrites werken
curl http://localhost:3000/wp-json/wc/v3/products
```

### Deployment
```bash
# Deploy naar Vercel (via CLI)
npx vercel

# Deploy production
npx vercel --prod
```

### WordPress Backend
```bash
# Check of API bereikbaar is
curl https://api.wasgeurtje.nl/wp-json/wc/v3/products \
  -u "consumer_key:consumer_secret"

# Test CORS
curl -I https://api.wasgeurtje.nl/wp-json/wc/v3/products
```

## 🔍 Troubleshooting

### Probleem: "Failed to fetch products"

**Mogelijke oorzaken:**
1. API_BASE_URL niet correct ingesteld
2. CORS headers niet goed geconfigureerd
3. WooCommerce credentials incorrect

**Oplossing:**
```bash
# Check environment variabelen
echo $API_BASE_URL

# Test API rechtstreeks
curl https://api.wasgeurtje.nl/wp-json/wc/v3/products \
  -u "your_key:your_secret"
```

### Probleem: Images laden niet

**Oplossing:**
1. Check of `wp-content/uploads` rewrite werkt
2. Voeg `api.wasgeurtje.nl` toe aan `next.config.js` images.remotePatterns
3. Check of SSL certificaat geldig is op api.wasgeurtje.nl

### Probleem: Rewrites werken niet

**Oplossing:**
```bash
# Herstart Next.js dev server
npm run dev

# Check next.config.js syntax
node -c next.config.js

# Vercel: check deployment logs
npx vercel logs
```

## 🚀 Migratie Checklist

- [ ] Environment variabelen toegevoegd aan `.env.local` (development)
- [ ] `next.config.js` updated met rewrites
- [ ] `src/config/api.ts` aangemaakt
- [ ] `src/utils/woocommerce.ts` updated
- [ ] WordPress verhuisd naar api.wasgeurtje.nl
- [ ] DNS records ingesteld voor api.wasgeurtje.nl
- [ ] SSL certificaat geïnstalleerd voor api.wasgeurtje.nl
- [ ] CORS headers ingesteld op WordPress backend
- [ ] Code gepushed naar Git repository
- [ ] Vercel project aangemaakt
- [ ] Environment variabelen toegevoegd in Vercel
- [ ] Domain `wasgeurtje.nl` gekoppeld aan Vercel
- [ ] DNS aangepast naar Vercel
- [ ] Getest: producten laden op wasgeurtje.nl
- [ ] Getest: checkout flow werkt
- [ ] Getest: API calls gaan naar api.wasgeurtje.nl
- [ ] Analytics en tracking getest

## 📖 Extra Resources

- [Next.js Rewrites Documentation](https://nextjs.org/docs/api-reference/next.config.js/rewrites)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [WooCommerce REST API](https://woocommerce.github.io/woocommerce-rest-api-docs/)
- [WordPress REST API](https://developer.wordpress.org/rest-api/)

## 🆘 Support

Als je problemen hebt tijdens de migratie:
1. Check de troubleshooting sectie hierboven
2. Controleer Vercel deployment logs
3. Check browser console voor errors
4. Test API endpoints rechtstreeks met curl/Postman

---

**Succes met de migratie! 🎉**

