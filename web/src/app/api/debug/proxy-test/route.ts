import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testType = searchParams.get('type') || 'products';
    
    const results = {
      timestamp: new Date().toISOString(),
      test_type: testType,
      proxy_test: null as any,
      direct_test: null as any,
      comparison: null as any
    };

    // Define test endpoints based on type
    const endpoints = {
      products: '/wp-json/wc/v3/products?per_page=1',
      pages: '/wp-json/wp/v2/pages?per_page=1', 
      loyalty: '/wp-json/wployalty/v1/customer',
      acf: '/wp-json/acf/v3/product/123'
    };

    const testEndpoint = endpoints[testType as keyof typeof endpoints] || endpoints.products;
    const apiBaseUrl = process.env.API_BASE_URL || 'https://api.wasgeurtje.nl';

    // Test 1: Via Next.js proxy (internal fetch)
    try {
      const proxyStartTime = Date.now();
      
      // Make request to our own domain, which should trigger the rewrite
      const proxyUrl = `${request.nextUrl.origin}${testEndpoint}`;
      console.log(`🔄 Testing proxy: ${proxyUrl}`);
      
      const proxyResponse = await fetch(proxyUrl, {
        headers: {
          'User-Agent': 'Debug-Tool/1.0',
          'Accept': 'application/json'
        }
      });
      
      const proxyEndTime = Date.now();
      let proxyData = null;
      
      try {
        proxyData = await proxyResponse.json();
      } catch (e) {
        proxyData = await proxyResponse.text();
      }
      
      results.proxy_test = {
        success: proxyResponse.ok,
        status: proxyResponse.status,
        response_time_ms: proxyEndTime - proxyStartTime,
        url: proxyUrl,
        data_length: typeof proxyData === 'string' ? proxyData.length : JSON.stringify(proxyData).length,
        error: null
      };
      
    } catch (error) {
      results.proxy_test = {
        success: false,
        status: 0,
        response_time_ms: 0,
        url: `${request.nextUrl.origin}${testEndpoint}`,
        data_length: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 2: Direct API call
    try {
      const directStartTime = Date.now();
      const directUrl = `${apiBaseUrl}${testEndpoint}`;
      console.log(`🎯 Testing direct: ${directUrl}`);
      
      const directResponse = await fetch(directUrl, {
        headers: {
          'User-Agent': 'Debug-Tool/1.0',
          'Accept': 'application/json'
        }
      });
      
      const directEndTime = Date.now();
      let directData = null;
      
      try {
        directData = await directResponse.json();
      } catch (e) {
        directData = await directResponse.text();
      }
      
      results.direct_test = {
        success: directResponse.ok,
        status: directResponse.status,
        response_time_ms: directEndTime - directStartTime,
        url: directUrl,
        data_length: typeof directData === 'string' ? directData.length : JSON.stringify(directData).length,
        error: null
      };
      
    } catch (error) {
      results.direct_test = {
        success: false,
        status: 0,
        response_time_ms: 0,
        url: `${apiBaseUrl}${testEndpoint}`,
        data_length: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Generate comparison
    results.comparison = generateComparison(results.proxy_test, results.direct_test);

    return NextResponse.json({
      success: true,
      ...results
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

function generateComparison(proxyTest: any, directTest: any) {
  const comparison = {
    both_successful: proxyTest.success && directTest.success,
    proxy_faster: proxyTest.response_time_ms < directTest.response_time_ms,
    speed_difference_ms: Math.abs(proxyTest.response_time_ms - directTest.response_time_ms),
    data_size_match: proxyTest.data_length === directTest.data_length,
    recommendation: ''
  };

  // Generate recommendation
  if (!comparison.both_successful) {
    if (proxyTest.success && !directTest.success) {
      comparison.recommendation = 'Proxy works but direct API fails. Keep using proxy.';
    } else if (!proxyTest.success && directTest.success) {
      comparison.recommendation = 'Direct API works but proxy fails. Consider switching to direct API calls.';
    } else {
      comparison.recommendation = 'Both proxy and direct API are failing. Check network connectivity and API status.';
    }
  } else {
    if (comparison.speed_difference_ms < 100) {
      comparison.recommendation = 'Both methods perform similarly. Current setup is fine.';
    } else if (comparison.proxy_faster) {
      comparison.recommendation = `Proxy is ${comparison.speed_difference_ms}ms faster. Keep using proxy.`;
    } else {
      comparison.recommendation = `Direct API is ${comparison.speed_difference_ms}ms faster. Consider switching to direct API calls.`;
    }
  }

  return comparison;
}
