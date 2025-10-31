# Customer Intelligence & Bundle Offer System - Documentatie

**Versie:** 1.0  
**Laatst bijgewerkt:** 30 oktober 2024  
**Status:** ✅ Productie Ready  

---

## 📚 Documentatie Overzicht

Deze documentatie beschrijft het complete Customer Intelligence & Bundle Offer System dat automatisch gepersonaliseerde bundelaanbiedingen genereert voor returning customers op basis van aankooppatronen, browser fingerprinting en IP-tracking.

---

## 🗂️ Documentatie Index

### 1. [**ARCHITECTURE.md**](./ARCHITECTURE.md) - Architectuur Overzicht
**Complete systeem architectuur en technische specificaties**

📖 **Inhoud:**
- Systeem overzicht en kernprincipes
- Technologie stack (WordPress, Next.js, Supabase)
- Architectuur componenten (WordPress backend, Next.js frontend, Database layer)
- Complete data flows
- Primaire functionaliteiten
- Security & Privacy (GDPR compliance)
- Performance optimizations
- Deployment instructies
- Troubleshooting

🎯 **Wanneer lezen:**
- Nieuwe developers die het systeem willen begrijpen
- Architectural reviews
- Technische planning en beslissingen

---

### 2. [**FILE_TREE.md**](./FILE_TREE.md) - File Tree & Bestand Uitleg
**Complete file structure met gedetailleerde uitleg per bestand**

📖 **Inhoud:**
- Complete file tree visualisatie
- **WordPress Plugin Files**:
  - `customer-intelligence-api.php` - Main plugin file
  - `class-rest-api.php` - REST API endpoints
  - `class-ip-tracker.php` - IP tracking & hashing
  - `class-device-tracker.php` - Multi-device tracking
  - `class-purchase-analyzer.php` - Purchase pattern analysis
  - `class-bundle-generator.php` - Bundle generation logic
  - `class-supabase-sync.php` - WordPress → Supabase sync
- **Next.js Frontend Files**:
  - API Routes: `track-customer/route.ts`, `bundle/route.ts`
  - Components: `GlobalBundleOfferManager.tsx`, `BundleOfferPopup.tsx`
  - Utilities: `fingerprint.ts`, `useCustomerTracking.ts`, `supabase.ts`
- File dependencies & import/export map

🎯 **Wanneer lezen:**
- Nieuwe code wijzigingen implementeren
- Debugging specifieke functionaliteit
- Code reviews
- Refactoring

---

### 3. [**DATA_FLOW.md**](./DATA_FLOW.md) - Data Flows & Logica
**Gedetailleerde data flows met complete end-to-end scenarios**

📖 **Inhoud:**
- **Complete End-to-End Flow**: Van eerste bezoek tot bundle acceptance
- **Customer Recognition Flow**: IP/fingerprint matching logic
- **Bundle Generation Flow**: Eligibility checks, composition algorithm, pricing calculation
- **Profile Recalculation Flow**: Automatic recalculation na order completion
- **Bundle Status Update Flow**: Status lifecycle (pending → viewed → accepted/rejected)
- **Data Synchronization Flow**: WordPress → Supabase sync mechanics

🎯 **Wanneer lezen:**
- Debugging data flow issues
- Understanding business logic
- Implementing nieuwe features die data manipuleren
- Performance optimization

---

### 4. [**API_REFERENCE.md**](./API_REFERENCE.md) - API Referentie
**Complete API documentatie met alle endpoints, parameters en responses**

📖 **Inhoud:**
- **WordPress REST API**:
  - `GET /intelligence/profile` - Get customer profile
  - `POST /intelligence/recalculate` - Trigger profile recalculation
  - `GET /intelligence/bundle` - Get/generate bundle offer
  - `POST /intelligence/bundle-status` - Update bundle status
- **Next.js API Routes**:
  - `POST /api/intelligence/track-customer` - Track customer session
  - `GET /api/intelligence/bundle` - Get bundle offer
- Authentication & Security
- Error Handling & Rate Limiting
- cURL examples voor testing

🎯 **Wanneer lezen:**
- API integratie implementeren
- Frontend-backend communicatie debuggen
- Postman/testing setup
- API versioning & backwards compatibility

---

### 5. [**DATABASE_SCHEMA.md**](./DATABASE_SCHEMA.md) - Database Schema
**Complete database structuur, relaties en queries**

📖 **Inhoud:**
- Database architectuur (Dual database: WordPress MySQL + Supabase PostgreSQL)
- **Supabase Tables**:
  - `customer_intelligence` - Customer profiles
  - `device_tracking` - Multi-device history
  - `bundle_offers` - Bundle offers
  - `behavioral_events` - Event logs
- **WordPress Tables**: MySQL equivalenten
- Table relationships & ER diagram
- Common queries (recognition, bundles, analytics)
- Indexes & Performance optimization
- Data migration & maintenance

🎯 **Wanneer lezen:**
- Database queries schrijven
- Performance optimization
- Data migrations
- Analytics & reporting
- Troubleshooting data issues

---

## 🚀 Quick Start

### Voor Developers

1. **Architectuur begrijpen**
   ```bash
   # Start met architectuur overzicht
   read docs/customer-intelligence-api/ARCHITECTURE.md
   ```

2. **File structuur verkennen**
   ```bash
   # Bekijk welke files wat doen
   read docs/customer-intelligence-api/FILE_TREE.md
   ```

3. **Data flows begrijpen**
   ```bash
   # Snap hoe data door het systeem stroomt
   read docs/customer-intelligence-api/DATA_FLOW.md
   ```

### Voor API Integratie

1. **API endpoints bekijken**
   ```bash
   read docs/customer-intelligence-api/API_REFERENCE.md
   ```

2. **Database queries schrijven**
   ```bash
   read docs/customer-intelligence-api/DATABASE_SCHEMA.md
   ```

### Voor Debugging

1. Check [DATA_FLOW.md](./DATA_FLOW.md) voor flow issues
2. Check [FILE_TREE.md](./FILE_TREE.md) voor specifieke file functionaliteit
3. Check [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) voor database queries
4. Check [ARCHITECTURE.md](./ARCHITECTURE.md) Troubleshooting sectie

---

## 🎯 Use Cases

### Use Case 1: Nieuwe Feature Implementeren
1. Lees **ARCHITECTURE.md** → Begrijp systeem design principles
2. Lees **FILE_TREE.md** → Identificeer welke files je moet wijzigen
3. Lees **DATA_FLOW.md** → Begrijp hoe data moet stromen
4. Lees **API_REFERENCE.md** → Check of je nieuwe API endpoints nodig hebt
5. Lees **DATABASE_SCHEMA.md** → Check of je database wijzigingen nodig hebt

### Use Case 2: Bug Fixen
1. Lees **DATA_FLOW.md** → Identificeer waar in de flow de bug zit
2. Lees **FILE_TREE.md** → Vind de verantwoordelijke file
3. Lees **ARCHITECTURE.md** → Check of het een architectural issue is
4. Lees **DATABASE_SCHEMA.md** → Verifieer database state

### Use Case 3: Performance Optimaliseren
1. Lees **ARCHITECTURE.md** → Performance Optimizations sectie
2. Lees **DATABASE_SCHEMA.md** → Indexes & Performance sectie
3. Lees **API_REFERENCE.md** → Rate Limiting sectie
4. Lees **DATA_FLOW.md** → Identificeer bottlenecks

### Use Case 4: API Integratie
1. Lees **API_REFERENCE.md** → Complete API specs
2. Lees **ARCHITECTURE.md** → Security & Authentication
3. Test met cURL examples uit API_REFERENCE.md

---

## 📊 Systeem Statistieken

### Components
- **WordPress Plugin**: 6 core classes
- **Next.js API Routes**: 3 endpoints
- **React Components**: 2 main components
- **Utilities**: 3 utility modules
- **Database Tables**: 4 Supabase + 4 WordPress tables

### Documentatie
- **Total Pages**: 5 comprehensive documents
- **Word Count**: ~45,000 words
- **Code Examples**: 100+ code snippets
- **Diagrams**: 15+ flow diagrams

---

## 🔄 Updates & Versioning

### Changelog

**v1.0 (30 oktober 2024) - Initial Release**
- ✅ Complete architectuur documentatie
- ✅ File tree met uitleg
- ✅ Complete data flows
- ✅ API reference met alle endpoints
- ✅ Database schema met queries
- ✅ 404 bundle-status fix gedocumenteerd
- ✅ Import path fixes gedocumenteerd
- ✅ Automatic bundle generation documented

---

## 💡 Tips & Best Practices

### Development Workflow

1. **Maak Wijzigingen in WordPress Eerst**
   - WordPress is source of truth
   - Supabase wordt automatisch gesynchroniseerd

2. **Test Altijd op localhost**
   - Use `http://localhost:3000` voor frontend testing
   - Use `https://wasgeurtje.nl/wp-json/wg/v1/` voor WordPress API testing

3. **Check Console Logs**
   - Frontend: `[Bundle]`, `[Tracking]` prefixes
   - WordPress: Check `wp-content/debug.log`
   - Supabase: Check Supabase dashboard logs

4. **Use Browser DevTools**
   - Check localStorage: `wg_device_fp`
   - Check network requests
   - Check console errors

### Debugging Checklist

✅ Is fingerprint opgeslagen in localStorage?  
✅ Is customer profile in Supabase?  
✅ Is device tracking record aanwezig?  
✅ Is bundle offer aangemaakt?  
✅ Is bundle status correct?  
✅ Is WordPress debug.log clean?  
✅ Zijn Next.js console logs clean?  

---

## 📞 Contact & Support

Voor vragen of issues met deze documentatie:

1. **Check de documentatie eerst** - 99% van vragen worden beantwoord
2. **Check WordPress debug.log** - Voor backend issues
3. **Check browser console** - Voor frontend issues
4. **Check Supabase logs** - Voor database issues

---

## 📝 Contributing

### Documentatie Updates

Als je deze documentatie wilt updaten:

1. Edit de relevante `.md` file in `docs/customer-intelligence-api/`
2. Update de **versie** en **laatst bijgewerkt** datum
3. Add entry to **Changelog** in deze README
4. Commit met duidelijke message: `docs: update [FILE] - [BESCHRIJVING]`

### Code Documentatie Standaarden

- **PHP Classes**: PHPDoc comments
- **TypeScript**: JSDoc comments
- **React Components**: Component description + Props interface
- **API Routes**: Function description + Request/Response examples

---

## 🎓 Learning Resources

### Recommended Reading Order (Nieuwe Developers)

1. **Week 1**: ARCHITECTURE.md (systeem overzicht)
2. **Week 2**: FILE_TREE.md (code structuur)
3. **Week 3**: DATA_FLOW.md (business logic)
4. **Week 4**: API_REFERENCE.md + DATABASE_SCHEMA.md (technical details)

### External Resources

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Supabase JavaScript Docs](https://supabase.com/docs/reference/javascript)
- [WordPress REST API Handbook](https://developer.wordpress.org/rest-api/)
- [WooCommerce REST API Docs](https://woocommerce.github.io/woocommerce-rest-api-docs/)

---

## ✨ Features Overzicht

### ✅ Geïmplementeerd

- [x] Browser fingerprinting (40+ data points)
- [x] IP-based recognition (SHA-256 hashed)
- [x] Multi-device tracking
- [x] Automatic profile recalculation
- [x] Dynamic bundle generation
- [x] Prime window prediction
- [x] Favorite products algorithm
- [x] Discount calculation (10-20%)
- [x] Loyalty points bonus
- [x] Bundle popup display
- [x] Status tracking (viewed, accepted, rejected)
- [x] WordPress → Supabase sync
- [x] Behavioral event logging
- [x] GDPR compliance

### 🔮 Toekomstige Verbeteringen

- [ ] Real-time Supabase updates (websockets)
- [ ] A/B testing voor bundles
- [ ] Email automation voor bundles
- [ ] Mobile app (React Native)
- [ ] Machine learning voor churn prediction
- [ ] Multi-language support
- [ ] Advanced analytics dashboard

---

## 🏆 Success Metrics

Track deze metrics om systeem succes te meten:

### Conversion Metrics
- Bundle view rate (% of recognized customers)
- Bundle acceptance rate (% of viewers who accept)
- Bundle purchase completion rate (% who actually buy)
- Average bundle value
- Revenue from bundles

### Recognition Metrics
- Customer recognition rate (% of returning visitors recognized)
- Fingerprint persistence rate (% still valid after 30 days)
- IP match accuracy
- Multi-device detection rate

### Performance Metrics
- API response times (< 200ms target)
- Database query performance
- Bundle generation speed
- Supabase sync latency

---

**🎉 Happy Coding!**

Voor meer details, zie de specifieke documentatie files hierboven.

