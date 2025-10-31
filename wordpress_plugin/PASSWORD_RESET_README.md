# 🔐 Password Reset - Oplossing voor "IK ONTVANG GEEN MAIL"

## Het Probleem

De wachtwoord reset functie werkte niet omdat WordPress's `wp-login.php` endpoint niet goed samenwerkt met externe API calls.

## De Oplossing

Ik heb een **WordPress plugin** gemaakt die een proper REST API endpoint toevoegt voor wachtwoord resets.

## ✅ Wat je NU moet doen

### 📦 Stap 1: Installeer de WordPress Plugin

Het bestand `password-reset-api.php` moet op de WordPress server geïnstalleerd worden:

**Via WordPress Admin:**
1. Log in op https://wasgeurtje.nl/wp-admin
2. Ga naar **Plugins** → **Add New** → **Upload Plugin**
3. Upload `wordpress_plugin/password-reset-api.php`
4. Klik **Install Now** en dan **Activate**

**Of via FTP/SFTP:**
```bash
# Upload naar:
/wp-content/plugins/password-reset-api.php

# Dan activeer in WordPress admin
```

### 🧪 Stap 2: Test het Endpoint

```bash
curl -X POST https://wasgeurtje.nl/wp-json/custom/v1/password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"info@wasgeurtje.nl"}'
```

**Verwachte response:**
```json
{
  "success": true,
  "message": "Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten een e-mail met instructies."
}
```

### 📧 Stap 3: Controleer of Email Aankomt

Gebruik een echt email adres dat in WordPress bestaat en check:
1. ✅ Inbox
2. ✅ Spam folder
3. ✅ Promotions tab (Gmail)

### 🚨 Als Email NIET aankomt

**WordPress kan mogelijk geen emails versturen!** Dit is een veelvoorkomend probleem.

**Oplossing**: Installeer een SMTP plugin:

1. Ga naar WordPress admin → Plugins → Add New
2. Zoek naar "WP Mail SMTP"
3. Installeer en activeer
4. Configureer met je SMTP gegevens (bijv. Gmail, SendGrid, Mailgun)

**Of gebruik deze plugins:**
- WP Mail SMTP by WPForms (meest populair)
- Easy WP SMTP
- Post SMTP Mailer

## 🎯 Wat is er Veranderd

### WordPress Plugin (`password-reset-api.php`)
```
Nieuw endpoint: /wp-json/custom/v1/password-reset

Features:
✅ Genereert WordPress reset key
✅ Stuurt HTML email met reset link
✅ 24 uur geldige links
✅ Security: geen email enumeration
✅ Werkt met standaard WordPress users EN WooCommerce customers
```

### Next.js API Route (`web/src/app/api/auth/reset-password/route.ts`)
```
Update: Gebruikt nu het nieuwe WordPress endpoint

Voor: wp-login.php (werkt niet voor API calls)
Nu:  wp-json/custom/v1/password-reset (proper REST API)
```

### Frontend (`web/src/components/CheckoutAuthPopup.tsx`)
```
Geen wijzigingen nodig - werkt al perfect!
```

## 📧 Voorbeeld Email

De gebruiker ontvangt:

```
Onderwerp: [Wasgeurtje.nl] Wachtwoord Reset

Hoi,

Er is een verzoek gedaan om het wachtwoord voor het volgende account te resetten:

https://wasgeurtje.nl/

Gebruikersnaam: jackwullems18

Als dit een vergissing was, negeer deze e-mail dan en er zal niets gebeuren.

Klik op de onderstaande link om een nieuw wachtwoord in te stellen:

https://wasgeurtje.nl/wp-login.php?action=rp&key=XXXXX&login=jackwullems18

Deze link is 24 uur geldig.

Met vriendelijke groet,
Het Wasgeurtje team
```

## 🧪 Complete Test Flow

1. **Open checkout**: http://localhost:3000/checkout
2. **Klik**: "Log in of registreer je"
3. **Klik**: "Wachtwoord vergeten?"
4. **Vul in**: info@wasgeurtje.nl (of je eigen test email)
5. **Klik**: "Verstuur resetlink"
6. **Zie**: Success bericht
7. **Check**: Email inbox
8. **Klik**: Reset link in email
9. **Stel in**: Nieuw wachtwoord
10. **Test**: Login met nieuw wachtwoord

## 🐛 Troubleshooting

### "404 Not Found" bij API call

**Oplossing:**
1. Ga naar WordPress admin → Settings → Permalinks
2. Klik "Save Changes" (flush rewrite rules)
3. Test opnieuw

### Email komt niet aan

**Mogelijke oorzaken:**
1. ❌ WordPress SMTP niet geconfigureerd
2. ❌ Server kan geen emails versturen
3. ❌ Email in spam folder
4. ❌ WordPress email settings incorrect

**Oplossing:**
- Installeer WP Mail SMTP plugin
- Configureer met je email provider
- Test met: Plugins → WP Mail SMTP → Tools → Email Test

### Plugin activeert niet

**Mogelijke oorzaken:**
1. ❌ PHP syntax error
2. ❌ PHP versie te oud (< 7.4)
3. ❌ WordPress versie te oud (< 5.0)

**Oplossing:**
- Check error logs in wp-admin → Tools → Site Health
- Update PHP naar minimaal 7.4
- Update WordPress naar laatste versie

## 📝 Belangrijk

### Voor Development (localhost)
- ✅ Plugin moet geïnstalleerd zijn op **wasgeurtje.nl** (niet localhost)
- ✅ Next.js app op localhost roept wasgeurtje.nl API aan
- ✅ NEXT_PUBLIC_WORDPRESS_API_URL moet correct zijn in .env.local

### Voor Production
- ✅ Plugin moet actief zijn
- ✅ SMTP moet geconfigureerd zijn
- ✅ Test met meerdere email providers

## 🎉 Checklist

Na installatie, check af:

- [ ] Plugin geüpload naar WordPress
- [ ] Plugin geactiveerd
- [ ] cURL test succesvol (200 response)
- [ ] Email test succesvol (email ontvangen)
- [ ] Spam folder gecheckt
- [ ] SMTP plugin geïnstalleerd (indien nodig)
- [ ] Next.js checkout test succesvol
- [ ] Reset link werkt (nieuw wachtwoord instellen)
- [ ] Login met nieuw wachtwoord succesvol

## 🆘 Nog Steeds Geen Email?

1. **Test WordPress email direct:**
```php
// In WordPress admin → Tools → Site Health → Info → Copy site info
// Of voeg dit toe aan functions.php tijdelijk:
wp_mail('jouw@email.com', 'WordPress Test', 'Test of emails werken');
```

2. **Check WordPress debug log:**
```bash
# Enable in wp-config.php:
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);

# Dan check:
wp-content/debug.log
```

3. **Check server mail queue:**
```bash
mailq
# Of:
postfix flush
```

## 📞 Contact

Als het nog steeds niet werkt na al deze stappen:
1. Check of WordPress überhaupt emails kan versturen
2. Installeer WP Mail SMTP plugin (dit lost 90% van email problemen op)
3. Configureer SMTP met je email provider (Gmail, SendGrid, etc.)

---

**Status**: ✅ Code is klaar  
**Actie vereist**: WordPress plugin installeren  
**Verwachte tijd**: 5 minuten

