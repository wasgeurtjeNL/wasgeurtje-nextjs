# WordPress API 415 Error Fix

## Problem Description

The application was experiencing **415 Unsupported Media Type** errors when making POST requests to the WordPress JWT authentication endpoint:

```
🔄 WordPress API Error: 415 - <html>
<head><title>415 Unsupported Media Type</title></head>
<body>
<center><h1>415 Unsupported Media Type</h1></center>
<hr><center>nginx</center>
</body>
</html>
```

## Root Cause

The client-side code was making **direct POST requests** to the WordPress API at `https://api.wasgeurtje.nl/wp-json/jwt-auth/v1/token` from the browser. The nginx server was rejecting these requests due to:

1. **CORS (Cross-Origin Resource Sharing)** restrictions
2. **Content-Type** header handling issues
3. **nginx configuration** that doesn't accept direct browser requests to these endpoints

### Problematic Code Locations

- `web/src/utils/auth-api.ts` (lines 84-90): JWT token validation
- `web/src/utils/auth-api.ts` (lines 161-170): JWT authentication

## Solution Implemented

### 1. Created Next.js API Proxy Route

Created a new API route at `web/src/app/api/auth/jwt/route.ts` that acts as a **server-side proxy** for JWT authentication requests. This route:

- ✅ Handles POST requests for authentication
- ✅ Handles GET requests for token validation
- ✅ Properly formats requests to the WordPress API
- ✅ Handles HTML error responses from nginx gracefully
- ✅ Returns proper JSON responses to the client
- ✅ Includes detailed logging for debugging

**Benefits of the proxy approach:**
- No CORS issues (same-origin requests)
- Server-side requests are trusted by nginx
- Better error handling and logging
- Environment variables stay on the server (more secure)

### 2. Updated Client-Side Authentication Code

Modified `web/src/utils/auth-api.ts` to use the new proxy route instead of making direct calls:

**Before:**
```typescript
const JWT_AUTH_URL = `${API_BASE_URL}/wp-json/jwt-auth/v1/token`;

const response = await fetch(JWT_AUTH_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});
```

**After:**
```typescript
const JWT_AUTH_ROUTE = '/api/auth/jwt';

const response = await fetch(JWT_AUTH_ROUTE, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});
```

## Changes Made

### New Files Created
- `web/src/app/api/auth/jwt/route.ts` - JWT authentication proxy route

### Files Modified
- `web/src/utils/auth-api.ts`:
  - Changed `JWT_AUTH_URL` to `JWT_AUTH_ROUTE`
  - Updated `validateJWTToken()` to use proxy route
  - Updated `fetchCustomerByEmail()` to use proxy route
  - Added better error handling for HTML responses

## Testing Recommendations

1. **Test Login Flow**
   - Try logging in with valid credentials
   - Try logging in with invalid credentials
   - Check browser console for any errors

2. **Test Token Validation**
   - Log in and refresh the page
   - Check if the session persists correctly
   - Test token expiration handling

3. **Check Error Handling**
   - Test with incorrect passwords
   - Test with non-existent email addresses
   - Verify error messages are user-friendly

## Architecture Pattern

This fix follows the established pattern in the codebase where:

- ✅ **Client-side code** makes requests to Next.js API routes (`/api/*`)
- ✅ **Next.js API routes** (server-side) make requests to WordPress/WooCommerce APIs
- ✅ This avoids CORS issues and nginx 415 errors
- ✅ Environment variables and API keys stay secure on the server

**Existing examples of this pattern:**
- `/api/woocommerce/customers/*` - Customer management
- `/api/woocommerce/orders/*` - Order management
- `/api/loyalty/redeem` - Loyalty points redemption

## Future Improvements

Consider applying the same pattern to other direct API calls:

1. **Direct WordPress API calls** in other files
2. **Direct WooCommerce API calls** from client-side code
3. **Any other third-party APIs** that might face similar issues

## Monitoring

Watch for these indicators of success:

- ✅ No more 415 errors in browser console
- ✅ Successful login attempts
- ✅ Proper error messages for failed logins
- ✅ Token validation working correctly
- ✅ Session persistence after page refresh

## Related Documentation

- [WordPress JWT Authentication Plugin](https://wordpress.org/plugins/jwt-authentication-for-wp-rest-api/)
- [Next.js API Routes Documentation](https://nextjs.org/docs/api-routes/introduction)
- [WooCommerce REST API Documentation](https://woocommerce.github.io/woocommerce-rest-api-docs/)

---

**Date Fixed:** November 4, 2025  
**Issue Type:** Server Configuration / API Integration  
**Severity:** High (Blocking user authentication)  
**Status:** ✅ Resolved










