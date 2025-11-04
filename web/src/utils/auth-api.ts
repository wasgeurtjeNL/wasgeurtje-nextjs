// Authentication API utilities for WooCommerce/WordPress integration
import { generateAvatarUrl } from './avatar-generator';

// WooCommerce address types
interface WooCommerceAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

interface WooCommerceAddressData {
  billing: WooCommerceAddress;
  shipping: WooCommerceAddress;
}

// API URLs - Use Next.js API routes to avoid CORS and 415 errors
const API_BASE_URL = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || 'https://api.wasgeurtje.nl')
  : (process.env.API_BASE_URL || 'https://api.wasgeurtje.nl');
// Use Next.js API route for JWT authentication to avoid nginx 415 errors
const JWT_AUTH_ROUTE = '/api/auth/jwt';
const WORDPRESS_API_URL = `${API_BASE_URL}/wp-json/wp/v2`;
const WPLOYALTY_API_URL = `${API_BASE_URL}/wp-json/wployalty/v1`;

// Known referral codes for specific users
const knownReferralCodes: Record<string, string> = {
  // Add known email to referral code mappings here
  // Example: 'user@example.com': 'REF-ABC-123'
};

// Generate a default referral code based on email
const getDefaultReferralCode = (email: string): string => {
  const normalizedEmail = email.toLowerCase();
  if (knownReferralCodes[normalizedEmail]) {
    return knownReferralCodes[normalizedEmail];
  }
  
  // Generate a simple referral code for unknown users
  const emailHash = btoa(email).substring(0, 6).toUpperCase();
  return `REF-${emailHash.substring(0, 3)}-${emailHash.substring(3, 6)}`;
};

// Get current JWT token
export const getJWTToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('wasgeurtje-token');
  }
  return null;
};

// Set JWT token in localStorage
export const setJWTToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('wasgeurtje-token', token);
  }
};

// Get authorization header with JWT token
export const getJWTAuthHeader = (): { Authorization: string } | undefined => {
  const token = getJWTToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return undefined;
};

// Validate JWT token volgens de officiële documentatie
// https://wordpress.org/plugins/jwt-authentication-for-wp-rest-api/
export const validateJWTToken = async (): Promise<boolean> => {
  const token = getJWTToken();
  if (!token) {
    return false;
  }
  
  try {
    // Use Next.js API route to avoid 415 errors from nginx
    devLog('🔐 Validating JWT token via proxy...');
    const response = await fetch(JWT_AUTH_ROUTE, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    
    if (response.ok) {
      const validationData = await response.json();
      devLog('✅ JWT validation successful');
      return validationData.valid === true;
    } else {
      const errorData = await response.json();
      devLog('❌ JWT validation failed:', errorData);
      return false;
    }
  } catch (error) {
    console.error('❌ Error validating JWT token:', error);
    return false;
  }
};

// Fetch customer address from WooCommerce
export const fetchCustomerAddress = async (userId: string): Promise<WooCommerceAddressData> => {
  try {
    // DEBUG: Fetching customer address for user ID ${userId}`);
    
    // Prefer server-side proxy route to avoid CORS and ensure params handling
    const customerResponse = await fetch(`/api/woocommerce/customers/${userId}`, {
      headers: {
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });
    
    if (customerResponse.ok) {
      const customerData = await customerResponse.json();
      // DEBUG: Successfully fetched customer data:', customerData);
      
      // Extract address information
      return {
        billing: customerData.billing || {},
        shipping: customerData.shipping || {}
      };
    } else {
      // DEBUG: Failed to fetch customer data: ${customerResponse.status} ${customerResponse.statusText}`);
      return { billing: {}, shipping: {} };
    }
  } catch (error) {
    console.error('DEBUG: Error fetching customer address:', error);
    return { billing: {}, shipping: {} };
  }
};

// Fetch customer data using direct WooCommerce API
// Helper for conditional logging
const isDev = process.env.NODE_ENV === 'development';
const devLog = (...args: any[]) => isDev && console.log(...args);
const devError = (...args: any[]) => isDev && console.error(...args);

export const fetchCustomerByEmail = async (email: string, password: string) => {
  try {
    devLog('🔐 START AUTHENTICATION =====');
    
    // Controleer wachtwoord lengte
    if (password.length < 4) {
      devLog('❌ Password validation failed - too short');
      throw new Error('Wachtwoord moet minimaal 4 karakters zijn');
    }

    // STEP 1: Authenticeer met WordPress JWT via Next.js API route
    devLog('🔑 Step 1: Authenticating with WordPress JWT via proxy...');
    let jwtToken: string;
    
    try {
      // Use Next.js API route to avoid 415 errors from nginx
      const jwtResponse = await fetch(JWT_AUTH_ROUTE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: email,
          password: password,
        }),
      });

      if (!jwtResponse.ok) {
        const errorData = await jwtResponse.json();
        devError('❌ JWT Authentication failed:', errorData);
        throw new Error(errorData.message || errorData.error || 'Onjuiste inloggegevens');
      }

      const jwtData = await jwtResponse.json();
      jwtToken = jwtData.data?.token || jwtData.token;
      
      if (!jwtToken) {
        devError('❌ No JWT token received');
        throw new Error('Authenticatie mislukt - geen token ontvangen');
      }
      
      devLog('✅ JWT Authentication successful');
      setJWTToken(jwtToken);
      
    } catch (jwtError: any) {
      devError('❌ JWT Authentication error:', jwtError);
      throw new Error(jwtError.message || 'Onjuiste e-mailadres of wachtwoord');
    }

    // STEP 2: Try to fetch both WooCommerce customer and WordPress user in parallel
    devLog('📦 Step 2: Fetching customer data (WooCommerce + WordPress)...');
    let customer;
    
    try {
      // Fetch both in parallel for better performance
      // Add 500ms timeout for WooCommerce check to fail fast
      const wooCommerceTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('WooCommerce timeout')), 500)
      );
      
      const [wooCommerceResult, wordPressUser] = await Promise.allSettled([
        Promise.race([
          fetch(`/api/woocommerce/customers/email?email=${encodeURIComponent(email)}`, {
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store'
          }).then(async res => {
            if (!res.ok) {
              devLog(`⚠️ WooCommerce API returned ${res.status}`);
              return null;
            }
            const data = await res.json();
            // Handle both array and single object responses
            return Array.isArray(data) ? data : [data];
          }),
          wooCommerceTimeout
        ]).catch((err) => {
          devLog('⚠️ WooCommerce fetch failed:', err.message);
          return null;
        }),
        fetch(`${WORDPRESS_API_URL}/users/me`, {
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json'
          }
        }).then(res => res.ok ? res.json() : null)
      ]);
      
      // Try WooCommerce customer first
      if (wooCommerceResult.status === 'fulfilled' && wooCommerceResult.value) {
        const customers = wooCommerceResult.value;
        devLog(`✅ WooCommerce customer found`);
        
        if (customers && Array.isArray(customers) && customers.length > 0) {
          customer = customers[0];
        }
      }
      
      // If no WooCommerce customer, use WordPress user
      if (!customer && wordPressUser.status === 'fulfilled' && wordPressUser.value) {
        const wpUser = wordPressUser.value;
        devLog('✅ Using WordPress user (no WooCommerce account)');
        
        // Create customer object from WordPress user
        customer = {
          id: wpUser.id.toString(),
          email: wpUser.email || email,
          first_name: wpUser.first_name || wpUser.name.split(' ')[0] || 'Gebruiker',
          last_name: wpUser.last_name || wpUser.name.split(' ').slice(1).join(' ') || '',
          username: wpUser.username || email.split('@')[0],
          role: wpUser.roles?.[0] || 'customer',
          avatar_url: wpUser.avatar_urls?.['96'] || generateAvatarUrl(wpUser.name, 96),
          token: jwtToken,
          billing: {
            first_name: wpUser.first_name || wpUser.name.split(' ')[0] || '',
            last_name: wpUser.last_name || wpUser.name.split(' ').slice(1).join(' ') || '',
            email: wpUser.email || email,
            address_1: '',
            city: '',
            postcode: '',
            country: 'NL',
            phone: ''
          },
          shipping: {
            first_name: wpUser.first_name || wpUser.name.split(' ')[0] || '',
            last_name: wpUser.last_name || wpUser.name.split(' ').slice(1).join(' ') || '',
            address_1: '',
            city: '',
            postcode: '',
            country: 'NL'
          },
          meta_data: []
        };
        
        devLog('✅ WORDPRESS USER AUTHENTICATION SUCCESSFUL');
        return customer;
      }
      
      if (!customer) {
        throw new Error('No customer or user data found');
      }
      
      devLog(`📊 Processing customer data...`);
      
      // Continue with WooCommerce customer processing
      // Voeg JWT token toe aan de klantgegevens
      customer.token = jwtToken;
        
        // Voeg een avatar URL toe als die ontbreekt
        if (!customer.avatar_url) {
          customer.avatar_url = generateAvatarUrl(`${customer.first_name} ${customer.last_name}`, 96);
        }
        
        // Zorg ervoor dat alle vereiste velden aanwezig zijn
        if (!customer.billing) customer.billing = {};
        if (!customer.shipping) customer.shipping = {};
        if (!customer.meta_data) customer.meta_data = [];
        
        // Make sure all required address fields are initialized but don't override existing data
        customer.billing = {
          ...customer.billing,
          address_1: customer.billing.address_1 || '',
          city: customer.billing.city || '',
          postcode: customer.billing.postcode || '',
          country: customer.billing.country || 'NL',
          phone: customer.billing.phone || ''
        };
        
        customer.shipping = {
          ...customer.shipping,
          address_1: customer.shipping.address_1 || '',
          city: customer.shipping.city || '',
          postcode: customer.shipping.postcode || '',
          country: customer.shipping.country || 'NL'
        };
      
      devLog('✅ AUTHENTICATION SUCCESSFUL =====');
      return customer;
      
    } catch (customerFetchError) {
      devError('❌ Customer fetch failed:', customerFetchError);
      throw new Error('Kon gebruikersgegevens niet ophalen. Probeer het later opnieuw.');
    }
    
    // Old fallback code removed - handled by parallel fetch above
    /*} else {
        // Geen WooCommerce klant gevonden, maar JWT authenticatie was wel succesvol
        // Dit kan een WordPress gebruiker zijn zonder WooCommerce account
        console.log('⚠️ No WooCommerce customer found, but JWT auth succeeded');
        console.log('📝 Creating basic user object from JWT data...');
        
        // Haal gebruikersgegevens op via WordPress Users API met JWT token
        try {
          const userResponse = await fetch(`${WORDPRESS_API_URL}/users/me`, {
            headers: {
              'Authorization': `Bearer ${jwtToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (userResponse.ok) {
            const wpUser = await userResponse.json();
            console.log('✅ WordPress user data fetched:', wpUser.name);
            
            // Maak een customer object van de WordPress gebruiker
            customer = {
              id: wpUser.id.toString(),
              email: wpUser.email || email,
              first_name: wpUser.first_name || wpUser.name.split(' ')[0] || 'Gebruiker',
              last_name: wpUser.last_name || wpUser.name.split(' ').slice(1).join(' ') || '',
              username: wpUser.username || email.split('@')[0],
              role: wpUser.roles?.[0] || 'customer',
              avatar_url: wpUser.avatar_urls?.['96'] || generateAvatarUrl(wpUser.name, 96),
              token: jwtToken,
              billing: {
                first_name: wpUser.first_name || wpUser.name.split(' ')[0] || '',
                last_name: wpUser.last_name || wpUser.name.split(' ').slice(1).join(' ') || '',
                email: wpUser.email || email,
                address_1: '',
                city: '',
                postcode: '',
                country: 'NL',
                phone: ''
              },
              shipping: {
                first_name: wpUser.first_name || wpUser.name.split(' ')[0] || '',
                last_name: wpUser.last_name || wpUser.name.split(' ').slice(1).join(' ') || '',
                address_1: '',
                city: '',
                postcode: '',
                country: 'NL'
              },
              meta_data: []
            };
            
            console.log('✅ WORDPRESS USER AUTHENTICATION SUCCESSFUL');
            return customer;
          }
        } catch (wpError) {
          console.error('❌ Failed to fetch WordPress user data:', wpError);
        }
        
        // Als alles faalt, throw error
        console.log('❌ No customer data available');
        throw new Error('Geen klantgegevens gevonden');
      }
    } catch (customerFetchError) {
      console.error('⚠️ WooCommerce customer not found:', customerFetchError);
      // JWT was succesvol, maar er is geen WooCommerce klant
      // Haal WordPress gebruikersgegevens op als fallback
      console.log('📝 Fetching WordPress user data as fallback...');
      
      try {
        const userResponse = await fetch(`${WORDPRESS_API_URL}/users/me`, {
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!userResponse.ok) {
          throw new Error('Failed to fetch WordPress user data');
        }
        
        const wpUser = await userResponse.json();
        console.log('✅ WordPress user data fetched:', wpUser.name);
        
        // Maak een customer object van de WordPress gebruiker
        customer = {
          id: wpUser.id.toString(),
          email: wpUser.email || email,
          first_name: wpUser.first_name || wpUser.name.split(' ')[0] || 'Gebruiker',
          last_name: wpUser.last_name || wpUser.name.split(' ').slice(1).join(' ') || '',
          username: wpUser.username || email.split('@')[0],
          role: wpUser.roles?.[0] || 'customer',
          avatar_url: wpUser.avatar_urls?.['96'] || generateAvatarUrl(wpUser.name, 96),
          token: jwtToken,
          billing: {
            first_name: wpUser.first_name || wpUser.name.split(' ')[0] || '',
            last_name: wpUser.last_name || wpUser.name.split(' ').slice(1).join(' ') || '',
            email: wpUser.email || email,
            address_1: '',
            city: '',
            postcode: '',
            country: 'NL',
            phone: ''
          },
          shipping: {
            first_name: wpUser.first_name || wpUser.name.split(' ')[0] || '',
            last_name: wpUser.last_name || wpUser.name.split(' ').slice(1).join(' ') || '',
            address_1: '',
            city: '',
            postcode: '',
            country: 'NL'
          },
          meta_data: []
        };
        
        console.log('✅ WORDPRESS USER AUTHENTICATION SUCCESSFUL');
        return customer;
        
      } catch (wpError) {
        devError('❌ Failed to fetch WordPress user data:', wpError);
        throw new Error('Kon gebruikersgegevens niet ophalen. Probeer het later opnieuw.');
      }
    }*/
  } catch (error) {
    devError('DEBUG: Authentication error:', error);
    
    // Voor debugging doeleinden, proberen we alternatieve WooCommerce endpoints
    try {
      // 1. Probeer test connection API route
      const testEndpoint = `/api/woocommerce/test-connection`;
      // DEBUG: Testing WooCommerce API with endpoint: ${testEndpoint}`);
      
      const testResponse = await fetch(testEndpoint, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // DEBUG: WooCommerce API response status: ${testResponse.status} ${testResponse.statusText}`);
      
      if (testResponse.ok) {
        // DEBUG: WooCommerce API is accessible with current credentials');
        const testData = await testResponse.json();
        // DEBUG: WooCommerce API returned ${testData.length} products`);
      } else {
        const errorText = await testResponse.text();
        // DEBUG: WooCommerce API error response: ${errorText}`);
      }
      
      // Skip public API test - not needed for authentication
    } catch (testError) {
      console.error('DEBUG: Error during test API calls:', testError);
    }
    
    // Gooi een user-friendly error
    if (error instanceof Error && error.message) {
      throw error;
    }
    throw new Error('Authenticatie mislukt. Controleer je inloggegevens en probeer het opnieuw.');
  }
};

// Fetch orders for a specific customer
// Fetch WP Loyalty points for customer
// Deze functie is nu verplaatst naar wp-loyalty-api.ts
// We importeren de functie hier om backward compatibility te behouden
import { getLoyaltyPointsByCustomerId, LoyaltyData } from './wp-loyalty-api';

// New function to fetch loyalty points by email using the endpoint
export const fetchLoyaltyPointsByEmail = async (email: string): Promise<LoyaltyData> => {
  try {
    // DEBUG: FETCHING LOYALTY POINTS VIA ENDPOINT =====');
    // DEBUG: Fetching loyalty points for email: ${email}`);
    
    const apiBaseUrl = typeof window !== 'undefined' 
      ? (process.env.NEXT_PUBLIC_WORDPRESS_API_URL || 'https://api.wasgeurtje.nl')
      : (process.env.API_BASE_URL || 'https://api.wasgeurtje.nl');
    const endpoint = `${apiBaseUrl}/wp-json/my/v1/loyalty/points?email=${encodeURIComponent(email)}`;
    // DEBUG: Loyalty endpoint URL: ${endpoint}`);
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // DEBUG: Loyalty endpoint response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      throw new Error(`Loyalty API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    // DEBUG: Loyalty endpoint response data:', data);
    
    // Transform the endpoint response to our LoyaltyData interface
    const loyaltyData: LoyaltyData = {
      points: data.points || 0,
      total_earned: data.earned || 0,
      rewards_available: Math.floor((data.points || 0) / 100), // Calculate available rewards (assuming 100 points = 1 reward)
      refer_code: getDefaultReferralCode(email), // Generate a default referral code based on email
      level_id: data.level_id || '0' // Not provided by endpoint, will be default
    };
    
    // DEBUG: Transformed loyalty data:', loyaltyData);
    return loyaltyData;
  } catch (error) {
    console.error('DEBUG: Error fetching loyalty points via endpoint:', error);
    // Bij fouten, geef een leeg object terug
    return {
      points: 0,
      total_earned: 0,
      rewards_available: 0,
      refer_code: '',
      level_id: '0'
    };
  }
};

export const fetchCustomerLoyaltyPoints = async (customerId: string): Promise<LoyaltyData> => {
  try {
    // DEBUG: FETCHING LOYALTY POINTS =====');
    // DEBUG: Fetching loyalty points for customer ID: ${customerId}`);
    
    // First try to get the customer email to use the new endpoint
    try {
      const customerUrl = `/api/woocommerce/customers/${customerId}`;
      const customerResponse = await fetch(customerUrl, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        const customerEmail = customerData.email;
        
        if (customerEmail) {
          // DEBUG: Found customer email: ${customerEmail}, using new endpoint`);
          return await fetchLoyaltyPointsByEmail(customerEmail);
        }
      }
    } catch (emailFetchError) {
      // DEBUG: Could not fetch customer email, falling back to old method');
    }
    
    // Fallback to the oude functie uit wp-loyalty-api.ts voor andere gebruikers
    const loyaltyData = await getLoyaltyPointsByCustomerId(customerId);
    return loyaltyData;
  } catch (error) {
    console.error('DEBUG: Error fetching loyalty points:', error);
    // Bij fouten, geef een leeg object terug
    return {
      points: 0,
      total_earned: 0,
      rewards_available: 0,
      refer_code: '',
      level_id: '0'
    };
  }
};

export const fetchCustomerOrders = async (customerId: string) => {
  try {
    // DEBUG: FETCHING ORDERS =====');
    // DEBUG: Fetching orders for customer ID: ${customerId}`);
    
    // Use Next.js API route to avoid CORS issues
    const ordersUrl = `/api/woocommerce/orders/customer?customerId=${customerId}`;
    // DEBUG: Orders API URL: ${ordersUrl}`);
    
    try {
      const response = await fetch(ordersUrl, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // DEBUG: Orders API response status: ${response.status} ${response.statusText}`);
  
      if (!response.ok) {
        const errorText = await response.text();
        // DEBUG: Orders API error response: ${errorText}`);
        throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
      }
  
      const orders = await response.json();
      // DEBUG: Orders API returned ${orders.length} orders`);
      
      if (orders && orders.length > 0) {
        // DEBUG: First order data:', JSON.stringify(orders[0], null, 2));
        
        // Orders are already processed by the API route, just add image defaults if needed
        return orders.map((order: any) => {
          // Add default images for line items if they don't have one
          if (order.line_items) {
            order.line_items = order.line_items.map((item: any) => {
              // Als het item geen afbeelding heeft, voeg een standaard afbeelding toe
              if (!item.image || !item.image.src) {
                const defaultImages: Record<string, string> = {
                  'Blossom Drip': '/figma/products/Wasgeurtje_Blossom_Drip.png',
                  'Full Moon': '/figma/products/Wasgeurtje_Full_Moon.png',
                  'Summer Vibes': '/figma/products/Wasgeurtje_Summer_Vibes.png',
                  'Proefpakket': '/figma/products/Wasparfum_Proefpakket.png',
                };
                
                // Zoek een passende afbeelding op basis van de productnaam
                const matchingImage = Object.entries(defaultImages).find(([key]) => 
                  item.name && item.name.includes(key)
                );
                
                item.image = {
                  src: matchingImage ? matchingImage[1] : '/figma/products/Wasgeurtje_Blossom_Drip.png'
                };
              }
              
              return item;
            });
          }
          
          return order;
        });
      } else {
        // DEBUG: No orders found for this customer');
      }
    } catch (apiError: any) {
      console.error('DEBUG: Error during WooCommerce Orders API call:', apiError);
      // DEBUG: Orders API Error message: ${apiError.message}`);
      throw apiError;
    }
    
    // DEBUG: Returning empty orders array');
    return [];
  } catch (error) {
    console.error('DEBUG: Final orders error:', error);
    // Bij fouten, geef een lege array terug
    return [];
  }
};

// Create new customer in WooCommerce
export const createCustomer = async (customerData: {
  email: string;
  first_name: string;
  last_name: string;
  billing?: any;
  shipping?: any;
  meta_data?: any[];
}) => {
  try {
    // DEBUG: CREATING CUSTOMER =====');
    // DEBUG: Creating customer with email: ${customerData.email}`);
    
    // Use Next.js API route to create customer (avoids CORS)
    const response = await fetch(`/api/woocommerce/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(customerData)
    });

    // DEBUG: Customer creation API response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorData = await response.json();
      // DEBUG: Customer creation error:', errorData);
      
      // Controleer op specifieke foutmeldingen
      if (errorData.code === 'registration-error-email-exists' || 
          (errorData.message && errorData.message.includes('al een account'))) {
        // DEBUG: Email already exists error');
        throw new Error(`Er is al een account geregistreerd met ${customerData.email}. Log in of gebruik een ander e-mailadres.`);
      }
      
      throw new Error(errorData.message || 'Kan account niet aanmaken');
    }

    const newCustomer = await response.json();
    // DEBUG: Customer created successfully:', newCustomer);
    
    // Voeg een avatar URL toe als die ontbreekt
    if (!newCustomer.avatar_url) {
      newCustomer.avatar_url = generateAvatarUrl(`${newCustomer.first_name} ${newCustomer.last_name}`, 96);
      // DEBUG: Added avatar URL: ${newCustomer.avatar_url}`);
    }
    
    // DEBUG: CUSTOMER CREATION SUCCESSFUL =====');
    return newCustomer;
  } catch (error: any) {
    console.error('DEBUG: Final customer creation error:', error);
    // Geen fallback naar demo data meer, we willen echte errors zien
    throw error;
  }
};

// Update customer in WooCommerce
export const updateCustomer = async (customerId: string, customerData: any) => {
  try {
    // DEBUG: UPDATING CUSTOMER =====');
    // DEBUG: Updating customer with ID: ${customerId}`);
    // DEBUG: Update data:', customerData);
    
    // Use server-side proxy route to update WooCommerce customer
    const response = await fetch(`/api/woocommerce/customers/${customerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(customerData)
    });

    // DEBUG: Customer update API response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorData = await response.json();
      // DEBUG: Customer update error:', errorData);
      throw new Error(errorData.message || 'Kan profiel niet bijwerken');
    }

    const updatedCustomer = await response.json();
    // DEBUG: Customer updated successfully:', updatedCustomer);
    
    // Voeg een avatar URL toe als die ontbreekt
    if (!updatedCustomer.avatar_url && updatedCustomer.first_name && updatedCustomer.last_name) {
      updatedCustomer.avatar_url = generateAvatarUrl(`${updatedCustomer.first_name} ${updatedCustomer.last_name}`, 96);
      // DEBUG: Added avatar URL: ${updatedCustomer.avatar_url}`);
    }
    
    // DEBUG: CUSTOMER UPDATE SUCCESSFUL =====');
    return updatedCustomer;
  } catch (error: any) {
    console.error('DEBUG: Final customer update error:', error);
    // Geen fallback naar demo data meer, we willen echte errors zien
    throw error;
  }
};
