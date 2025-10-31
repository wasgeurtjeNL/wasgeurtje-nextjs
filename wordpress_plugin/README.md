# 🗺️ Customer Address Deletion Manager - Complete Setup

Dit pakket biedt een **complete server-side oplossing** voor het beheren van verwijderde klantadressen in je Wasgeurtje.nl checkout. Adressen blijven nu gesynchroniseerd tussen alle apparaten!

---

## 📦 Wat zit er in dit pakket?

### 1. **WordPress Plugin** 
`customer-address-deletion-manager.php`
- REST API endpoints voor address management
- User meta storage (persistent across devices)
- Admin interface voor debugging
- Logging & monitoring

### 2. **Next.js API Route**
`web/src/app/api/woocommerce/customer/deleted-addresses/route.ts`
- GET endpoint om deleted addresses op te halen
- Graceful degradation bij server issues
- Timeout handling

### 3. **Implementatie Documentatie**
`DELETED_ADDRESSES_IMPLEMENTATION.md`
- Volledige installatie guide
- API endpoint documentatie
- Testing procedures
- Troubleshooting tips

### 4. **Frontend Voorbeeld Code**
`frontend-integration-example.ts`
- Hybrid approach (localStorage + server)
- Server-first approach
- UI components (loading indicators, status badges)
- Code comments in Nederlands

---

## 🚀 Quick Start (5 minuten)

### Stap 1: WordPress Plugin Installeren
```bash
# Upload naar WordPress
scp customer-address-deletion-manager.php user@server:/var/www/html/wp-content/plugins/

# OF via FTP/WordPress admin
# Upload naar: /wp-content/plugins/
```

**Activeer plugin:**
WordPress Admin → Plugins → Activeer "Customer Address Deletion Manager"

### Stap 2: Next.js API Route Toevoegen
Bestand is al aangemaakt op:
```
web/src/app/api/woocommerce/customer/deleted-addresses/route.ts
```
✅ Dit bestand is klaar voor gebruik!

### Stap 3: Test de API
```bash
# Test deleted addresses ophalen
curl "https://wasgeurtje.nl/wp-json/custom/v1/deleted-addresses?email=info@wasgeurtje.nl"

# Verwachte response:
# {
#   "success": true,
#   "data": {
#     "deletedAddresses": [],
#     "totalDeleted": 0
#   }
# }
```

### Stap 4: Frontend Integreren (Optioneel nu)
Zie `frontend-integration-example.ts` voor complete code voorbeelden.

**Minimale integratie** - voeg toe aan `web/src/app/checkout/page.tsx`:

```typescript
// Bij component state:
const [deletedAddressesServer, setDeletedAddressesServer] = useState<string[]>([]);

// Fetch on mount:
useEffect(() => {
  if (user?.email) {
    fetch(`/api/woocommerce/customer/deleted-addresses?email=${user.email}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const merged = [...new Set([
            ...JSON.parse(localStorage.getItem('deletedAddresses') || '[]'),
            ...data.data.deletedAddresses
          ])];
          localStorage.setItem('deletedAddresses', JSON.stringify(merged));
          setAddressRefresh(p => p + 1);
        }
      });
  }
}, [user?.email]);
```

---

## 🎯 Wat is het Verschil?

### ❌ **VOOR** (Alleen localStorage)
```
Laptop:   Adres A verwijderd ✅
Telefoon: Adres A verschijnt weer ❌
Desktop:  Cache gewist → alle adressen terug ❌
```

### ✅ **NA** (Server-side sync)
```
Laptop:   Adres A verwijderd ✅ → Server
Telefoon: Adres A ook weg ✅ ← Server
Desktop:  Cache gewist → blijft weg ✅ ← Server
```

---

## 📊 Architectuur Overzicht

```
┌─────────────────┐
│  Next.js        │
│  Checkout Page  │
└────────┬────────┘
         │
         │ (1) Fetch deleted addresses
         ▼
┌─────────────────┐
│  Next.js API    │
│  /api/...       │
└────────┬────────┘
         │
         │ (2) Call WordPress REST API
         ▼
┌─────────────────┐
│  WordPress      │
│  Plugin         │
└────────┬────────┘
         │
         │ (3) Read/Write user_meta
         ▼
┌─────────────────┐
│  MySQL          │
│  wp_usermeta    │
└─────────────────┘
```

**Data flow:**
1. User verwijdert adres in checkout
2. Next.js → WordPress API: "Delete address X"
3. WordPress → Database: Save to user_meta
4. Database → WordPress → Next.js: Updated list
5. Next.js: Merge met localStorage + Update UI

---

## 🔌 API Endpoints Overzicht

| Endpoint | Method | Doel | Status |
|----------|--------|------|--------|
| `/custom/v1/delete-address` | POST | Adres verwijderen | ✅ Ready |
| `/custom/v1/deleted-addresses` | GET | Lijst ophalen | ✅ Ready |
| `/custom/v1/restore-address` | POST | Adres herstellen | ✅ Ready |
| `/custom/v1/clear-deleted-addresses` | POST | Alles wissen | ✅ Ready |

**Next.js Proxy:**
- `/api/woocommerce/customer/address/delete` → WordPress delete endpoint ✅
- `/api/woocommerce/customer/deleted-addresses` → WordPress get endpoint ✅

---

## 🧪 Testing Checklist

### WordPress Plugin
- [ ] Plugin geactiveerd in WordPress admin
- [ ] REST API endpoints bereikbaar
- [ ] Deleted addresses pagina zichtbaar in admin
- [ ] Test met cURL succesvol

### Next.js API
- [ ] `/api/woocommerce/customer/deleted-addresses` bereikbaar
- [ ] Graceful degradation werkt bij server errors
- [ ] CORS configuratie correct

### Frontend (na integratie)
- [ ] Verwijderd adres verdwijnt direct uit UI
- [ ] Adres blijft weg na page refresh
- [ ] Adres blijft weg op ander apparaat (na login)
- [ ] Werkt nog steeds als WordPress down is (localStorage fallback)

---

## 🔐 Security & Performance

### ✅ Security
- Email-based authentication (geen passwords in API)
- Input sanitization (SQL injection protected)
- Rate limiting ready (zie docs voor implementatie)
- CORS properly configured

### ✅ Performance
- User meta storage (snelle read/write)
- Gecached in localStorage (instant UI)
- Async server sync (non-blocking)
- 5 second timeout (geen lange waits)

---

## 🐛 Troubleshooting

### "404 Not Found" op API endpoints
**Fix:** Refresh WordPress permalinks
```
WordPress Admin → Instellingen → Permalinks → Opslaan
```

### "Customer not found"
**Check:** Bestaat email in WordPress?
```sql
SELECT * FROM wp_users WHERE user_email = 'test@example.com';
```

### Endpoints reageren niet
**Debug:**
1. Enable WP_DEBUG in `wp-config.php`
2. Check `/wp-content/debug.log`
3. Test met cURL (zie implementatie docs)

---

## 📈 Monitoring

De plugin logt automatisch alle acties:

```
[Address Deletion] User ID: 123 | Action: delete | Address ID: abc123 | Time: 2025-10-26 12:00:00
```

**Log locatie:** `/wp-content/debug.log` (als `WP_DEBUG_LOG = true`)

**Admin interface:** `WordPress Admin → Gebruikers → Deleted Addresses`

---

## 🎨 UI Voorbeelden (Optioneel)

### Sync Status Indicator
```typescript
🟢 Gesynchroniseerd    // Server + Local match
🟡 Synchroniseren...   // Sync in progress
🔴 Offline            // No internet
🔵 Lokaal opgeslagen  // Only in localStorage
```

### Loading States
```typescript
"Adressen laden..."        // Initial fetch
"Adres verwijderen..."     // Delete in progress
"Gesynchroniseerd ✓"       // Sync complete
```

---

## 💡 Future Ideas

### Automatisch Cleanup
Verwijder oude deleted addresses na X dagen:
```php
// Run daily cleanup
wp_schedule_event(time(), 'daily', 'cleanup_old_deleted_addresses');
```

### Restore UI
"Ongedaan maken" knop in checkout:
```typescript
<button onClick={() => restoreAddress(addressId)}>
  Herstel adres
</button>
```

### Bulk Operations
Admin kan alle deleted addresses wissen voor alle users:
```php
// Admin tool
delete_metadata('user', null, 'deleted_addresses', '', true);
```

---

## 📞 Support

**Vragen over:**
- WordPress plugin → Check admin page: "Deleted Addresses"
- API endpoints → Check debug.log in WordPress
- Frontend integratie → Zie frontend-integration-example.ts
- Algemeen → Lees DELETED_ADDRESSES_IMPLEMENTATION.md

**Logs checken:**
```bash
# WordPress
tail -f /var/www/html/wp-content/debug.log

# Next.js development
npm run dev
# Check browser console
```

---

## ✅ Checklist voor Productie

### Vóór Deploy
- [ ] WordPress plugin getest op staging
- [ ] API endpoints werken met echte customer data
- [ ] Frontend integratie getest op alle devices
- [ ] Error handling getest (server down scenario)
- [ ] Rate limiting configured (optioneel maar aanbevolen)

### Na Deploy
- [ ] Monitor WordPress debug.log voor errors
- [ ] Check "Deleted Addresses" admin page voor activiteit
- [ ] Test met echte klant account
- [ ] Verifieer cross-device sync werkt
- [ ] Monitor performance (query times)

---

## 🎉 Klaar!

Je hebt nu een **robuuste, cross-device adres deletion** systeem!

**Voordelen:**
✅ Sync tussen alle apparaten
✅ Persistent (niet verloren bij cache wissen)
✅ Graceful degradation (werkt ook bij server issues)
✅ Admin interface voor support
✅ Proper logging & monitoring

**Volgende stappen:**
1. Installeer WordPress plugin
2. Test API endpoints
3. Integreer frontend code
4. Deploy naar productie
5. 🚀 Profit!

---

**Gemaakt voor Wasgeurtje.nl** 💙💛

