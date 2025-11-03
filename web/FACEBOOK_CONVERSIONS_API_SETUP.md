# 🔐 Facebook Conversions API Setup

## **Wat is Facebook Conversions API?**

Facebook Conversions API is **server-side tracking** die events rechtstreeks van je server naar Facebook stuurt. Dit zorgt voor:

- ✅ **Betere tracking accuraatheid** - Geen ad blockers, geen iOS 14+ restricties
- ✅ **Meer conversie data** - ~30-50% meer data dan alleen browser tracking
- ✅ **Privacy-friendly** - Gehasht PII (Personal Identifiable Information)
- ✅ **Deduplicatie** - Facebook combineert automatisch client + server events

---

## **📋 SETUP INSTRUCTIES**

### **STAP 1: Facebook Access Token Aanmaken**

1. **Ga naar Facebook Business Manager:**
   - Open: https://business.facebook.com/settings/system-users

2. **Maak een System User aan:**
   - Klik op **"Add"**
   - Naam: `Conversions API - Wasgeurtje`
   - Rol: **Admin** (of **Employee** met Ads permissions)
   - Klik **"Create System User"**

3. **Genereer Access Token:**
   - Klik op de nieuwe System User
   - Klik op **"Generate New Token"**
   - **Permissions selecteren:**
     - ✅ `ads_management`
     - ✅ `business_management`
   - **Expiration:** Kies **"60 dagen"** of **"Never Expire"** (aanbevolen)
   - Klik **"Generate Token"**
   - ⚠️ **KOPIEER DE TOKEN METEEN!** (je ziet deze maar 1 keer)

4. **Assign Ad Account:**
   - Ga naar **"Assigned Ad Accounts"**
   - Klik **"Add Ad Account"**
   - Selecteer je Ad Account
   - Klik **"Assign"**

5. **Assign Pixel:**
   - Ga naar **"Assigned Pages and Assets"** → **"Pixels"**
   - Klik **"Add Assets"**
   - Selecteer je Pixel (ID: `834004417164714`)
   - Permissions: **Full Control** (aanbevolen) of **Advertise**
   - Klik **"Save Changes"**

---

### **STAP 2: Access Token Toevoegen aan Next.js**

1. **Open je `.env.local` file** (in de `web/` directory)

2. **Voeg deze regel toe:**
   ```bash
   FACEBOOK_CONVERSION_API_ACCESS_TOKEN=jouw_access_token_hier
   ```

3. **Voorbeeld:**
   ```bash
   # Facebook Conversions API
   FACEBOOK_CONVERSION_API_ACCESS_TOKEN=EAAG1234567890...
   ```

4. **⚠️ BELANGRIJK:**
   - ✅ **Deel deze token NOOIT** in git/GitHub
   - ✅ `.env.local` staat al in `.gitignore`
   - ✅ Voor Vercel: voeg toe als **Environment Variable** in Settings

---

### **STAP 3: Environment Variable Toevoegen aan Vercel**

1. **Ga naar Vercel Dashboard:**
   - Open: https://vercel.com/wasgeurtje/wasgeurtje-nextjs/settings/environment-variables

2. **Nieuwe Environment Variable toevoegen:**
   - **Name:** `FACEBOOK_CONVERSION_API_ACCESS_TOKEN`
   - **Value:** `jouw_access_token_hier`
   - **Environment:** ✅ **Production**, ✅ **Preview**, ✅ **Development**
   - Klik **"Save"**

3. **Redeploy je applicatie:**
   - Ga naar **"Deployments"**
   - Klik op de 3 dots van de laatste deployment
   - Klik **"Redeploy"**

---

## **✅ VERIFICATIE**

### **Test of het werkt:**

1. **Open je website:**
   - Ga naar: https://wasgeurtje-nextjs.vercel.app/

2. **Open Browser Console (F12):**
   - Zoek naar:
     ```
     [FB Server] Event sent successfully
     ```

3. **Voeg een product toe aan cart:**
   - Je zou in de console moeten zien:
     ```
     [FB Server] Event sent successfully: {
       eventName: "AddToCart",
       eventId: "AddToCart_1234567890_abc123",
       events_received: 1
     }
     ```

4. **Open Facebook Events Manager:**
   - Ga naar: https://business.facebook.com/events_manager2/list/pixel/834004417164714/overview
   - Klik op een recent event (bijv. "Toevoeging aan winkelwagentje")
   - Check **"Gebeurtenisgegevens ontvangen van"**:
     - ✅ **Browser** (client-side)
     - ✅ **Server** (server-side) ← **Dit is het bewijs!**

---

## **🔍 TROUBLESHOOTING**

### **Probleem 1: Access Token werkt niet**

**Fout in console:**
```
[FB Conversions API] Error: Invalid OAuth 2.0 Access Token
```

**Oplossing:**
1. Check of token correct is toegevoegd aan `.env.local` of Vercel
2. Verifieer dat System User **Admin** rechten heeft
3. Check of Pixel (ID: `834004417164714`) is toegewezen aan System User
4. Genereer een nieuwe token als deze expired is

---

### **Probleem 2: Events worden niet getoond als "Server" in Events Manager**

**Mogelijke oorzaken:**
1. Access Token is niet correct geconfigureerd
2. API route krijgt geen requests (check browser console)
3. Vercel Environment Variable is niet correct ingesteld
4. Facebook heeft vertraging (max 20 minuten)

**Oplossing:**
1. Check of `FACEBOOK_CONVERSION_API_ACCESS_TOKEN` bestaat in Vercel Settings
2. Check browser console voor `[FB Server] Event sent successfully`
3. Wacht 5-20 minuten en refresh Events Manager

---

### **Probleem 3: Events worden gedupliceerd**

**Symptomen:**
- Elk event wordt 2x geteld in Facebook

**Oorzaak:**
- Client-side en server-side events hebben verschillende `event_id`

**Oplossing:**
- Dit is al opgelost! We gebruiken dezelfde `event_id` voor deduplicatie:
  ```typescript
  // Client-side: purchase_ORDER123
  // Server-side: purchase_ORDER123
  // Facebook ziet: 1 uniek event ✅
  ```

---

## **📊 RESULTAAT**

Na correcte setup zie je in **Facebook Events Manager**:

| **Event** | **Browser** | **Server** | **Total** |
|-----------|-------------|------------|-----------|
| AddToCart | 100 | 100 | 100 (gededupliceerd) |
| Purchase | 10 | 10 | 10 (gededupliceerd) |

✅ **Match Rate: ~100%** (ideaal scenario)

**Voor deduplicatie:**
- Browser only: ~50-70% events (door ad blockers, iOS 14+)
- Server only: ~100% events (maar minder browser context)
- **Browser + Server: ~100% events + volledige context** 🎉

---

## **🔗 USEFUL LINKS**

- **Facebook Events Manager:** https://business.facebook.com/events_manager2/
- **System Users:** https://business.facebook.com/settings/system-users
- **Conversions API Docs:** https://developers.facebook.com/docs/marketing-api/conversions-api
- **Vercel Environment Variables:** https://vercel.com/docs/concepts/projects/environment-variables

---

## **💡 TIPS**

1. **Test in Preview Mode eerst:**
   - Gebruik `?test_event_code=TEST12345` in URL
   - Events worden getoond in Test Events tab

2. **Monitor Event Quality:**
   - Check **Event Match Quality** in Events Manager
   - Streven naar **8.0+** score (Good/Great)

3. **Gebruik Test Events Code tijdens development:**
   - Voeg toe aan URL: `?test_event_code=TEST12345`
   - Events worden niet geteld in je echte statistieken

---

## **✅ CHECKLIST**

- [ ] System User aangemaakt in Facebook Business Manager
- [ ] Access Token gegenereerd (met `ads_management` permission)
- [ ] Pixel (ID: `834004417164714`) toegewezen aan System User
- [ ] `FACEBOOK_CONVERSION_API_ACCESS_TOKEN` toegevoegd aan `.env.local`
- [ ] Environment Variable toegevoegd aan Vercel
- [ ] Vercel deployment getriggerd
- [ ] Test event in browser (AddToCart)
- [ ] Verificatie in Facebook Events Manager (Browser + Server)

**Als alle checkboxes ✅ zijn: GEFELICITEERD! Server-side tracking werkt! 🎉**

