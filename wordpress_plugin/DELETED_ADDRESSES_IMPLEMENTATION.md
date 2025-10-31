# Customer Address Deletion Manager - Implementatie Guide

## 📦 WordPress Plugin Installatie

### Stap 1: Plugin Uploaden
```bash
# Upload naar WordPress
/wp-content/plugins/customer-address-deletion-manager.php
# OF voor automatisch laden:
/wp-content/mu-plugins/customer-address-deletion-manager.php
```

### Stap 2: Activeren
- Als in `/plugins/`: Ga naar WordPress Admin → Plugins → Activeer "Customer Address Deletion Manager"
- Als in `/mu-plugins/`: Automatisch geladen, geen activatie nodig

### Stap 3: Verifiëren
Bezoek: `https://jouwsite.nl/wp-json/custom/v1/deleted-addresses?email=test@example.com`

Je zou dit moeten zien:
```json
{
  "success": true,
  "data": {
    "customerId": 123,
    "email": "test@example.com",
    "deletedAddresses": [],
    "totalDeleted": 0
  }
}
```

---

## 🔌 API Endpoints

### 1️⃣ **Delete Address** (Adres verwijderen)
```http
POST /wp-json/custom/v1/delete-address
Content-Type: application/json

{
  "email": "customer@example.com",
  "addressId": "db32ab2"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Address deleted successfully",
  "data": {
    "addressId": "db32ab2",
    "deletedAddresses": ["db32ab2", "1edf692"],
    "totalDeleted": 2
  }
}
```

---

### 2️⃣ **Get Deleted Addresses** (Ophalen verwijderde adressen)
```http
GET /wp-json/custom/v1/deleted-addresses?email=customer@example.com
```

**Response:**
```json
{
  "success": true,
  "data": {
    "customerId": 123,
    "email": "customer@example.com",
    "deletedAddresses": ["db32ab2", "1edf692", "5e4315bf"],
    "totalDeleted": 3
  }
}
```

---

### 3️⃣ **Restore Address** (Adres herstellen)
```http
POST /wp-json/custom/v1/restore-address
Content-Type: application/json

{
  "email": "customer@example.com",
  "addressId": "db32ab2"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Address restored successfully",
  "data": {
    "addressId": "db32ab2",
    "deletedAddresses": ["1edf692"],
    "totalDeleted": 1
  }
}
```

---

### 4️⃣ **Clear All Deleted Addresses** (Alles wissen)
```http
POST /wp-json/custom/v1/clear-deleted-addresses
Content-Type: application/json

{
  "email": "customer@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "All deleted addresses cleared successfully",
  "data": {
    "clearedCount": 3
  }
}
```

---

## 🎨 Frontend Implementatie

### Optie A: Hybrid Approach (Aanbevolen)
Gebruik **zowel** localStorage (voor instant feedback) **als** server-side (voor sync tussen apparaten):

```typescript
// In checkout page
const [deletedAddressesServer, setDeletedAddressesServer] = useState<string[]>([]);

// Fetch deleted addresses from server on mount
useEffect(() => {
  const fetchDeletedAddresses = async () => {
    if (!user?.email) return;
    
    try {
      const response = await fetch(
        `/api/woocommerce/customer/deleted-addresses?email=${encodeURIComponent(user.email)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDeletedAddressesServer(data.data.deletedAddresses || []);
          
          // Merge with localStorage
          const localDeleted = JSON.parse(localStorage.getItem('deletedAddresses') || '[]');
          const merged = [...new Set([...localDeleted, ...data.data.deletedAddresses])];
          localStorage.setItem('deletedAddresses', JSON.stringify(merged));
        }
      }
    } catch (error) {
      console.error('Failed to fetch deleted addresses from server:', error);
    }
  };
  
  fetchDeletedAddresses();
}, [user?.email]);

// Updated delete handler
const handleDeleteAddress = async (addressId: string) => {
  console.log('🗑️ Deleting address:', addressId);
  
  // 1. Update UI immediately (localStorage)
  const deletedAddresses = JSON.parse(localStorage.getItem('deletedAddresses') || '[]');
  if (!deletedAddresses.includes(addressId)) {
    deletedAddresses.push(addressId);
    localStorage.setItem('deletedAddresses', JSON.stringify(deletedAddresses));
  }
  
  setPreviousAddresses(prev => prev.filter(addr => addr.id !== addressId));
  setAddressRefresh(prev => prev + 1);
  
  // 2. Sync with server (background)
  if (user?.email) {
    try {
      const response = await fetch('/api/woocommerce/customer/address/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          addressId: addressId,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Server sync successful:', data);
        setDeletedAddressesServer(data.data?.deletedAddresses || []);
      }
    } catch (error) {
      console.error('⚠️ Server sync failed (local delete still active):', error);
    }
  }
};
```

### Optie B: Server-Only (Meest robuust)
Gebruik **alleen** server-side storage:

```typescript
const handleDeleteAddress = async (addressId: string) => {
  if (!user?.email) {
    alert('Je moet ingelogd zijn om adressen te verwijderen');
    return;
  }
  
  // Show loading state
  setIsDeleting(true);
  
  try {
    const response = await fetch('/api/woocommerce/customer/address/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        addressId: addressId,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Update UI after server confirmation
      setPreviousAddresses(prev => prev.filter(addr => addr.id !== addressId));
      setAddressRefresh(prev => prev + 1);
      
      // Update state
      setDeletedAddressesServer(data.data?.deletedAddresses || []);
      
      console.log('✅ Address deleted successfully');
    } else {
      alert('Kon adres niet verwijderen. Probeer het opnieuw.');
    }
  } catch (error) {
    console.error('Error deleting address:', error);
    alert('Er ging iets mis. Probeer het opnieuw.');
  } finally {
    setIsDeleting(false);
  }
};
```

---

## 🔄 Next.js API Route (Nieuw)

Maak een nieuwe API route voor GET requests:

**File:** `web/src/app/api/woocommerce/customer/deleted-addresses/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }
    
    const baseUrl = process.env.WOOCOMMERCE_API_URL?.replace('/wp-json/wc/v3', '') 
                    || process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
    
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'WordPress API URL is not configured' },
        { status: 500 }
      );
    }
    
    const endpoint = `${baseUrl}/wp-json/custom/v1/deleted-addresses?email=${encodeURIComponent(email)}`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to fetch deleted addresses',
          data: { deletedAddresses: [] }
        },
        { status: response.status }
      );
    }
    
    const result = await response.json();
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error fetching deleted addresses:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        data: { deletedAddresses: [] }
      },
      { status: 500 }
    );
  }
}
```

---

## 🔧 WordPress Admin Interface

Na installatie is er een admin pagina beschikbaar:

**Locatie:** `WordPress Admin → Gebruikers → Deleted Addresses`

**Features:**
- Overzicht van alle klanten met verwijderde adressen
- API endpoint documentatie
- Real-time statistics
- Debug informatie

---

## 🧪 Testing

### Test 1: Verwijderen
```bash
curl -X POST https://jouwsite.nl/wp-json/custom/v1/delete-address \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@wasgeurtje.nl",
    "addressId": "db32ab2"
  }'
```

### Test 2: Ophalen
```bash
curl https://jouwsite.nl/wp-json/custom/v1/deleted-addresses?email=test@wasgeurtje.nl
```

### Test 3: Herstellen
```bash
curl -X POST https://jouwsite.nl/wp-json/custom/v1/restore-address \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@wasgeurtje.nl",
    "addressId": "db32ab2"
  }'
```

---

## 🗄️ Database Structuur

Verwijderde adressen worden opgeslagen in WordPress user meta:

```sql
SELECT * FROM wp_usermeta WHERE meta_key = 'deleted_addresses';
```

**Voorbeeld data:**
```
| umeta_id | user_id | meta_key          | meta_value                              |
|----------|---------|-------------------|-----------------------------------------|
| 12345    | 123     | deleted_addresses | a:3:{i:0;s:7:"db32ab2";i:1;s:7:"1edf692";i:2;s:8:"5e4315bf";} |
```

**Serialized format:**
```php
array(
  0 => "db32ab2",
  1 => "1edf692",
  2 => "5e4315bf"
)
```

---

## 🚀 Voordelen van deze Implementatie

### ✅ Multi-device Sync
Verwijderde adressen blijven gesynchroniseerd tussen:
- Desktop
- Mobiel
- Tablet
- Verschillende browsers

### ✅ Persistent Storage
Data blijft bewaard zelfs als klant:
- Browser cache wist
- Van apparaat wisselt
- Opnieuw inlogt

### ✅ Backwards Compatible
- Werkt met bestaande localStorage fallback
- Geen breaking changes
- Geleidelijke migratie mogelijk

### ✅ Admin Control
WordPress admin kan:
- Alle verwijderde adressen zien
- Adressen herstellen voor klanten
- Debug informatie bekijken

---

## 🔐 Security Overwegingen

### Email-based Authentication
- API gebruikt email als identifier
- Geen complexe auth vereist
- Geschikt voor publieke endpoints

### Rate Limiting (Optioneel)
Voeg rate limiting toe via WordPress plugin:

```php
// In plugin file
add_filter('rest_pre_dispatch', function($result, $server, $request) {
    $route = $request->get_route();
    
    if (strpos($route, '/custom/v1/') === 0) {
        // Check rate limit (bijv. 10 requests per minuut)
        $ip = $_SERVER['REMOTE_ADDR'];
        $transient_key = 'api_rate_limit_' . md5($ip);
        $count = get_transient($transient_key) ?: 0;
        
        if ($count > 10) {
            return new WP_Error(
                'rate_limit_exceeded',
                'Too many requests. Please try again later.',
                ['status' => 429]
            );
        }
        
        set_transient($transient_key, $count + 1, 60);
    }
    
    return $result;
}, 10, 3);
```

---

## 📊 Monitoring & Logging

De plugin logt alle acties wanneer `WP_DEBUG` is ingeschakeld:

```
[Address Deletion] User ID: 123 | Action: delete | Address ID: db32ab2 | Time: 2025-10-26 12:34:56
[Address Deletion] User ID: 123 | Action: restore | Address ID: 1edf692 | Time: 2025-10-26 12:35:10
[Address Deletion] User ID: 456 | Action: clear_all | Address ID: all | Time: 2025-10-26 12:36:00
```

**Log locatie:** `/wp-content/debug.log`

---

## 🆘 Troubleshooting

### Probleem: 404 Not Found
**Oplossing:** Refresh WordPress permalinks
```
WordPress Admin → Instellingen → Permalinks → Opslaan
```

### Probleem: Empty response
**Oplossing:** Check WP_DEBUG logs
```php
// In wp-config.php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
```

### Probleem: Customer not found
**Oplossing:** Verifieer email bestaat in WordPress
```sql
SELECT * FROM wp_users WHERE user_email = 'test@example.com';
```

---

## 📝 Next Steps

1. **Installeer plugin** in WordPress
2. **Test endpoints** met Postman/cURL
3. **Update frontend** code in checkout page
4. **Deploy** naar productie
5. **Monitor** logs voor eventuele issues

---

## 💡 Future Enhancements

### Optie 1: Expiration Date
Automatisch verwijderde adressen cleanup na X dagen:

```php
// In plugin
add_action('wp_scheduled_delete', function() {
    // Clean up deleted addresses older than 90 days
    global $wpdb;
    // Implementation...
});
```

### Optie 2: Restore UI
Voeg "Ongedaan maken" functionaliteit toe aan frontend:

```typescript
const handleRestoreAddress = async (addressId: string) => {
  // Call restore endpoint
  // Refresh address list
};
```

### Optie 3: Sync Status Indicator
Toon sync status in UI:
```
🟢 Gesynchroniseerd met server
🟡 Synchroniseren...
🔴 Offline (alleen lokaal opgeslagen)
```

---

**Vragen? Bekijk de admin pagina of check de logs!** 🚀

