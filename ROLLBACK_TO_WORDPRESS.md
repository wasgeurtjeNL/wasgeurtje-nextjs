# Rollback naar WordPress - Checklist

**Datum:** 7 November 2025
**Reden:** Te veel problemen met Next.js frontend, terugkeren naar pure WordPress

---

## 🚨 Huidige Situatie

### Problemen op de site:
- ❌ DNS/SSL certificaat errors (wasgeurtje.nl offline)
- ❌ Meerdere pagina's geven 404 errors
- ❌ React hydration errors (#418)
- ❌ Inconsistente routing tussen pages
- ❌ Build cache problemen
- ❌ Debug logging werd verwijderd in productie

### Status Check (uitgevoerd via Playwright):

| URL | Status | Content | Probleem |
|-----|--------|---------|----------|
| `https://wasgeurtje.nl` | 🔴 OFFLINE | - | SSL Certificate error |
| `https://www.wasgeurtje.nl` | 🔴 OFFLINE | - | DNS niet gevonden |
| `/wasparfum-kruidvat` | ❌ 404 | Geen | Dedicated route deleted maar cache issue |
| `/betaalmogelijkheden` | ❌ 404 | Geen | Not found |
| `/verzenden-retourneren` | ❌ 404 | Geen | Not found |
| `/ons-verhaal` | ❌ 404 | Geen | Not found |
| `/retail` | ❌ 404 | Geen | Not found |
| `/groene-missie` | ❌ 404 | Geen | Not found |
| `/waspunten` | ❌ 404 | Geen | Not found |
| `/verkooppunten` | ⚠️ Partial | Ja | Content laadt maar hydration error |

---

## 📋 Stappen om terug te keren naar WordPress

### 1. DNS & Domein Configuratie

#### Huidige situatie (Next.js op Vercel):
```
wasgeurtje.nl → Points to: Vercel
api.wasgeurtje.nl → Points to: WordPress backend
```

#### Gewenste situatie (Pure WordPress):
```
wasgeurtje.nl → Points to: WordPress hosting server
www.wasgeurtje.nl → CNAME to: wasgeurtje.nl
```

**Acties:**
1. Log in bij je domain provider (bijv. TransIP, Hostnet, etc.)
2. Wijzig A-record voor `wasgeurtje.nl`:
   - **Verwijder:** Vercel IP
   - **Toevoegen:** WordPress hosting server IP
3. Wijzig CNAME voor `www`:
   - **Verwijder:** cname.vercel-dns.com
   - **Toevoegen:** wasgeurtje.nl
4. **Propagatie tijd:** 1-24 uur

---

### 2. WordPress Configuratie Aanpassen

#### Database Settings Update

Log in op WordPress database (via PHPMyAdmin of MySQL CLI):

```sql
-- Update site URL terug naar hoofddomein
UPDATE wp_options 
SET option_value = 'https://wasgeurtje.nl' 
WHERE option_name IN ('siteurl', 'home');

-- Controleer de update
SELECT option_name, option_value 
FROM wp_options 
WHERE option_name IN ('siteurl', 'home');
```

#### WordPress Admin Check
1. Log in op WordPress admin: `https://api.wasgeurtje.nl/wp-admin` (tijdelijk)
2. Ga naar **Settings → General**
3. Wijzig:
   - **WordPress Address (URL):** `https://wasgeurtje.nl`
   - **Site Address (URL):** `https://wasgeurtje.nl`
4. Klik **Save Changes**

⚠️ **Belangrijk:** Na deze wijziging redirect WordPress naar het nieuwe domein!

---

### 3. CORS Headers Verwijderen

Als je CORS headers had ingesteld voor de Next.js frontend, verwijder deze:

**In `.htaccess`:**
```apache
# Verwijder deze regels:
# Header set Access-Control-Allow-Origin "https://wasgeurtje.nl"
# Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
# Header set Access-Control-Allow-Headers "Content-Type, Authorization"
```

**In `wp-config.php`:**
```php
// Verwijder deze regels:
// header("Access-Control-Allow-Origin: https://wasgeurtje.nl");
// header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
// header("Access-Control-Allow-Headers: Content-Type, Authorization");
```

---

### 4. SSL Certificaat Controleren

Zorg dat je WordPress hosting een geldig SSL certificaat heeft voor:
- ✅ `wasgeurtje.nl`
- ✅ `www.wasgeurtje.nl`

**Let's Encrypt (gratis):**
```bash
# Via Certbot
sudo certbot --nginx -d wasgeurtje.nl -d www.wasgeurtje.nl
```

Of gebruik je hosting control panel (cPanel, Plesk, DirectAdmin):
- Ga naar SSL/TLS sectie
- Installeer Let's Encrypt certificaat

---

### 5. Vercel Project Pauzeren/Verwijderen

**Optie A: Project pauzeren**
1. Ga naar [vercel.com](https://vercel.com)
2. Selecteer je project
3. Settings → General → Pause Deployments

**Optie B: Domain ontkoppelen**
1. Vercel Dashboard → Project → Settings → Domains
2. Verwijder `wasgeurtje.nl` uit domains
3. Dit zorgt dat Vercel het domein vrijgeeft

⚠️ **Doe dit PAS nadat DNS is aangepast!**

---

### 6. Cache & CDN Clearen

Als je een CDN gebruikt (Cloudflare, etc.):
1. Purge all cache
2. Wacht 5-10 minuten voor propagatie

Voor Vercel edge cache:
- Wordt automatisch gecleared na domein verwijderen

---

### 7. Testen na Rollback

**Checklist:**
- [ ] `https://wasgeurtje.nl` laadt WordPress homepage
- [ ] `https://www.wasgeurtje.nl` redirect naar wasgeurtje.nl
- [ ] SSL certificaat is geldig (groene hangslot)
- [ ] Admin bereikbaar: `https://wasgeurtje.nl/wp-admin`
- [ ] WooCommerce checkout werkt
- [ ] Product pagina's laden
- [ ] Blog posts laden
- [ ] Contact formulieren werken

**Test pagina's:**
- `/wasparfum-kruidvat`
- `/betaalmogelijkheden`
- `/verzenden-retourneren`
- `/ons-verhaal`
- `/verkooppunten`
- `/groene-missie`
- `/waspunten`
- `/algemene-voorwaarden`

---

## 🔄 Tijdelijke Workaround (tijdens DNS propagatie)

Als je DNS nog niet wilt wijzigen maar wel WordPress wilt testen:

1. **Gebruik api.wasgeurtje.nl tijdelijk:**
   - Bezoek: `https://api.wasgeurtje.nl`
   - Dit zou je WordPress site moeten tonen

2. **hosts file wijziging (lokaal testen):**
   ```
   # Windows: C:\Windows\System32\drivers\etc\hosts
   # Mac/Linux: /etc/hosts
   
   [JOUW_WORDPRESS_SERVER_IP]  wasgeurtje.nl
   ```

---

## 📁 Next.js Code Archiveren

**Optie 1: Branch maken**
```bash
cd "C:\Users\wulle\OneDrive\Documenten\cursor projects\website projects\wasguerjte-main"
git checkout -b archive/nextjs-frontend
git push origin archive/nextjs-frontend
git checkout main
```

**Optie 2: Tag maken**
```bash
git tag -a nextjs-version-final -m "Final Next.js frontend before rollback to WordPress"
git push origin nextjs-version-final
```

---

## ⚡ Snelle Rollback (Noodprocedure)

Als je **NU DIRECT** terug wilt naar WordPress:

### Stap 1: Vercel Domain Verwijderen
1. Vercel Dashboard
2. Domains → wasgeurtje.nl → Remove

### Stap 2: DNS Wijzigen
1. Domain provider dashboard
2. A-record `@` → Wijzig naar WordPress server IP
3. CNAME `www` → Wijzig naar `@` of `wasgeurtje.nl`

### Stap 3: WordPress URL Update
```sql
UPDATE wp_options SET option_value = 'https://wasgeurtje.nl' 
WHERE option_name IN ('siteurl', 'home');
```

### Stap 4: Wachten
- DNS propagatie: 15 minuten - 24 uur
- Gemiddeld: 1-2 uur
- Check via: https://dnschecker.org

---

## 🆘 Vragen?

**Wat is mijn WordPress server IP?**
- Check bij je hosting provider dashboard
- Of gebruik: `ping api.wasgeurtje.nl` (als WordPress daar al draait)

**Hoe weet ik of DNS is geupdatet?**
- Gebruik: https://dnschecker.org/#A/wasgeurtje.nl
- Of: `nslookup wasgeurtje.nl`

**Wat met de Next.js code?**
- Bewaar in een branch (zie "Next.js Code Archiveren")
- GitHub repository blijft bestaan
- Je kunt altijd terug als je wilt

**Wat gebeurt er met mijn data?**
- Alle WooCommerce data zit in WordPress database
- Klanten, orders, producten blijven intact
- Geen data verlies!

---

## 📞 Hulp Nodig?

Neem contact op met:
- Je hosting provider voor server IP en DNS hulp
- WordPress support voor database vragen
- Vercel support voor domain ontkoppeling

---

## ✅ Verificatie na Rollback

Run deze checks:

```bash
# Check DNS
nslookup wasgeurtje.nl

# Check SSL
curl -I https://wasgeurtje.nl

# Check WordPress
curl https://wasgeurtje.nl/wp-json/
```

Verwachte output:
- DNS: IP van je WordPress server
- SSL: Status 200 of 301/302
- WordPress API: JSON response met site info

---

**Status:** WACHTEND OP UITVOERING
**Laatst bijgewerkt:** 7 November 2025, 08:20 CET

