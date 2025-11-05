'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface TestResult {
  name: string;
  url: string;
  method: string;
  success: boolean;
  status: number;
  time: number;
  error: string | null;
  data?: any;
  isImage?: boolean;
}

export default function DebugAPIPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [loyaltyTest, setLoyaltyTest] = useState<any>(null);
  const [environmentData, setEnvironmentData] = useState<any>(null);
  const [proxyComparison, setProxyComparison] = useState<any>(null);
  const [imageTestResults, setImageTestResults] = useState<any>(null);

  const runAPITests = async () => {
    setIsRunning(true);
    setResults([]);
    
    const tests = [
      {
        name: '🔄 Proxy - Products API',
        url: '/wp-json/wc/v3/products?per_page=3',
        method: 'GET'
      },
      {
        name: '🎯 Direct - Products API',
        url: 'https://api.wasgeurtje.nl/wp-json/wc/v3/products?per_page=3',
        method: 'GET'
      },
      {
        name: '🔄 Proxy - WordPress Pages',
        url: '/wp-json/wp/v2/pages?per_page=1',
        method: 'GET'
      },
      {
        name: '🎯 Direct - WordPress Pages',
        url: 'https://api.wasgeurtje.nl/wp-json/wp/v2/pages?per_page=1',
        method: 'GET'
      },
      {
        name: '🔄 Proxy - ACF Product Data',
        url: '/wp-json/acf/v3/product/123',
        method: 'GET'
      },
      {
        name: '🎯 Direct - ACF Product Data',
        url: 'https://api.wasgeurtje.nl/wp-json/acf/v3/product/123',
        method: 'GET'
      },
      {
        name: '🔄 Proxy - Loyalty API',
        url: '/wp-json/wployalty/v1/customer',
        method: 'GET'
      },
      {
        name: '🎯 Direct - Loyalty API',
        url: 'https://api.wasgeurtje.nl/wp-json/wployalty/v1/customer',
        method: 'GET'
      }
    ];
    
    const testResults: TestResult[] = [];
    
    for (const test of tests) {
      const startTime = Date.now();
      try {
        console.log(`🧪 Testing: ${test.name} - ${test.url}`);
        
        const response = await fetch(test.url, {
          method: test.method,
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        const endTime = Date.now();
        let data = null;
        
        try {
          data = await response.json();
        } catch (e) {
          data = await response.text();
        }
        
        testResults.push({
          ...test,
          success: response.ok,
          status: response.status,
          time: endTime - startTime,
          error: null,
          data: data
        });
        
        console.log(`✅ ${test.name}: ${response.status} (${endTime - startTime}ms)`);
        
      } catch (error) {
        const endTime = Date.now();
        testResults.push({
          ...test,
          success: false,
          status: 0,
          time: endTime - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: null
        });
        
        console.error(`❌ ${test.name}: ${error}`);
      }
      
      // Update results real-time
      setResults([...testResults]);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    setIsRunning(false);
  };

  const testImageLoading = async () => {
    try {
      const response = await fetch('/api/debug/image-test');
      const data = await response.json();
      setImageTestResults(data);
      console.log('🖼️ Image Test Results:', data);
      
      // Also do client-side image loading test
      const testImages = [
        '/wp-content/uploads/2024/01/test-image.jpg',
        'https://api.wasgeurtje.nl/wp-content/uploads/2024/01/test-image.jpg'
      ];
      
      testImages.forEach((src, index) => {
        const img = new Image();
        const startTime = Date.now();
        
        img.onload = () => {
          console.log(`✅ Client Image ${index === 0 ? 'Proxy' : 'Direct'} loaded in ${Date.now() - startTime}ms`);
        };
        
        img.onerror = () => {
          console.error(`❌ Client Image ${index === 0 ? 'Proxy' : 'Direct'} failed to load`);
        };
        
        img.src = src;
      });
      
    } catch (error) {
      console.error('Failed to run image tests:', error);
    }
  };

  const testLoyaltyContext = () => {
    // Check localStorage/sessionStorage
    const loyaltyCache = typeof window !== 'undefined' ? sessionStorage.getItem('loyalty-coupons-cache') : null;
    const userToken = typeof window !== 'undefined' ? localStorage.getItem('wasgeurtje-token') : null;
    
    setLoyaltyTest({
      hasCache: !!loyaltyCache,
      cacheData: loyaltyCache ? JSON.parse(loyaltyCache) : null,
      hasUserToken: !!userToken,
      timestamp: new Date().toISOString()
    });
  };

  const checkEnvironmentVariables = async () => {
    try {
      const response = await fetch('/api/debug/environment');
      const data = await response.json();
      setEnvironmentData(data);
      console.log('🔍 Environment Variables Check:', data);
    } catch (error) {
      console.error('Failed to fetch environment data:', error);
    }
  };

  const runProxyComparison = async () => {
    try {
      const tests = ['products', 'pages', 'loyalty'];
      const results = [];
      
      for (const testType of tests) {
        const response = await fetch(`/api/debug/proxy-test?type=${testType}`);
        const data = await response.json();
        results.push(data);
      }
      
      setProxyComparison(results);
      console.log('🔄 Proxy Comparison Results:', results);
    } catch (error) {
      console.error('Failed to run proxy comparison:', error);
    }
  };

  useEffect(() => {
    checkEnvironmentVariables();
    testLoyaltyContext();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🔧 API Debug & Test Suite
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <button
              onClick={runAPITests}
              disabled={isRunning}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isRunning ? '⏳ Running Tests...' : '🚀 Run API Tests'}
            </button>
            
            <button
              onClick={runProxyComparison}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              🔄 Proxy vs Direct
            </button>
            
            <button
              onClick={testImageLoading}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              🖼️ Test Image Loading
            </button>
            
            <button
              onClick={testLoyaltyContext}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              💎 Check Loyalty State
            </button>
          </div>

          {/* Environment Variables Display */}
          {environmentData && (
            <div className="bg-gray-100 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-800 mb-2">🌍 Environment Check</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Server Variables:</h4>
                  <ul className="space-y-1">
                    <li>API_BASE_URL: <span className={environmentData.environment.API_BASE_URL !== 'NOT SET' ? 'text-green-600' : 'text-red-600'}>{environmentData.environment.API_BASE_URL}</span></li>
                    <li>NODE_ENV: <span className="text-blue-600">{environmentData.environment.NODE_ENV}</span></li>
                    <li>VERCEL_ENV: <span className="text-blue-600">{environmentData.environment.VERCEL_ENV}</span></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Client Variables:</h4>
                  <ul className="space-y-1">
                    <li>NEXT_PUBLIC_API_BASE_URL: <span className={environmentData.environment.NEXT_PUBLIC_API_BASE_URL !== 'NOT SET' ? 'text-green-600' : 'text-red-600'}>{environmentData.environment.NEXT_PUBLIC_API_BASE_URL}</span></li>
                    <li>Has WC Keys: <span className={environmentData.environment.HAS_WOOCOMMERCE_CONSUMER_KEY ? 'text-green-600' : 'text-red-600'}>{environmentData.environment.HAS_WOOCOMMERCE_CONSUMER_KEY ? '✅' : '❌'}</span></li>
                  </ul>
                </div>
              </div>
              
              {environmentData.recommendations && environmentData.recommendations.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Recommendations:</h4>
                  <div className="space-y-2">
                    {environmentData.recommendations.map((rec: any, i: number) => (
                      <div key={i} className={`p-2 rounded text-sm ${
                        rec.type === 'error' ? 'bg-red-100 text-red-800' :
                        rec.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {rec.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Proxy Comparison Results */}
          {proxyComparison && (
            <div className="bg-orange-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-orange-800 mb-2">🔄 Proxy vs Direct Comparison</h3>
              <div className="space-y-4">
                {proxyComparison.map((test: any, i: number) => (
                  <div key={i} className="border border-orange-200 rounded p-3">
                    <h4 className="font-medium text-orange-900 mb-2">{test.test_type.toUpperCase()} Test</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p><strong>Proxy:</strong> {test.proxy_test?.success ? '✅' : '❌'} ({test.proxy_test?.response_time_ms}ms)</p>
                        {test.proxy_test?.error && <p className="text-red-600">Error: {test.proxy_test.error}</p>}
                      </div>
                      <div>
                        <p><strong>Direct:</strong> {test.direct_test?.success ? '✅' : '❌'} ({test.direct_test?.response_time_ms}ms)</p>
                        {test.direct_test?.error && <p className="text-red-600">Error: {test.direct_test.error}</p>}
                      </div>
                    </div>
                    <div className="mt-2 p-2 bg-orange-100 rounded text-sm">
                      <strong>Recommendation:</strong> {test.comparison?.recommendation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Image Test Results */}
          {imageTestResults && (
            <div className="bg-green-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-green-800 mb-2">🖼️ Image Loading Test Results</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700">{imageTestResults.summary.successful_tests}</div>
                  <div className="text-sm text-green-600">Successful</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-700">{imageTestResults.summary.failed_tests}</div>
                  <div className="text-sm text-red-600">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-700">{imageTestResults.summary.average_response_time}ms</div>
                  <div className="text-sm text-blue-600">Avg Response</div>
                </div>
              </div>

              <div className="space-y-2">
                {imageTestResults.image_tests.map((test: any, i: number) => (
                  <div key={i} className={`p-2 rounded text-sm ${test.success ? 'bg-green-100' : 'bg-red-100'}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{test.name}</span>
                      <div className="flex items-center space-x-2">
                        <span>{test.success ? '✅' : '❌'}</span>
                        <span className="text-gray-600">{test.response_time_ms}ms</span>
                        <span className="text-gray-500">({test.status})</span>
                      </div>
                    </div>
                    {test.error && (
                      <div className="text-red-600 text-xs mt-1">Error: {test.error}</div>
                    )}
                  </div>
                ))}
              </div>

              {imageTestResults.recommendations && imageTestResults.recommendations.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Recommendations:</h4>
                  <div className="space-y-2">
                    {imageTestResults.recommendations.map((rec: any, i: number) => (
                      <div key={i} className={`p-2 rounded text-sm ${
                        rec.type === 'error' ? 'bg-red-100 text-red-800' :
                        rec.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        rec.type === 'info' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {rec.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loyalty Context State */}
          {loyaltyTest && (
            <div className="bg-purple-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-purple-800 mb-2">💎 Loyalty Context State</h3>
              <div className="text-sm">
                <p><strong>Has Cache:</strong> {loyaltyTest.hasCache ? '✅' : '❌'}</p>
                <p><strong>Has User Token:</strong> {loyaltyTest.hasUserToken ? '✅' : '❌'}</p>
                <p><strong>Cache Items:</strong> {loyaltyTest.cacheData?.length || 0}</p>
                <p><strong>Last Check:</strong> {loyaltyTest.timestamp}</p>
              </div>
            </div>
          )}
        </div>

        {/* Test Results */}
        <div className="space-y-4">
          {results.map((result, i) => (
            <div key={i} className={`border rounded-lg p-4 ${
              result.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-gray-800">{result.name}</h3>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    result.success 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {result.success ? '✅ SUCCESS' : '❌ FAILED'}
                  </span>
                  <span className="text-sm text-gray-600">{result.time}ms</span>
                </div>
              </div>
              
              <div className="text-sm text-gray-600 mb-2">
                <p><strong>URL:</strong> {result.url}</p>
                <p><strong>Status:</strong> {result.status}</p>
                {result.error && (
                  <p className="text-red-600"><strong>Error:</strong> {result.error}</p>
                )}
              </div>

              {/* Show data preview for successful requests */}
              {result.success && result.data && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700">
                    📊 Response Data Preview
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                    {typeof result.data === 'string' 
                      ? result.data.substring(0, 500) + (result.data.length > 500 ? '...' : '')
                      : JSON.stringify(result.data, null, 2).substring(0, 500) + 
                        (JSON.stringify(result.data).length > 500 ? '...' : '')
                    }
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-800 mb-2">📋 How to Use This Debug Tool</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-700">
            <div>
              <h4 className="font-semibold mb-2">🔧 Available Tests:</h4>
              <ul className="space-y-1">
                <li>• <strong>Run API Tests:</strong> Tests client-side API calls to various endpoints</li>
                <li>• <strong>Proxy vs Direct:</strong> Server-side comparison of proxy vs direct API performance</li>
                <li>• <strong>Test Image Loading:</strong> Comprehensive image loading tests (server + client)</li>
                <li>• <strong>Check Loyalty State:</strong> Inspect loyalty context cache and user state</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">🔍 Debugging Steps:</h4>
              <ol className="space-y-1">
                <li>1. <strong>Environment Check:</strong> Loads automatically - check for missing variables</li>
                <li>2. <strong>Run Proxy Comparison:</strong> Identifies if proxy or direct calls are better</li>
                <li>3. <strong>Test Images:</strong> Check if image loading issues are proxy-related</li>
                <li>4. <strong>Monitor Network Tab:</strong> Open DevTools to see real-time requests</li>
                <li>5. <strong>Check Console:</strong> Detailed logging for all tests</li>
              </ol>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-100 rounded">
            <p className="text-blue-800 text-sm">
              <strong>💡 Pro Tip:</strong> Run tests while experiencing issues on /wasparfum or checkout pages 
              to capture real-world performance problems. Results will help determine if the proxy should be kept or removed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
