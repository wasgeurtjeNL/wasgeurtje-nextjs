# 🎯 Loyaliteitscoupon Validatie & Verzendkosten Fix

## Implementatie Datum
5 november 2025

## 📋 Overzicht

Deze implementatie voegt twee belangrijke functionaliteiten toe aan de checkout:

1. **Loyaliteitscoupon Validatie**: Regel van 2 producten per loyaliteitskorting
2. **Verzendkosten Fix**: Verzendkosten berekend op bedrag ná kortingen (niet ervoor)

---

## ✅ 1. Loyaliteitscoupon Validatie (2 producten = 1 coupon)

### Doel
Klanten mogen **maximaal 1 loyaliteitskorting gebruiken per 2 producten** in hun winkelwagen.

### Regel
```
max_loyaltycoupons = floor(aantal_producten / 2)
```

### Voorbeelden

| Producten | Max Loyaliteitscoupons | Actie |
|-----------|------------------------|-------|
| 1 | 0 | ❌ Alle loyalty coupons verwijderd |
| 2 | 1 | ✅ 1 loyalty coupon toegestaan |
| 3 | 1 | ✅ 1 loyalty coupon toegestaan |
| 4 | 2 | ✅ 2 loyalty coupons toegestaan |
| 5 | 2 | ✅ 2 loyalty coupons toegestaan |
| 6 | 3 | ✅ 3 loyalty coupons toegestaan |

### Implementatie Details

**Nieuwe Context:** `web/src/context/LoyaltyCouponValidationContext.tsx`

**Features:**
- ✅ Real-time validatie bij cart wijzigingen
- ✅ Automatisch verwijderen van overtollige coupons
- ✅ Tijdelijke opslag van verwijderde coupons
- ✅ Automatisch herstel bij toevoegen van producten
- ✅ Duidelijke gebruikersfeedback

**Herkenning Loyaliteitscoupons:**
- Codes die beginnen met `LOYALTY-`
- Codes die `loyalty` of `points` bevatten (case-insensitive)

**Gebruikersberichten:**
```
⚠️ Loyaliteitspunten:
   Er zijn te veel loyaliteitskortingen toegepast. 
   Regel: minimaal 2 flessen per kortingscode. 
   💡 Voeg nog 2 producten toe om uw volgende loyaliteitspunt te gebruiken.

✅ Loyaliteitspunten:
   Uw loyaliteitskorting(en) zijn opnieuw toegepast, 
   bedankt voor het toevoegen van extra producten!

💡 Loyaliteitspunten:
   Loyaliteitspunten zijn pas geldig vanaf 2 flessen per kortingscode.
```

### Gebruikersscenario's

#### Scenario 1: Te weinig producten
```
Stap 1: Klant heeft 3 producten + 2 loyaliteitscoupons
Actie:  Max toegestaan = floor(3/2) = 1 coupon
        → 1 coupon wordt tijdelijk verwijderd
        → Bericht: "💡 Voeg nog 2 producten toe..."

Stap 2: Klant voegt 1 product toe (nu 4 producten)
Actie:  Max toegestaan = floor(4/2) = 2 coupons
        → Verwijderde coupon wordt automatisch hersteld
        → Bericht: "✅ Uw loyaliteitskorting(en) zijn opnieuw toegepast!"
```

#### Scenario 2: Te weinig voor een coupon
```
Stap 1: Klant heeft 1 product + 1 loyaliteitscoupon
Actie:  Max toegestaan = floor(1/2) = 0 coupons
        → Coupon wordt verwijderd
        → Bericht: "Loyaliteitspunten zijn pas geldig vanaf 2 flessen"
```

---

## ✅ 2. Verzendkosten Fix (Drempelwaarde na kortingen)

### Probleem (Oud)
Verzendkosten werden berekend op het **subtotaal vóór kortingen**:

```
Subtotaal:          €44.85 (> €40)
Verzendkosten:      €0.00 ❌ (gratis - FOUT!)
Loyaliteitskorting: -€13.00
---
Eindtotaal:         €31.85 (te laag)
```

### Oplossing (Nieuw)
Verzendkosten worden nu berekend op het **bedrag ná alle kortingen**:

```
Subtotaal:          €44.85
Loyaliteitskorting: -€13.00
---
Bedrag na korting:  €31.85 (< €40)
Verzendkosten:      €4.95 ✅ (correct!)
---
Eindtotaal:         €36.80 (correct)
```

### Code Wijzigingen

**Oude logica:**
```typescript
const calculateShipping = () => {
  return subtotal >= 40 ? 0 : 4.95; // ❌ Gebaseerd op subtotaal vóór kortingen
};
```

**Nieuwe logica:**
```typescript
const calculateShipping = () => {
  // Bereken alle kortingen
  const regularDiscount = calculateDiscount();       // Reguliere kortingscodes
  const loyaltyDiscount = getLoyaltyDiscountTotal(); // Loyaliteitskortingen
  const volumeDiscount = calculateVolumeDiscount();  // Volume korting
  const bundleDiscount = calculateBundleDiscount();  // Bundle korting
  
  // Bereken subtotaal ná kortingen
  const totalDiscount = regularDiscount + loyaltyDiscount + volumeDiscount + bundleDiscount;
  const subtotalAfterDiscounts = Math.max(0, subtotal - totalDiscount);
  
  // Gratis verzending als bedrag ná kortingen >= €40
  return subtotalAfterDiscounts >= 40 ? 0 : 4.95; // ✅ Correct!
};
```

### Helper Functions

Nieuwe helper functies voor consistente shipping status checks:

```typescript
// Check of gratis verzending is behaald (na kortingen)
const hasReachedFreeShipping = () => {
  const totalDiscount = /* alle kortingen */;
  const subtotalAfterDiscounts = Math.max(0, subtotal - totalDiscount);
  return subtotalAfterDiscounts >= 40;
};

// Bereken progress percentage (na kortingen)
const getShippingProgress = () => {
  const subtotalAfterDiscounts = /* bedrag na kortingen */;
  return Math.min((subtotalAfterDiscounts / 40) * 100, 100);
};

// Bereken resterend bedrag voor gratis verzending (na kortingen)
const getRemainingForFreeShipping = () => {
  const subtotalAfterDiscounts = /* bedrag na kortingen */;
  return Math.max(0, 40 - subtotalAfterDiscounts);
};
```

### UI Updates

Alle UI elementen zijn bijgewerkt om de nieuwe logica te gebruiken:

- ✅ Progress bars tonen correcte percentage na kortingen
- ✅ "Nog €X voor gratis verzending" berekend na kortingen
- ✅ Gratis verzending badge toont alleen bij correcte drempel
- ✅ Mobile en desktop versies beide consistent

---

## 📦 Bestanden Gewijzigd

### Nieuwe Bestanden
- `web/src/context/LoyaltyCouponValidationContext.tsx` - Context voor loyaliteit validatie

### Gewijzigde Bestanden
- `web/src/app/checkout/page.tsx` - Integratie van loyaliteit validatie en verzendkosten fix
- `web/src/app/layout.tsx` - Provider setup voor nieuwe context

---

## 🔧 Technische Details

### Provider Hiërarchie
```typescript
<AuthProvider>
  <CartProvider>
    <LoyaltyCouponValidationProvider> // 🆕 Nieuwe provider
      <LoyalityProvider>
        {children}
      </LoyalityProvider>
    </LoyaltyCouponValidationProvider>
  </CartProvider>
</AuthProvider>
```

### State Management

**Loyaliteit Validatie State:**
- `activeLoyaltyCoupons`: Array van actieve loyaliteitskortingen
- `temporarilyRemovedLoyaltyCoupons`: Array van tijdelijk verwijderde coupons
- `loyaltyValidationMessage`: Feedback bericht voor gebruiker

**Gescheiden Systemen:**
- **Loyaliteitscoupons**: Beheerd door `LoyaltyCouponValidationContext`
- **Reguliere kortingscodes**: Beheerd door bestaande `appliedDiscount` state

---

## 🎯 Gebruikerservaring

### Feedback bij Cart Wijzigingen

**Te veel loyaliteitscoupons:**
```
⚠️ Loyaliteitspunten:
   Er zijn te veel loyaliteitskortingen toegepast.
   Regel: minimaal 2 flessen per kortingscode. 
   (3 loyalty-codes gebruikt, 1 toegestaan)
   💡 Voeg nog 4 producten toe om uw volgende loyaliteitspunt te gebruiken.
```

**Automatisch herstel:**
```
✅ Loyaliteitspunten:
   Uw loyaliteitskorting(en) zijn opnieuw toegepast, 
   bedankt voor het toevoegen van extra producten!
```

**Actieve loyaliteitskortingen:**
```
🎯 Actieve loyaliteitskortingen:
   [4 producten = max 2 coupons]
   
   LOYALTY-ABC123-XYZ - €13.00 [Verwijder]
   LOYALTY-DEF456-UVW - €13.00 [Verwijder]
   
   Regel: 2 producten per loyaliteitskorting. 
   Totaal: €26.00 bespaard.
```

---

## 🧪 Testing Checklist

### Loyaliteitscoupon Validatie
- [x] 2 producten + 1 loyalty coupon → ✅ Toegestaan
- [x] 1 product + 1 loyalty coupon → ❌ Coupon verwijderd
- [x] 3 producten + 2 loyalty coupons → ❌ 1 coupon verwijderd
- [x] Product toevoegen → ✅ Coupon automatisch hersteld
- [x] Product verwijderen → ❌ Extra coupons verwijderd
- [x] Reguliere kortingscodes → ✅ Blijven werken zonder restricties

### Verzendkosten Berekening
- [x] €50 subtotaal - €10 korting = €40 → ✅ €0.00 verzending
- [x] €50 subtotaal - €15 korting = €35 → ✅ €4.95 verzending
- [x] €35 subtotaal - €0 korting = €35 → ✅ €4.95 verzending
- [x] Progress bar toont correcte percentage na kortingen
- [x] "Nog €X" bericht toont correct bedrag na kortingen

---

## 🚀 Deployment Notes

### Build Status
✅ Build succesvol (Next.js 15.5.2)
✅ Geen TypeScript errors
✅ Geen linting errors
✅ Backwards compatible met bestaande code

### Environment Variables
Geen nieuwe environment variables nodig.

### Database Changes
Geen database wijzigingen nodig.

---

## 📊 Impact Analysis

### Wat werkt anders:

1. **Loyaliteitscoupons**: Nu gevalideerd op 2-producten regel
2. **Verzendkosten**: Berekend op eindtotaal na kortingen
3. **Progress bars**: Tonen accurate shipping progress na kortingen

### Wat blijft hetzelfde:

1. **Reguliere kortingscodes**: Geen restricties, blijven ongewijzigd werken
2. **Volume kortingen**: Blijven werken zoals voorheen
3. **Bundle kortingen**: Blijven werken zoals voorheen
4. **Bestaande checkout flow**: Geen breaking changes

---

## 💡 Toekomstige Verbeteringen

### Mogelijke Uitbreidingen:
- [ ] Configureerbare ratio (bijv. 3 producten = 1 coupon)
- [ ] Admin panel om regels aan te passen
- [ ] Analytics tracking voor coupon verwijderingen/herstel
- [ ] A/B testing voor verschillende ratios

### Optimalisaties:
- [ ] localStorage persistentie voor verwijderde coupons
- [ ] Preemptive warnings voor klanten (bijv. "Let op: bij verwijderen van dit product verliest u een loyaliteitskorting")

---

## 🔍 Code Locaties

### Loyaliteit Validatie
- **Context**: `web/src/context/LoyaltyCouponValidationContext.tsx`
- **Integration**: `web/src/app/checkout/page.tsx` (regels 74-84, 279-387)
- **Provider**: `web/src/app/layout.tsx` (regel 136)

### Verzendkosten Fix
- **Main Logic**: `web/src/app/checkout/page.tsx` 
  - `calculateShipping()` (regel 2121-2132)
  - `calculateTotal()` (regel 2162-2175)
  - Helper functions (regel 280-311)

### UI Componenten
- **LoyaltyValidationMessage**: Regel 313-355
- **ActiveLoyaltyCoupons**: Regel 357-387
- **Shipping Progress**: Diverse locaties (geupdate met nieuwe helper functies)

---

## ⚠️ Belangrijke Notities

### Alleen voor Loyaliteitscoupons
Deze validatie geldt **alleen** voor loyaliteitscoupons, niet voor:
- ❌ Reguliere promotiecodes (bijv. SUMMER20, WELCOME10)
- ❌ Referral codes
- ❌ Bundle kortingen
- ❌ Volume kortingen

### Herkenning
Loyaliteitscoupons worden automatisch herkend door:
- Code begint met `LOYALTY-`
- Code bevat `loyalty` of `points`

### Backwards Compatible
Alle bestaande functionaliteit blijft werken:
- ✅ Oude orders worden niet beïnvloed
- ✅ Bestaande kortingscodes blijven werken
- ✅ Geen data migratie nodig

---

## 🎨 UX/UI Verbeteringen

### Kleurenschema
- **Errors**: Oranje achtergrond (`bg-orange-50`) voor zachte waarschuwing
- **Success**: Groen achtergrond (`bg-green-50`) voor bevestiging
- **Info**: Blauw achtergrond (`bg-blue-50`) voor tips
- **Active Coupons**: Amber achtergrond (`bg-amber-50`) voor loyaliteit

### Iconen
- ⚠️ Voor foutmeldingen
- ✅ Voor succesmeldingen
- 💡 Voor tips en suggesties
- 🎯 Voor loyaliteit sectie

---

## 📞 Support & Troubleshooting

### Veelvoorkomende Vragen

**Q: Waarom wordt mijn loyaliteitskorting verwijderd?**
A: Je hebt minimaal 2 producten nodig per loyaliteitskorting. Voeg meer producten toe om de korting weer te activeren.

**Q: Waarom betaal ik toch verzendkosten terwijl mijn subtotaal > €40 was?**
A: Verzendkosten worden berekend op het bedrag ná kortingen. Als je eindtotaal door kortingen onder €40 komt, gelden verzendkosten van €4.95.

**Q: Werken reguliere kortingscodes nog steeds?**
A: Ja! Reguliere promotiecodes hebben geen restricties en werken gewoon zoals voorheen.

### Debug Informatie

Bij problemen, controleer browser console voor:
```
🔄 Loyalty validation triggered
⚠️ Coupon removed: LOYALTY-ABC123
✅ Coupon restored: LOYALTY-ABC123
```

---

## ✨ Conclusie

De implementatie is succesvol voltooid en getest. Het systeem biedt:

1. **Eerlijke pricing**: Verzendkosten correct berekend
2. **Duidelijke regels**: 2 producten = 1 loyaliteitskorting
3. **Automatische validatie**: Geen handmatige controles nodig
4. **Gebruiksvriendelijk**: Duidelijke feedback en automatisch herstel
5. **Backwards compatible**: Alle bestaande functionaliteit werkt nog steeds

**Status**: ✅ Production Ready



