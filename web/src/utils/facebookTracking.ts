/**
 * Facebook Tracking Utilities
 * 
 * Handles Facebook Click ID (fbclid) capturing and persistence
 * This is critical for proper attribution and Event Match Quality
 */

/**
 * Capture Facebook Click ID (fbclid) from URL and persist in _fbc cookie
 * 
 * The _fbc cookie format: fb.{subdomainIndex}.{timestamp}.{fbclid}
 * Example: fb.1.1704563200000.AbCdEf123456
 * 
 * This should be called on every page load to ensure fbclid is captured
 * ✅ Fixes attribution tracking across sessions
 * ✅ Improves Event Match Quality (EMQ)
 */
export function captureFacebookClickId(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const fbclid = urlParams.get('fbclid');
    
    if (fbclid) {
      // Create _fbc cookie in Facebook's expected format
      const timestamp = Date.now();
      const fbcValue = `fb.1.${timestamp}.${fbclid}`;
      
      // Store for 90 days (Facebook's standard)
      const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      
      // Get domain for cookie (remove subdomain for cross-subdomain tracking)
      const hostname = window.location.hostname;
      const domain = hostname.split('.').slice(-2).join('.');
      
      // Set cookie
      document.cookie = `_fbc=${fbcValue}; expires=${expires.toUTCString()}; path=/; domain=.${domain}; SameSite=Lax`;
      
      console.log('[FB Tracking] ✅ Captured and stored fbclid:', fbclid);
      console.log('[FB Tracking] _fbc cookie value:', fbcValue);
    } else {
      // Check if _fbc cookie already exists
      const existingFbc = document.cookie
        .split('; ')
        .find(row => row.startsWith('_fbc='))
        ?.split('=')[1];
      
      if (existingFbc) {
        console.log('[FB Tracking] ✅ Existing _fbc cookie found:', existingFbc);
      }
    }
  } catch (error) {
    console.error('[FB Tracking] Error capturing fbclid:', error);
  }
}

/**
 * Get the current _fbc cookie value
 */
export function getFacebookClickCookie(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  
  const fbc = document.cookie
    .split('; ')
    .find(row => row.startsWith('_fbc='))
    ?.split('=')[1];
  
  return fbc;
}

/**
 * Get the current _fbp cookie value (Facebook Browser ID)
 */
export function getFacebookBrowserCookie(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  
  const fbp = document.cookie
    .split('; ')
    .find(row => row.startsWith('_fbp='))
    ?.split('=')[1];
  
  return fbp;
}

/**
 * Store user data in localStorage for Facebook Advanced Matching
 * This data is used by FacebookPixel.tsx for fbq('init', ..., userData)
 */
export function storeFacebookUserData(userData: {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}): void {
  if (typeof window === 'undefined') return;
  
  try {
    if (userData.email) localStorage.setItem('user_email', userData.email);
    if (userData.phone) localStorage.setItem('user_phone', userData.phone);
    if (userData.firstName) localStorage.setItem('user_first_name', userData.firstName);
    if (userData.lastName) localStorage.setItem('user_last_name', userData.lastName);
    if (userData.city) localStorage.setItem('user_city', userData.city);
    if (userData.state) localStorage.setItem('user_state', userData.state);
    if (userData.zipCode) localStorage.setItem('user_zip', userData.zipCode);
    if (userData.country) localStorage.setItem('user_country', userData.country);
    
    console.log('[FB Tracking] ✅ User data stored for Advanced Matching:', Object.keys(userData).join(', '));
  } catch (error) {
    console.error('[FB Tracking] Error storing user data:', error);
  }
}

/**
 * Clear user data from localStorage (e.g., on logout)
 */
export function clearFacebookUserData(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_phone');
    localStorage.removeItem('user_first_name');
    localStorage.removeItem('user_last_name');
    localStorage.removeItem('user_city');
    localStorage.removeItem('user_state');
    localStorage.removeItem('user_zip');
    localStorage.removeItem('user_country');
    
    console.log('[FB Tracking] ✅ User data cleared');
  } catch (error) {
    console.error('[FB Tracking] Error clearing user data:', error);
  }
}

