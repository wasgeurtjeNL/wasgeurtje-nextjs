import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const results = {
      timestamp: new Date().toISOString(),
      loyalty_tests: [] as any[],
      session_check: {
        has_cache: false,
        cache_items: 0,
        cache_timestamp: null,
        cache_age_minutes: 0
      },
      recommendations: [] as any[]
    };

    // Test loyalty API endpoints
    const apiBaseUrl = process.env.API_BASE_URL || 'https://api.wasgeurtje.nl';
    const loyaltyEndpoints = [
      {
        name: 'Proxy - Loyalty Customer Endpoint',
        url: '/wp-json/wployalty/v1/customer',
        type: 'proxy'
      },
      {
        name: 'Direct - Loyalty Customer Endpoint',
        url: `${apiBaseUrl}/wp-json/wployalty/v1/customer`,
        type: 'direct'
      },
      {
        name: 'Proxy - Loyalty Rewards Endpoint',
        url: '/wp-json/wployalty/v1/rewards',
        type: 'proxy'
      },
      {
        name: 'Direct - Loyalty Rewards Endpoint',
        url: `${apiBaseUrl}/wp-json/wployalty/v1/rewards`,
        type: 'direct'
      }
    ];

    // Test each endpoint
    for (const endpoint of loyaltyEndpoints) {
      const startTime = Date.now();
      
      try {
        const testUrl = endpoint.type === 'proxy' 
          ? `${request.nextUrl.origin}${endpoint.url}`
          : endpoint.url;

        console.log(`💎 Testing loyalty endpoint: ${testUrl}`);

        const response = await fetch(testUrl, {
          headers: {
            'User-Agent': 'Debug-Tool/1.0',
            'Accept': 'application/json'
          }
        });

        const endTime = Date.now();
        let responseData = null;
        
        try {
          responseData = await response.json();
        } catch (e) {
          responseData = await response.text();
        }

        results.loyalty_tests.push({
          ...endpoint,
          success: response.ok,
          status: response.status,
          response_time_ms: endTime - startTime,
          data_preview: typeof responseData === 'string' 
            ? responseData.substring(0, 200)
            : JSON.stringify(responseData).substring(0, 200),
          error: null,
          tested_url: testUrl
        });

        console.log(`${response.ok ? '✅' : '❌'} ${endpoint.name}: ${response.status} (${endTime - startTime}ms)`);

      } catch (error) {
        const endTime = Date.now();
        
        results.loyalty_tests.push({
          ...endpoint,
          success: false,
          status: 0,
          response_time_ms: endTime - startTime,
          data_preview: null,
          error: error instanceof Error ? error.message : 'Unknown error',
          tested_url: endpoint.type === 'proxy' 
            ? `${request.nextUrl.origin}${endpoint.url}`
            : endpoint.url
        });

        console.error(`❌ ${endpoint.name}: ${error}`);
      }
    }

    // Generate recommendations
    results.recommendations = generateLoyaltyRecommendations(results.loyalty_tests);

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

function generateLoyaltyRecommendations(loyaltyTests: any[]) {
  const recommendations = [];
  
  // Check overall success rate
  const successfulTests = loyaltyTests.filter(test => test.success).length;
  const totalTests = loyaltyTests.length;
  const successRate = (successfulTests / totalTests) * 100;

  if (successRate < 50) {
    recommendations.push({
      type: 'error',
      message: `Only ${successRate.toFixed(1)}% of loyalty API tests succeeded. This will cause loyalty points loading issues.`
    });
  } else if (successRate < 80) {
    recommendations.push({
      type: 'warning',
      message: `${successRate.toFixed(1)}% success rate for loyalty APIs. Points may load inconsistently.`
    });
  }

  // Compare proxy vs direct performance
  const proxyTests = loyaltyTests.filter(test => test.type === 'proxy');
  const directTests = loyaltyTests.filter(test => test.type === 'direct');
  
  if (proxyTests.length > 0 && directTests.length > 0) {
    const proxySuccessRate = (proxyTests.filter(t => t.success).length / proxyTests.length) * 100;
    const directSuccessRate = (directTests.filter(t => t.success).length / directTests.length) * 100;
    
    const avgProxyTime = proxyTests.reduce((sum, test) => sum + test.response_time_ms, 0) / proxyTests.length;
    const avgDirectTime = directTests.reduce((sum, test) => sum + test.response_time_ms, 0) / directTests.length;

    if (Math.abs(proxySuccessRate - directSuccessRate) > 20) {
      if (proxySuccessRate > directSuccessRate) {
        recommendations.push({
          type: 'info',
          message: 'Proxy loyalty APIs are more reliable. Keep using proxy for loyalty endpoints.'
        });
      } else {
        recommendations.push({
          type: 'warning',
          message: 'Direct loyalty APIs are more reliable. Consider switching to direct API calls for loyalty.'
        });
      }
    }

    if (Math.abs(avgProxyTime - avgDirectTime) > 200) {
      if (avgProxyTime < avgDirectTime) {
        recommendations.push({
          type: 'info',
          message: `Proxy is ${Math.round(avgDirectTime - avgProxyTime)}ms faster for loyalty APIs.`
        });
      } else {
        recommendations.push({
          type: 'info',
          message: `Direct API is ${Math.round(avgProxyTime - avgDirectTime)}ms faster for loyalty APIs.`
        });
      }
    }
  }

  // Check for authentication issues (401/403 errors)
  const authErrors = loyaltyTests.filter(test => test.status === 401 || test.status === 403);
  if (authErrors.length > 0) {
    recommendations.push({
      type: 'error',
      message: 'Authentication errors detected. Check if WooCommerce consumer keys are properly configured.'
    });
  }

  // Check for server errors (500+ status codes)
  const serverErrors = loyaltyTests.filter(test => test.status >= 500);
  if (serverErrors.length > 0) {
    recommendations.push({
      type: 'error',
      message: 'Server errors detected on loyalty APIs. Check WordPress/WooCommerce backend health.'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'success',
      message: 'All loyalty API tests passed successfully!'
    });
  }

  return recommendations;
}
