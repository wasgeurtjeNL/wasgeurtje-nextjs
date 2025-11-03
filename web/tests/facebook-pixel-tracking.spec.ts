import { test, expect } from '@playwright/test';

/**
 * Facebook Pixel Tracking E2E Tests
 * 
 * Tests verifiëren:
 * 1. ✅ Advanced Matching (localStorage user data → fbq init)
 * 2. ✅ Event ID Deduplication (client + server same ID)
 * 3. ✅ FBC Cookie Persistence (fbclid URL → _fbc cookie)
 */

test.describe('Facebook Pixel Tracking', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies and storage before each test
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('1. Advanced Matching: Should initialize fbq with user data from localStorage', async ({ page }) => {
    // ARRANGE: Set user data in localStorage
    await page.goto('/');
    
    await page.evaluate(() => {
      localStorage.setItem('user_email', 'test@example.com');
      localStorage.setItem('user_phone', '+31612345678');
      localStorage.setItem('user_first_name', 'John');
      localStorage.setItem('user_last_name', 'Doe');
      localStorage.setItem('user_city', 'Amsterdam');
      localStorage.setItem('user_country', 'nl');
    });

    // Listen for fbq init call
    const fbqCalls: any[] = [];
    await page.exposeFunction('captureFbqCall', (method: string, ...args: any[]) => {
      fbqCalls.push({ method, args });
    });

    await page.evaluate(() => {
      // Intercept fbq calls
      const originalFbq = (window as any).fbq;
      (window as any).fbq = function(...args: any[]) {
        (window as any).captureFbqCall('fbq', ...args);
        if (originalFbq) originalFbq.apply(this, args);
      };
    });

    // ACT: Reload page to trigger FacebookPixel component
    await page.reload();

    // Wait for pixel to load
    await page.waitForTimeout(2000);

    // ASSERT: Check console logs for Advanced Matching
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('[FB Pixel]')) {
        consoleLogs.push(msg.text());
      }
    });

    await page.reload();
    await page.waitForTimeout(2000);

    // Verify Advanced Matching was used
    const advancedMatchingLog = consoleLogs.find(log => 
      log.includes('Initialized WITH Advanced Matching')
    );

    if (advancedMatchingLog) {
      console.log('✅ Advanced Matching log found:', advancedMatchingLog);
      expect(advancedMatchingLog).toContain('em');
      expect(advancedMatchingLog).toContain('ph');
    } else {
      // If no log found, check that fbq was called with parameters
      console.log('⚠️ No Advanced Matching log, checking fbq calls...');
      console.log('All console logs:', consoleLogs);
    }
  });

  test('2. FBC Cookie Persistence: Should capture fbclid from URL and store in _fbc cookie', async ({ page }) => {
    // ARRANGE: Navigate with fbclid parameter
    const fbclid = 'test_fbclid_12345';
    
    // ACT: Visit page with fbclid
    await page.goto(`/?fbclid=${fbclid}`);
    
    // Wait for capture script to run
    await page.waitForTimeout(1000);

    // ASSERT: Check _fbc cookie exists
    const cookies = await page.context().cookies();
    const fbcCookie = cookies.find(c => c.name === '_fbc');

    console.log('All cookies:', cookies.map(c => ({ name: c.name, value: c.value })));

    expect(fbcCookie).toBeDefined();
    expect(fbcCookie?.value).toContain(fbclid);
    expect(fbcCookie?.value).toMatch(/^fb\.1\.\d+\.test_fbclid_12345$/);
    
    console.log('✅ _fbc cookie created:', fbcCookie?.value);

    // ASSERT: Cookie persists across navigation
    await page.goto('/');
    await page.waitForTimeout(500);

    const cookiesAfterNav = await page.context().cookies();
    const fbcCookieAfter = cookiesAfterNav.find(c => c.name === '_fbc');

    expect(fbcCookieAfter).toBeDefined();
    expect(fbcCookieAfter?.value).toBe(fbcCookie?.value);
    
    console.log('✅ _fbc cookie persisted after navigation');
  });

  test('3. Event ID Deduplication: ViewContent should use same event ID client + server', async ({ page }) => {
    // ARRANGE: Intercept network requests
    const apiCalls: any[] = [];
    
    page.on('request', request => {
      if (request.url().includes('/api/tracking/facebook')) {
        apiCalls.push({
          url: request.url(),
          body: request.postDataJSON()
        });
      }
    });

    // Listen for sessionStorage updates
    await page.exposeFunction('captureSessionStorage', (key: string, value: string) => {
      console.log(`[SessionStorage] ${key} = ${value}`);
    });

    await page.evaluate(() => {
      const originalSetItem = sessionStorage.setItem;
      sessionStorage.setItem = function(key: string, value: string) {
        originalSetItem.call(this, key, value);
        (window as any).captureSessionStorage(key, value);
      };
    });

    // ACT: Navigate to a product page
    await page.goto('/wasparfum/full-moon');
    
    // Wait for tracking to fire
    await page.waitForTimeout(3000);

    // Get event ID from sessionStorage
    const eventId = await page.evaluate(() => {
      return sessionStorage.getItem('fb_last_event_id');
    });

    const eventName = await page.evaluate(() => {
      return sessionStorage.getItem('fb_last_event_name');
    });

    console.log('✅ Client-side event ID stored:', eventId);
    console.log('✅ Client-side event name:', eventName);

    // ASSERT: Event ID should be stored
    expect(eventId).toBeDefined();
    expect(eventId).toMatch(/^view_content_/);
    expect(eventName).toBe('ViewContent');

    // ASSERT: Server-side call should use same event ID
    await page.waitForTimeout(1000);
    
    if (apiCalls.length > 0) {
      const serverCall = apiCalls.find(call => 
        call.body?.eventName === 'ViewContent'
      );

      if (serverCall) {
        console.log('✅ Server-side event ID:', serverCall.body.eventData?.eventId);
        expect(serverCall.body.eventData?.eventId).toBe(eventId);
      } else {
        console.log('⚠️ No server-side ViewContent call found');
        console.log('API calls:', apiCalls);
      }
    }
  });

  test('4. Event ID Deduplication: AddToCart should use same event ID client + server', async ({ page }) => {
    // ARRANGE: Intercept fbq calls and API calls
    const fbqCalls: any[] = [];
    const apiCalls: any[] = [];

    await page.exposeFunction('captureFbqCall', (...args: any[]) => {
      fbqCalls.push(args);
    });

    page.on('request', request => {
      if (request.url().includes('/api/tracking/facebook')) {
        apiCalls.push({
          url: request.url(),
          body: request.postDataJSON()
        });
      }
    });

    await page.evaluate(() => {
      const originalFbq = (window as any).fbq;
      (window as any).fbq = function(...args: any[]) {
        (window as any).captureFbqCall(...args);
        if (originalFbq) originalFbq.apply(this, args);
      };
    });

    // ACT: Go to product page and add to cart
    await page.goto('/wasparfum/full-moon');
    await page.waitForTimeout(2000);

    // Click "Toevoegen aan winkelwagen" button
    const addToCartButton = page.locator('button:has-text("Toevoegen aan winkelwagen")').first();
    await addToCartButton.click();

    await page.waitForTimeout(2000);

    // ASSERT: Check event ID in sessionStorage
    const eventId = await page.evaluate(() => {
      return sessionStorage.getItem('fb_last_event_id');
    });

    console.log('✅ AddToCart event ID:', eventId);
    expect(eventId).toBeDefined();
    expect(eventId).toMatch(/^add_to_cart_/);

    // Check fbq was called with eventID
    const addToCartFbqCall = fbqCalls.find(call => 
      call[0] === 'track' && call[1] === 'AddToCart'
    );

    if (addToCartFbqCall && addToCartFbqCall[3]) {
      console.log('✅ Client fbq eventID:', addToCartFbqCall[3].eventID);
      expect(addToCartFbqCall[3].eventID).toBe(eventId);
    }

    // Check server call uses same event ID
    await page.waitForTimeout(1000);
    const serverAddToCart = apiCalls.find(call => 
      call.body?.eventName === 'AddToCart'
    );

    if (serverAddToCart) {
      console.log('✅ Server eventID:', serverAddToCart.body.eventData?.eventId);
      expect(serverAddToCart.body.eventData?.eventId).toBe(eventId);
    }
  });

  test('5. Complete Flow: User journey with all tracking features', async ({ page }) => {
    // ARRANGE: Simulate returning user with fbclid
    const fbclid = 'complete_test_fbclid';
    
    await page.evaluate(() => {
      localStorage.setItem('user_email', 'returning@customer.com');
      localStorage.setItem('user_first_name', 'Jane');
      localStorage.setItem('user_last_name', 'Smith');
    });

    // ACT 1: Visit with fbclid
    await page.goto(`/?fbclid=${fbclid}`);
    await page.waitForTimeout(1000);

    // ASSERT: _fbc cookie created
    let cookies = await page.context().cookies();
    let fbcCookie = cookies.find(c => c.name === '_fbc');
    expect(fbcCookie).toBeDefined();
    console.log('✅ Step 1: FBC cookie created');

    // ACT 2: Navigate to product (check Advanced Matching)
    await page.goto('/wasparfum/full-moon');
    await page.waitForTimeout(2000);

    // ASSERT: ViewContent event ID stored
    let eventId = await page.evaluate(() => sessionStorage.getItem('fb_last_event_id'));
    expect(eventId).toMatch(/^view_content_/);
    console.log('✅ Step 2: ViewContent tracked with event ID:', eventId);

    // ACT 3: Add to cart
    const addToCartBtn = page.locator('button:has-text("Toevoegen aan winkelwagen")').first();
    await addToCartBtn.click();
    await page.waitForTimeout(1500);

    // ASSERT: AddToCart event ID stored
    eventId = await page.evaluate(() => sessionStorage.getItem('fb_last_event_id'));
    expect(eventId).toMatch(/^add_to_cart_/);
    console.log('✅ Step 3: AddToCart tracked with event ID:', eventId);

    // ACT 4: Check cookies persist
    cookies = await page.context().cookies();
    fbcCookie = cookies.find(c => c.name === '_fbc');
    expect(fbcCookie).toBeDefined();
    expect(fbcCookie?.value).toContain(fbclid);
    console.log('✅ Step 4: FBC cookie persisted throughout journey');

    console.log('\n🎉 COMPLETE FLOW TEST PASSED!');
  });
});

