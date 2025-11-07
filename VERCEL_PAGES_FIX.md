# Fix: Pages Not Working on Vercel (404 Errors)

## Problem
Pages like `/veel-gestelde-vragen` were returning 404 errors on Vercel but worked fine on localhost.

## Root Cause
The dynamic page route `[...slug]/page.tsx` was trying to fetch data from:
```
${process.env.NEXT_PUBLIC_SITE_URL}/api/wordpress/pages?slug=${slugPath}
```

When `NEXT_PUBLIC_SITE_URL` was not set in Vercel, it defaulted to `http://localhost:3000`, causing the fetch to fail in production.

Additionally, the code had a fallback to `window.location.origin`, but this doesn't work in Server Components (server-side) where `window` is undefined.

## Solution
Changed the implementation to fetch directly from the WordPress API instead of going through an internal API route:

### Changes Made:
1. **Direct WordPress API calls**: Both `generateMetadata()` and the main component now fetch directly from WordPress
2. **Removed dependency on NEXT_PUBLIC_SITE_URL**: No longer needed for page fetching
3. **Proper response handling**: Transform WordPress API responses to match expected format
4. **Include necessary fields**: Added `acf_format=standard` and `_fields` parameters to get all required data

### Benefits:
- ✅ Works on Vercel without needing NEXT_PUBLIC_SITE_URL
- ✅ Reduces API route complexity
- ✅ Faster response (one less hop)
- ✅ More reliable (no server-side URL resolution issues)

## Technical Details

### Before:
```typescript
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
const response = await fetch(`${baseUrl}/api/wordpress/pages?slug=${slugPath}`);
```

### After:
```typescript
const WP_API_URL = process.env.WORDPRESS_API_URL || 
                   process.env.NEXT_PUBLIC_WORDPRESS_API_URL || 
                   'https://api.wasgeurtje.nl/wp-json/wp/v2';
const response = await fetch(
  `${WP_API_URL}/pages?slug=${slugPath}&acf_format=standard&_fields=id,title,content,excerpt,slug,date,modified,status,featured_media,acf,yoast_head_json`
);
```

## Files Modified
- `web/src/app/[...slug]/page.tsx`
  - Updated `generateMetadata()` function
  - Updated main component data fetching
  - Added proper response transformation

## Testing
After deployment, verify:
- [ ] `/veel-gestelde-vragen` works on Vercel
- [ ] Other dynamic pages work (e.g., `/ons-verhaal`, `/contact`)
- [ ] SEO metadata is properly set
- [ ] ACF content renders correctly

## Environment Variables
The fix uses these environment variables (in order of priority):
1. `WORDPRESS_API_URL` (server-side only)
2. `NEXT_PUBLIC_WORDPRESS_API_URL` (available on both server and client)
3. Fallback: `https://api.wasgeurtje.nl/wp-json/wp/v2`

Note: With the fallback, no environment variables are strictly required for basic functionality.

