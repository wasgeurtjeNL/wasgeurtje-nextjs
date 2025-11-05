'use client';

import { useState } from 'react';

export default function TestSuccessOptimization() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const testSuccessPageOptimization = async () => {
    setIsRunning(true);
    const results = [];
    
    // Test 1: Original flow simulation (slow)
    const originalStart = Date.now();
    try {
      console.log('🔄 Testing ORIGINAL success page flow...');
      
      // Simulate what original success page does:
      // 1. Get session data
      // 2. Verify payment
      // 3. Create order
      // 4. Show success
      
      const mockSessionData = {
        orderData: {
          customer: { email: 'test@example.com' },
          lineItems: [{ id: '1425', quantity: 2 }],
          finalTotal: 34.85
        }
      };
      
      // Simulate payment verification (takes time)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate order creation (takes more time)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const originalTime = Date.now() - originalStart;
      
      results.push({
        name: 'Original Success Page Flow',
        time: originalTime,
        steps: [
          { name: 'Get session data', time: 100 },
          { name: 'Verify payment', time: 1000 },
          { name: 'Create WooCommerce order', time: 2000 },
          { name: 'Show success page', time: 200 }
        ],
        totalTime: originalTime,
        userExperience: 'User waits 3+ seconds for order creation'
      });
      
    } catch (error) {
      console.error('Original flow test failed:', error);
    }
    
    // Test 2: Optimized flow simulation (fast)
    const optimizedStart = Date.now();
    try {
      console.log('🚀 Testing OPTIMIZED success page flow...');
      
      // Simulate optimized flow:
      // 1. Check if order exists (fast)
      // 2. If exists, show immediately
      // 3. If not, fallback to original
      
      // Simulate order search (much faster)
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Simulate finding existing order
      const mockExistingOrder = {
        id: 348757,
        number: '348757',
        total: '34.85',
        status: 'completed'
      };
      
      const optimizedTime = Date.now() - optimizedStart;
      
      results.push({
        name: 'Optimized Success Page Flow (STEP 1)',
        time: optimizedTime,
        steps: [
          { name: 'Search existing orders', time: 300 },
          { name: 'Show success immediately', time: 50 }
        ],
        totalTime: optimizedTime,
        userExperience: 'User sees success page instantly',
        improvement: `${Math.round(((results[0]?.totalTime || 3000) - optimizedTime) / (results[0]?.totalTime || 3000) * 100)}% faster`
      });
      
    } catch (error) {
      console.error('Optimized flow test failed:', error);
    }
    
    // Test 3: Real API call to test order search
    const apiTestStart = Date.now();
    try {
      console.log('🔗 Testing real WooCommerce order search API...');
      
      const response = await fetch('/api/woocommerce/orders/search?payment_intent=pi_test_example');
      const data = await response.json();
      const apiTime = Date.now() - apiTestStart;
      
      results.push({
        name: 'Real WooCommerce Order Search API',
        time: apiTime,
        steps: [
          { name: 'API call to WooCommerce', time: apiTime }
        ],
        totalTime: apiTime,
        success: response.ok,
        details: data,
        userExperience: response.ok ? 'Fast order lookup' : 'API connectivity issue'
      });
      
    } catch (error) {
      console.error('API test failed:', error);
      results.push({
        name: 'Real WooCommerce Order Search API',
        time: Date.now() - apiTestStart,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    setTestResults(results);
    setIsRunning(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🧪 STEP 1: Success Page Optimization Test
          </h1>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">🎯 What STEP 1 Does</h3>
            <p className="text-sm text-blue-700">
              Deze test simuleert de success page optimization waarbij eerst wordt gechecked 
              of een order al bestaat voordat een nieuwe wordt gemaakt. Dit zou de loading tijd 
              drastisch moeten verminderen.
            </p>
          </div>

          <button
            onClick={testSuccessPageOptimization}
            disabled={isRunning}
            className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors mb-8"
          >
            {isRunning ? '⏳ Running STEP 1 Tests...' : '🚀 Test Success Page Optimization'}
          </button>
        </div>

        {/* Test Results */}
        <div className="space-y-6">
          {testResults.map((result, i) => (
            <div key={i} className={`bg-white border rounded-lg p-6 ${
              result.success === false ? 'border-red-200' : 
              result.name.includes('Optimized') ? 'border-green-200' : 'border-gray-200'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{result.name}</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>⏱️ {result.time}ms total</span>
                    {result.improvement && (
                      <span className="text-green-600 font-medium">🚀 {result.improvement}</span>
                    )}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded text-sm font-medium ${
                  result.success === false ? 'bg-red-100 text-red-800' :
                  result.name.includes('Optimized') ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {result.success === false ? '❌ Failed' :
                   result.name.includes('Optimized') ? '✅ Optimized' :
                   '📊 Baseline'}
                </span>
              </div>

              {/* Steps Breakdown */}
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 mb-2">Flow Steps:</h4>
                <div className="space-y-2">
                  {result.steps?.map((step: any, j: number) => (
                    <div key={j} className="flex justify-between items-center text-sm">
                      <span>{step.name}</span>
                      <span className="text-gray-500">{step.time}ms</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* User Experience */}
              <div className="bg-gray-50 rounded p-3">
                <h4 className="font-medium text-gray-700 text-sm mb-1">User Experience:</h4>
                <p className="text-sm text-gray-600">{result.userExperience}</p>
              </div>

              {/* Error Details */}
              {result.error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                  <h4 className="font-medium text-red-800 text-sm mb-1">Error:</h4>
                  <p className="text-sm text-red-600">{result.error}</p>
                </div>
              )}

              {/* API Details */}
              {result.details && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700">API Response Details</summary>
                  <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>

        {testResults.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h6a1 1 0 001-1V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM8 8a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm1 3a1 1 0 100 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Test STEP 1</h3>
            <p className="text-gray-600">
              Click the test button to compare original vs optimized success page performance.
            </p>
          </div>
        )}

        {/* Summary */}
        {testResults.length > 0 && (
          <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="font-semibold text-green-800 mb-2">📊 STEP 1 Optimization Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-green-700">
              <div>
                <h4 className="font-medium mb-1">Performance Improvement:</h4>
                <p>Success page loading zou veel sneller moeten zijn door eerst te checken of order al bestaat.</p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Risk Assessment:</h4>
                <p className="text-green-600">✅ LAAG RISICO - Alleen extra check toegevoegd, originele flow blijft als fallback.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
