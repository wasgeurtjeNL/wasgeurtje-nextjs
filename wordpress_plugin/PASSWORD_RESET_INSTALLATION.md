# Password Reset API Plugin - Installatie Instructies

## 📦 Wat doet deze plugin?

Deze plugin voegt een WordPress REST API endpoint toe waarmee gebruikers hun wachtwoord kunnen resetten via de Next.js checkout pagina, zonder redirect naar wasgeurtje.nl.

## 🚀 Installatie Stappen

### Stap 1: Upload Plugin
1. Log in op je WordPress admin dashboard (wasgeurtje.nl/wp-admin)
2. Ga naar **Plugins** → **Add New** → **Upload Plugin**
3. Upload het bestand `password-reset-api.php`
4. Klik op **Install Now**

### Stap 2: Activeer Plugin
1. Klik op **Activate Plugin** na de installatie
2. De plugin heeft geen configuratie nodig en werkt meteen

## 🔍 Testen

### Test het endpoint direct:

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

### Test vanuit de Next.js app:
1. Ga naar http://localhost:3000/checkout
2. Klik op "Log in of registreer je"
3. Klik op "Wachtwoord vergeten?"
4. Vul een geldig e-mailadres in
5. Klik op "Verstuur resetlink"v
6. Controleer je inbox voor de reset email

## 📧 Email Voorbeeld

De gebruiker ontvangt een email met:
- **Onderwerp**: [Wasgeurtje.nl] Wachtwoord Reset
- **Inhoud**:
  ```
  Hoi,

  Er is een verzoek gedaan om het wachtwoord voor het volgende account te resetten:

  https://wasgeurtje.nl/

  Gebruikersnaam: [gebruikersnaam]

  Als dit een vergissing was, negeer deze e-mail dan en er zal niets gebeuren.

  Klik op de onderstaande link om een nieuw wachtwoord in te stellen:

  [reset link]

  Deze link is 24 uur geldig.

  Met vriendelijke groet,
  Het Wasgeurtje team
  ```

## 🔐 Security Features

1. **Email Enumeration Prevention**: De API geeft geen info of een email bestaat of niet
2. **Rate Limiting**: WordPress heeft ingebouwde rate limiting voor password resets
3. **Time-Limited Keys**: Reset links zijn 24 uur geldig
4. **Secure Key Generation**: WordPress's `get_password_reset_key()` functie wordt gebruikt

## 🐛 Troubleshooting

### Email wordt niet verstuurd

**Probleem**: De API geeft success, maar er komt geen email aan.

**Oplossingen**:

1. **Controleer WordPress email settings**:
   - Ga naar WordPress admin → Settings → General
   - Controleer of "WordPress Address" en "Site Address" correct zijn

2. **Test WordPress email functionaliteit**:
   ```php
   // Voeg dit toe aan functions.php om te testen
   wp_mail('jouw@email.com', 'Test Email', 'Dit is een test');
   ```

3. **Installeer een SMTP plugin**:
   - WP Mail SMTP (aanbevolen)
   - Easy WP SMTP
   - Post SMTP

4. **Controleer spam folder**

5. **Check server logs**:
   - De plugin logt errors in WordPress debug.log
   - Enable WordPress debug: `define('WP_DEBUG', true);` in wp-config.php

### Plugin activeert niet

**Probleem**: "Er is iets misgegaan bij het activeren van de plugin"

**Oplossing**: 
- Check de PHP versie (minimaal 7.4 vereist)
- Check de error log in wp-admin → Tools → Site Health → Info → Server

### API geeft 404 error

**Probleem**: Endpoint niet gevonden

**Oplossing**:
1. Ga naar WordPress admin → Settings → Permalinks
2. Klik op "Save Changes" (dit flush de rewrite rules)
3. Test het endpoint opnieuw

## 📝 API Documentatie

### Endpoint
```
POST /wp-json/custom/v1/password-reset
```

### Request Body
```json
{
  "email": "gebruiker@voorbeeld.com"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten een e-mail met instructies."
}
```

### Response (Error)
```json
{
  "error": "E-mailadres is verplicht"
}
```

### HTTP Status Codes
- `200` - Success (email sent or user doesn't exist)
- `400` - Bad Request (invalid email format)
- `500` - Server Error (failed to send email)

## 🔧 Configuratie Opties

De plugin werkt out-of-the-box, maar je kunt het email template aanpassen door de `send_password_reset_email()` functie in de plugin te wijzigen.

### Email Template Aanpassen

```php
// In password-reset-api.php, regel ~90
$message = __('Jouw custom bericht hier...') . "\r\n\r\n";
```

## ⚙️ WordPress Filters

De plugin gebruikt standaard WordPress functies, dus alle WordPress filters voor emails werken:

```php
// In functions.php
add_filter('wp_mail_from', function($email) {
    return 'noreply@wasgeurtje.nl';
});

add_filter('wp_mail_from_name', function($name) {
    return 'Wasgeurtje.nl';
});
```

## 📊 Monitoring

Check WordPress error logs voor password reset activiteit:

```bash
tail -f /path/to/wp-content/debug.log | grep "Password reset"
```

## ✅ Checklist na Installatie

- [ ] Plugin geactiveerd
- [ ] Test endpoint werkt (curl test)
- [ ] Test email wordt verstuurd (gebruik je eigen email)
- [ ] SMTP plugin geïnstalleerd (indien nodig)
- [ ] Spam folder gecheckt
- [ ] Next.js app test succesvol
- [ ] Production test succesvol

## 🆘 Support

Bij problemen:
1. Check de troubleshooting sectie hierboven
2. Check WordPress debug logs
3. Check Next.js console logs
4. Test het endpoint direct met curl

---

**Plugin Versie**: 1.0.0  
**WordPress Versie**: 5.0+  
**PHP Versie**: 7.4+

