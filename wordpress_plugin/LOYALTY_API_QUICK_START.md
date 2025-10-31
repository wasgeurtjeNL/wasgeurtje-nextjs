# 🚀 WP Loyalty API - Quick Start

## Snelle Installatie (5 minuten)

### ✅ Voordat je begint
- [ ] Je hebt toegang tot WordPress admin
- [ ] WP Loyalty plugin is al geïnstalleerd en actief

### 📋 Installatie Stappen

#### Optie A: Via WordPress Admin (Makkelijkst)

1. **Download het bestand**
   - Open `wp-loyalty-points-api.php` 
   - Copy de hele inhoud

2. **Maak plugin aan**
   - Log in op WordPress admin (https://wasgeurtje.nl/wp-admin)
   - Ga naar **Plugins → Plugin Editor**
   - Klik op **+ New Plugin**
   - Plak de code
   - Sla op als `wp-loyalty-points-api.php`

3. **Activeer**
   - Ga naar **Plugins → Installed Plugins**
   - Zoek **WP Loyalty Points API**
   - Klik **Activate**

#### Optie B: Via FTP/File Manager (Snelst)

1. Upload `wp-loyalty-points-api.php` naar:
   ```
   /wp-content/plugins/wp-loyalty-points-api/wp-loyalty-points-api.php
   ```

2. In WordPress admin → **Plugins** → **Activate** de plugin

### 🧪 Test direct

Open in je browser:
```
https://wasgeurtje.nl/wp-json/my/v1/loyalty/points?email=JOUW_EMAIL_HIER
```

**Verwacht resultaat:**
```json
{
  "points": 150,
  "earned": 500,
  "level_id": 1,
  "refer_code": "ABC123",
  "used_points": 350,
  "status": "success"
}
```

### ✨ Klaar!

Je endpoint werkt nu. De Next.js app zal automatisch beginnen met het ophalen van loyalty punten.

---

## Problemen?

### 404 Error
→ Ga naar **Settings → Permalinks** en klik op **Save Changes**

### "Table not found" error
→ Activeer eerst de WP Loyalty plugin

### Geen data terug
→ Check of het email adres bestaat in WP Loyalty

---

## Code in je project

De endpoint wordt al gebruikt in:
```typescript
// web/src/utils/auth-api.ts
const endpoint = `https://wasgeurtje.nl/wp-json/my/v1/loyalty/points?email=${email}`;
```

Geen wijzigingen nodig in je Next.js code! 🎉

