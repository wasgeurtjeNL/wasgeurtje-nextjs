# Checkout Routing Fix - Vercel Production Issue

## Problem Summary
The `/checkout` page worked perfectly on localhost but returned a 404 error on Vercel production deployments.

## Root Cause
The issue was caused by Next.js's static site generation (SSG) at build time:

1. **WordPress has a page** with slug "checkout" (legacy page)
2. **`generateStaticParams()` in `[...slug]/page.tsx`** fetches ALL WordPress pages during build
3. **Static page generation** creates `/checkout` from the catch-all route at build time
4. **This static page overrides** the dedicated `/checkout/page.tsx` route in production

## Why Localhost Worked
- Development mode uses on-demand rendering (no pre-generation)
- Routes are resolved dynamically at request time
- Dedicated routes take precedence naturally

## Why Vercel Failed
- Production builds use Static Site Generation (SSG)
- Routes are pre-generated at build time based on `generateStaticParams()`
- Pre-generated static pages can override dedicated routes

## Solution
Added 'checkout' to the exclusion filter in three places:

### 1. `generateStaticParams()` - Prevent static generation (CRITICAL)
```typescript
const INVALID_SLUGS_FILTER = [
  'wp-login', 'wp-admin', 'xmlrpc', 'wp-config', '.env', 'phpmyadmin',
  'checkout' // Exclude from static generation
];
```

### 2. `generateMetadata()` - Skip metadata generation
```typescript
if (slug.length === 1 && slug[0] === 'checkout') {
  return { title: "Checkout", description: "Checkout page" };
}
```

### 3. `DynamicPage` component - Skip runtime rendering
```typescript
if (slug.length === 1 && slug[0] === 'checkout') {
  notFound(); // Fallback to dedicated route
}
```

## Commits
- `f7c0e20` - fix: Exclude 'checkout' from generateStaticParams (ROOT CAUSE FIX)
- `c0970a7` - fix: Skip checkout in generateMetadata
- `cd0552b` - debug: Add comprehensive logging (debugging phase)
- `24a2f53` - cleanup: Remove all debug logging

## Key Learnings
1. **Static generation can override dedicated routes** in production
2. **`generateStaticParams()` is the source of truth** for SSG routes
3. **Always test production builds** locally before deploying
4. **Development and production routing can differ** significantly in Next.js

## Prevention
To prevent similar issues in the future:
- Add all dedicated Next.js routes to `INVALID_SLUGS_FILTER`
- Consider renaming/deleting legacy WordPress pages that conflict
- Use `npm run build` locally to test production routing behavior

## Date Fixed
December 31, 2025
