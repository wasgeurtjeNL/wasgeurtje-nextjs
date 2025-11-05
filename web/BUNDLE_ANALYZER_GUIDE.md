# 📊 Bundle Analyzer Guide

## Installatie Compleet ✅

De Bundle Analyzer is succesvol geïnstalleerd en geconfigureerd!

## 🚀 Hoe te Gebruiken

### Optie 1: Volledige Bundle Analyse (Aanbevolen)
```bash
npm run analyze
```
Dit analyseert zowel client als server bundles en opent automatisch 2 browser tabs met visuele treemaps.

### Optie 2: Alleen Client Bundle
```bash
npm run analyze:browser
```
Analyseert alleen wat naar de browser wordt gestuurd (wat gebruikers downloaden).

### Optie 3: Alleen Server Bundle
```bash
npm run analyze:server
```
Analyseert alleen server-side code (API routes, getServerSideProps, etc.).

## 📖 De Resultaten Lezen

### Wat je ziet:
- **Interactieve Treemap**: Elke rechthoek = een module/package
- **Grootte = Visuele grootte**: Grotere rechthoeken = meer bytes
- **Kleuren**: Verschillende packages hebben verschillende kleuren

### Belangrijke Metrics:
- **Stat Size**: Originele bestandsgrootte
- **Parsed Size**: Na compilation/transpilation
- **Gzipped Size**: Wat gebruikers daadwerkelijk downloaden ⭐ (belangrijkst!)

## 🎯 Waar op te Letten

### ⚠️ Red Flags (grote bundles):
1. **node_modules packages > 100 KB** (ongezipped)
   - Overweeg lichtere alternatieven
   - Check of je de hele library importeert vs. specifieke functie

2. **Duplicate packages**
   - Meerdere versies van hetzelfde package
   - Los op via package.json resolutions

3. **Onverwachte dependencies**
   - Packages die je niet herkent
   - Mogelijk imported maar niet gebruikt

### ✅ Optimalisatie Tips:

#### 1. **Large Dependencies Vervangen**
```javascript
// ❌ Slecht - hele library
import _ from 'lodash'

// ✅ Goed - specifieke functie
import debounce from 'lodash/debounce'
```

#### 2. **Dynamic Imports** (al geïmplementeerd! ✅)
```javascript
// Heavy component only when needed
const HeavyComponent = dynamic(() => import('./HeavyComponent'))
```

#### 3. **Tree Shaking Checken**
- Zorg dat packages ES6 modules gebruiken
- Check `package.json` → `"sideEffects": false`

## 📈 Benchmark Cijfers

### Uitstekend:
- **Total JS**: < 200 KB (gzipped)
- **Initial JS**: < 100 KB (gzipped)
- **Largest chunk**: < 50 KB (gzipped)

### Goed:
- **Total JS**: 200-400 KB (gzipped)
- **Initial JS**: 100-200 KB (gzipped)
- **Largest chunk**: 50-100 KB (gzipped)

### Needs Work:
- **Total JS**: > 400 KB (gzipped)
- **Initial JS**: > 200 KB (gzipped)
- **Largest chunk**: > 100 KB (gzipped)

## 🔍 Analyse Workflow

1. **Run analyze**: `npm run analyze`
2. **Bekijk treemap** in browser
3. **Identificeer grote packages**
4. **Check of ze nodig zijn**:
   - Wordt het echt gebruikt?
   - Kan het lazy-loaded worden?
   - Is er een lichtere alternatief?
5. **Implementeer optimalisaties**
6. **Run opnieuw** en vergelijk resultaten

## 💡 Quick Wins

### 1. Moment.js → date-fns of dayjs
```bash
# Moment.js = ~70 KB (gzipped)
# date-fns = ~5-10 KB per functie
# dayjs = ~2 KB
```

### 2. Lodash → lodash-es
```bash
# Betere tree-shaking support
npm install lodash-es
```

### 3. Icons Libraries
```javascript
// ❌ Hele icon library
import { FaHome, FaUser } from 'react-icons/fa'  // 30+ KB

// ✅ Specifieke icons
import FaHome from 'react-icons/fa/FaHome'  // ~1 KB
```

## 🎨 Voorbeeldresultaten

Na het draaien van `npm run analyze` zie je bijvoorbeeld:

```
Page                                       Size     First Load JS
┌ ○ /                                     5.2 kB         120 kB
├ ○ /about                                1.1 kB         116 kB
├ ○ /blog                                 3.5 kB         118 kB
└ ○ /blog/[slug]                          8.2 kB         123 kB

○  (Static)  prerendered as static content
```

## 📞 Hulp Nodig?

- **Next.js Docs**: https://nextjs.org/docs/app/building-your-application/optimizing/bundle-analyzer
- **Web.dev Guide**: https://web.dev/optimize-javascript/
- **Bundle Phobia**: https://bundlephobia.com (check package sizes)

---

Happy Optimizing! 🚀






