/**
 * Centrale API Configuratie
 * 
 * Dit bestand bevat alle API endpoints en configuratie.
 * Door gebruik te maken van environment variabelen en relative URLs,
 * kunnen we gemakkelijk switchen tussen verschillende omgevingen.
 */

/**
 * API Base URLs
 * 
 * Development: gebruikt direct wasgeurtje.nl
 * Production: gebruikt api.wasgeurtje.nl
 * 
 * Door rewrites in next.config.js wordt "/wp-json/..." automatisch
 * doorgestuurd naar de juiste backend.
 */

// Voor server-side calls (Next.js API routes, Server Components)
// Gebruik VOLLEDIGE URLs met het domein
export const getServerApiBaseUrl = () => {
  return process.env.API_BASE_URL || 'https://api.wasgeurtje.nl';
};

// Voor client-side calls
// Gebruik RELATIVE URLs zodat rewrites kunnen werken
export const getClientApiBaseUrl = () => {
  // In de browser gebruiken we relative URLs
  // Next.js rewrites zorgt ervoor dat deze naar de juiste backend gaan
  if (typeof window !== 'undefined') {
    return ''; // Relative URLs
  }
  // Server-side: gebruik volledige URL
  return getServerApiBaseUrl();
};

/**
 * API Endpoints
 * Deze blijven hetzelfde, ongeacht waar de backend draait
 */
export const API_ENDPOINTS = {
  // WooCommerce REST API
  woocommerce: {
    products: '/wp-json/wc/v3/products',
    orders: '/wp-json/wc/v3/orders',
    customers: '/wp-json/wc/v3/customers',
    coupons: '/wp-json/wc/v3/coupons',
  },
  
  // WordPress REST API
  wordpress: {
    posts: '/wp-json/wp/v2/posts',
    pages: '/wp-json/wp/v2/pages',
    media: '/wp-json/wp/v2/media',
  },
  
  // ACF (Advanced Custom Fields)
  acf: {
    product: (productId: string | number) => `/wp-json/acf/v3/product/${productId}`,
  },
  
  // Custom API endpoints
  custom: {
    loyalty: '/wp-json/loyalty/v1',
    intelligence: '/wp-json/customer-intelligence/v1',
    passwordReset: '/wp-json/password-reset/v1',
    phoneNumbers: '/wp-json/phone-numbers/v1',
  },
} as const;

/**
 * Helper functie om volledige URL te bouwen
 */
export const buildApiUrl = (endpoint: string, isServerSide: boolean = false) => {
  const baseUrl = isServerSide ? getServerApiBaseUrl() : getClientApiBaseUrl();
  return `${baseUrl}${endpoint}`;
};

/**
 * WooCommerce specifieke configuratie
 */
export const WOOCOMMERCE_CONFIG = {
  apiUrl: process.env.WOOCOMMERCE_API_URL || `${getServerApiBaseUrl()}/wp-json/wc/v3`,
  consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY || '',
  consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET || '',
};

/**
 * Environment helper
 */
export const isProduction = () => process.env.NODE_ENV === 'production';
export const isDevelopment = () => process.env.NODE_ENV === 'development';

