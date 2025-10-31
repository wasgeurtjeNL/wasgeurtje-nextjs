# WP Loyalty Points API - Installatie Instructies

## Overzicht

Deze WordPress plugin maakt een REST API endpoint aan om loyalty punten op te halen via email address.

**Endpoint:** `https://wasgeurtje.nl/wp-json/my/v1/loyalty/points?email={email}`

## Vereisten

- WordPress website (wasgeurtje.nl)
- WP Loyalty plugin geïnstalleerd en geactiveerd
- FTP of File Manager toegang tot WordPress

## Installatie Methode 1: Upload via WordPress Admin (Aanbevolen)

### Stap 1: Maak een ZIP bestand
1. Maak een map aan met de naam `wp-loyalty-points-api`
2. Plaats het bestand `wp-loyalty-points-api.php` in deze map
3. Maak een ZIP bestand van deze map (rechtsklik → Verzenden naar → Gecomprimeerde map)

### Stap 2: Upload plugin
1. Log in op WordPress admin (https://wasgeurtje.nl/wp-admin)
2. Ga naar **Plugins → Add New**
3. Klik op **Upload Plugin** (bovenaan de pagina)
4. Klik op **Choose File** en selecteer het ZIP bestand
5. Klik op **Install Now**

### Stap 3: Activeer de plugin
1. Na installatie, klik op **Activate Plugin**
2. Je ziet een bevestigingsbericht als de plugin succesvol is geactiveerd

## Installatie Methode 2: FTP Upload

### Stap 1: Upload bestand
1. Verbind met je WordPress website via FTP (bijv. FileZilla)
2. Navigeer naar: `/wp-content/plugins/`
3. Maak een nieuwe map aan: `wp-loyalty-points-api`
4. Upload `wp-loyalty-points-api.php` naar deze map

### Stap 2: Activeer de plugin
1. Log in op WordPress admin
2. Ga naar **Plugins → Installed Plugins**
3. Zoek **WP Loyalty Points API**
4. Klik op **Activate**

## Installatie Methode 3: File Manager (cPanel)

### Stap 1: Via cPanel File Manager
1. Log in op cPanel
2. Open **File Manager**
3. Navigeer naar `public_html/wp-content/plugins/`
4. Klik op **+ File** om een nieuw bestand aan te maken
5. Naam het bestand: `wp-loyalty-points-api.php`
6. Rechtsklik op het bestand → **Edit**
7. Plak de volledige code uit `wp-loyalty-points-api.php`
8. Klik op **Save Changes**

### Stap 2: Activeer de plugin
1. Log in op WordPress admin
2. Ga naar **Plugins → Installed Plugins**
3. Zoek **WP Loyalty Points API**
4. Klik op **Activate**

## Verificatie

### Test de endpoint

1. Open je browser en ga naar:
   ```
   https://wasgeurtje.nl/wp-json/my/v1/loyalty/points?email=test@example.com
   ```
   (vervang `test@example.com` met een echt email adres van een klant)

2. Je zou een JSON response moeten zien zoals:
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

3. Als er geen loyalty data is voor het email adres:
   ```json
   {
     "points": 0,
     "earned": 0,
     "level_id": 0,
     "refer_code": "",
     "used_points": 0,
     "status": "not_found",
     "message": "No loyalty data found for this email"
   }
   ```

### Test vanuit je applicatie

Open de browser developer console op je checkout pagina en voer uit:
```javascript
fetch('https://wasgeurtje.nl/wp-json/my/v1/loyalty/points?email=test@example.com')
  .then(res => res.json())
  .then(data => console.log('Loyalty data:', data));
```

## Response Format

De endpoint retourneert de volgende data:

| Veld | Type | Beschrijving |
|------|------|--------------|
| `points` | integer | Huidige beschikbare punten |
| `earned` | integer | Totaal verdiende punten (lifetime) |
| `level_id` | integer | Huidige loyalty level ID |
| `refer_code` | string | Referral code van de gebruiker |
| `used_points` | integer | Totaal gebruikte punten |
| `status` | string | `success` of `not_found` |

## Troubleshooting

### Error: "WP Loyalty plugin table not found"
**Oplossing:** WP Loyalty plugin is niet geïnstalleerd of geactiveerd
1. Ga naar **Plugins → Installed Plugins**
2. Zoek **WP Loyalty** 
3. Klik op **Activate** als het niet actief is
4. Als het niet aanwezig is, installeer het eerst via **Plugins → Add New**

### Error: 404 Not Found
**Oplossing:** Plugin is niet geactiveerd of permalinks moeten worden vernieuwd
1. Ga naar **Settings → Permalinks**
2. Klik gewoon op **Save Changes** (zonder iets te wijzigen)
3. Dit vernieuwt de rewrite rules

### Error: "Invalid email format"
**Oplossing:** Zorg dat je een geldig email adres meegeeft
```
✅ Correct: ?email=klant@example.com
❌ Fout:    ?email=invalid-email
```

### Error: CORS blokkering
**Oplossing:** De plugin heeft al CORS headers ingesteld. Als het nog steeds niet werkt:
1. Controleer of je WordPress site HTTPS gebruikt
2. Controleer je browser console voor specifieke CORS errors

### Debug logs bekijken
De plugin logt alle requests naar het WordPress error log:
1. Schakel WordPress debugging in via `wp-config.php`:
   ```php
   define( 'WP_DEBUG', true );
   define( 'WP_DEBUG_LOG', true );
   ```
2. Bekijk logs in: `/wp-content/debug.log`

## Deactivatie

Als je de endpoint wilt verwijderen:
1. Ga naar **Plugins → Installed Plugins**
2. Zoek **WP Loyalty Points API**
3. Klik op **Deactivate**
4. Klik op **Delete** om de plugin volledig te verwijderen

## Beveiliging

- De endpoint is **publiek toegankelijk** (geen authenticatie vereist)
- Email adressen worden gevalideerd en gesanitized
- Geen gevoelige informatie wordt geretourneerd
- CORS is ingeschakeld voor alle origins (kan worden beperkt indien nodig)

## Support

Voor vragen of problemen:
1. Controleer de WordPress error logs
2. Test de endpoint in je browser
3. Bekijk de Network tab in browser DevTools

## Wijzigingen & Updates

### Versie 1.0.0 (Huidige versie)
- Initiele release
- GET endpoint voor loyalty punten ophalen via email
- CORS support
- Error handling en logging
- Email validatie

