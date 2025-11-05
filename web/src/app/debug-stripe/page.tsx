'use client';

import { useState } from 'react';

interface TestResult {
  name: string;
  success: boolean;
  details?: any;
  error?: string;
  recommendations: string[];
  timestamp: string;
  responseTime?: number;
}

interface FlowTestResult {
  paymentIntentId: string;
  tests: TestResult[];
  summary: {
    success: number;
    failed: number;
    totalTime: number;
  };
  overallStatus: 'success' | 'warning' | 'error';
  criticalIssues: string[];
}

export default function StripeDebugPage() {
  const [testResults, setTestResults] = useState<FlowTestResult[]>([]);
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [recentPaymentIntents, setRecentPaymentIntents] = useState<string[]>([]);

  const runCompleteFlowTest = async (piId: string) => {
    if (!piId.startsWith('pi_')) {
      alert('Please enter a valid PaymentIntent ID (starts with pi_)');
      return;
    }

    setIsRunning(true);
    const startTime = Date.now();
    
    const results: FlowTestResult = {
      paymentIntentId: piId,
      tests: [],
      summary: { success: 0, failed: 0, totalTime: 0 },
      overallStatus: 'success',
      criticalIssues: []
    };

    try {
      // Test 1: PaymentIntent Status & Metadata
      console.log('🧪 Testing PaymentIntent status...');
      const piTest = await testPaymentIntentStatus(piId);
      results.tests.push(piTest);
      
      // Test 2: Webhook Processing Check
      console.log('🧪 Testing webhook processing...');
      const webhookTest = await testWebhookProcessing(piId);
      results.tests.push(webhookTest);
      
      // Test 3: WooCommerce Order Existence & Duplicates
      console.log('🧪 Testing WooCommerce order...');
      const orderTest = await testWooCommerceOrder(piId);
      results.tests.push(orderTest);
      
      // Test 4: Success Page Flow Simulation
      console.log('🧪 Testing success page flow...');
      const successTest = await testSuccessPageFlow(piId);
      results.tests.push(successTest);
      
      // Test 5: Payment-Order Link Integrity
      console.log('🧪 Testing payment-order link integrity...');
      const linkTest = await testPaymentOrderLink(piId);
      results.tests.push(linkTest);

      // Calculate summary
      results.summary.success = results.tests.filter(t => t.success).length;
      results.summary.failed = results.tests.filter(t => !t.success).length;
      results.summary.totalTime = Date.now() - startTime;

      // Determine overall status
      const criticalFailures = results.tests.filter(t => 
        !t.success && ['PaymentIntent Status', 'WooCommerce Order Check'].includes(t.name)
      );
      
      if (criticalFailures.length > 0) {
        results.overallStatus = 'error';
        results.criticalIssues = criticalFailures.map(t => t.name);
      } else if (results.summary.failed > 0) {
        results.overallStatus = 'warning';
      }

      // Add to recent payment intents
      setRecentPaymentIntents(prev => {
        const updated = [piId, ...prev.filter(id => id !== piId)];
        return updated.slice(0, 5); // Keep last 5
      });

    } catch (error) {
      results.criticalIssues.push('Test execution failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
      results.overallStatus = 'error';
    }

    setTestResults(prev => [results, ...prev]);
    setIsRunning(false);
  };

  const testPaymentIntentStatus = async (piId: string): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const response = await fetch(`/api/stripe/payment-status?payment_intent=${piId}`);
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      const hasOrderMetadata = !!(data.metadata?.woocommerce_order_number);
      const isSucceeded = data.status === 'succeeded';
      
      return {
        name: 'PaymentIntent Status',
        success: response.ok && isSucceeded,
        details: {
          status: data.status,
          amount: data.amount,
          currency: data.currency,
          hasOrderNumber: hasOrderMetadata,
          orderNumber: data.metadata?.woocommerce_order_number,
          metadata: data.metadata
        },
        recommendations: [
          ...(!isSucceeded ? ['❌ Payment not completed - check Stripe dashboard'] : []),
          ...(!hasOrderMetadata ? ['⚠️ No WooCommerce order number in metadata - order may have been created post-payment'] : ['✅ Order number found in metadata']),
          ...(response.ok ? ['✅ PaymentIntent accessible'] : ['❌ Cannot access PaymentIntent'])
        ],
        timestamp: new Date().toISOString(),
        responseTime
      };
    } catch (error) {
      return {
        name: 'PaymentIntent Status',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        recommendations: [
          '❌ Cannot access PaymentIntent',
          '🔧 Check STRIPE_SECRET_KEY configuration',
          '🔧 Verify PaymentIntent ID is correct'
        ],
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  };

  const testWebhookProcessing = async (piId: string): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      // Test webhook simulation to see if it works
      const response = await fetch('/api/stripe/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId: piId })
      });
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'Webhook Processing',
        success: response.ok && data.success,
        details: data,
        recommendations: [
          ...(data.success ? ['✅ Webhook simulation successful'] : ['❌ Webhook simulation failed']),
          ...(data.result?.orderId ? ['✅ Order created via webhook'] : ['⚠️ No order created']),
          ...(response.ok ? [] : ['🔧 Check webhook handler configuration'])
        ],
        timestamp: new Date().toISOString(),
        responseTime
      };
    } catch (error) {
      return {
        name: 'Webhook Processing',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        recommendations: [
          '❌ Webhook simulation failed',
          '🔧 Check /api/stripe/webhook-handler endpoint',
          '🔧 Verify STRIPE_WEBHOOK_SECRET configuration'
        ],
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  };

  const testWooCommerceOrder = async (piId: string): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const response = await fetch(`/api/woocommerce/orders/search?payment_intent=${piId}`);
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      const orderCount = data.orders?.length || 0;
      const hasOrders = orderCount > 0;
      const hasDuplicates = orderCount > 1;
      
      return {
        name: 'WooCommerce Order Check',
        success: hasOrders && !hasDuplicates,
        details: { 
          orderCount, 
          orders: data.orders?.map((o: any) => ({
            id: o.id,
            number: o.number,
            status: o.status,
            total: o.total,
            date_created: o.date_created
          }))
        },
        recommendations: [
          ...(orderCount === 0 ? ['❌ No order found - webhook may have failed or order creation pending'] : []),
          ...(orderCount === 1 ? ['✅ Single order found - correct state'] : []),
          ...(orderCount > 1 ? ['🚨 DUPLICATE ORDERS DETECTED - race condition issue'] : []),
          ...(data.orders?.[0]?.status === 'pending' ? ['⚠️ Order is still pending - payment may not have completed'] : []),
          ...(data.orders?.[0]?.status === 'completed' ? ['✅ Order is completed'] : [])
        ],
        timestamp: new Date().toISOString(),
        responseTime
      };
    } catch (error) {
      return {
        name: 'WooCommerce Order Check',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        recommendations: [
          '❌ Cannot search WooCommerce orders',
          '🔧 Check WooCommerce API connectivity',
          '🔧 Verify consumer keys configuration'
        ],
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  };

  const testSuccessPageFlow = async (piId: string): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      // Simulate what success page does
      const sessionData = sessionStorage.getItem('successOrderData');
      const hasSessionData = !!sessionData;
      
      // Test if success page would load quickly
      const mockSuccessPageLoad = async () => {
        // Check if order exists first (optimized flow)
        const orderResponse = await fetch(`/api/woocommerce/orders/search?payment_intent=${piId}`);
        const orderData = await orderResponse.json();
        
        if (orderData.orders?.length > 0) {
          return { fast: true, orderFound: true, loadTime: Date.now() - startTime };
        }
        
        // Would need to create order (slow path)
        return { fast: false, orderFound: false, loadTime: Date.now() - startTime };
      };
      
      const pageTest = await mockSuccessPageLoad();
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'Success Page Flow',
        success: pageTest.fast,
        details: {
          hasSessionData,
          orderFound: pageTest.orderFound,
          wouldLoadFast: pageTest.fast,
          estimatedLoadTime: pageTest.loadTime
        },
        recommendations: [
          ...(pageTest.fast ? ['✅ Success page would load quickly'] : ['⚠️ Success page would be slow (order creation needed)']),
          ...(hasSessionData ? ['✅ Session data available'] : ['⚠️ No session data - may need fallback']),
          ...(pageTest.orderFound ? ['✅ Order exists for immediate display'] : ['❌ Order would need to be created during page load'])
        ],
        timestamp: new Date().toISOString(),
        responseTime
      };
    } catch (error) {
      return {
        name: 'Success Page Flow',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        recommendations: [
          '❌ Success page flow test failed',
          '🔧 Check session storage and API connectivity'
        ],
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  };

  const testPaymentOrderLink = async (piId: string): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      // Get PaymentIntent metadata
      const piResponse = await fetch(`/api/stripe/payment-status?payment_intent=${piId}`);
      const piData = await piResponse.json();
      
      // Get WooCommerce orders
      const orderResponse = await fetch(`/api/woocommerce/orders/search?payment_intent=${piId}`);
      const orderData = await orderResponse.json();
      
      const responseTime = Date.now() - startTime;
      
      const piOrderNumber = piData.metadata?.woocommerce_order_number;
      const wcOrders = orderData.orders || [];
      const wcOrderNumbers = wcOrders.map((o: any) => o.number);
      
      const isLinked = piOrderNumber && wcOrderNumbers.includes(piOrderNumber);
      const hasConsistentLink = wcOrders.length === 1 && isLinked;
      
      return {
        name: 'Payment-Order Link Integrity',
        success: hasConsistentLink,
        details: {
          paymentIntentOrderNumber: piOrderNumber,
          wooCommerceOrderNumbers: wcOrderNumbers,
          isLinked,
          orderCount: wcOrders.length
        },
        recommendations: [
          ...(hasConsistentLink ? ['✅ Payment and order are properly linked'] : []),
          ...(!piOrderNumber ? ['⚠️ No order number in PaymentIntent metadata'] : []),
          ...(wcOrders.length === 0 ? ['❌ No WooCommerce orders found'] : []),
          ...(wcOrders.length > 1 ? ['🚨 Multiple WooCommerce orders - duplicate issue'] : []),
          ...(!isLinked && piOrderNumber ? ['❌ PaymentIntent order number does not match WooCommerce orders'] : [])
        ],
        timestamp: new Date().toISOString(),
        responseTime
      };
    } catch (error) {
      return {
        name: 'Payment-Order Link Integrity',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        recommendations: [
          '❌ Cannot verify payment-order link',
          '🔧 Check both Stripe and WooCommerce API access'
        ],
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  };

  const getRecentPaymentIntents = async () => {
    try {
      // This would need to be implemented to get recent payment intents
      // For now, just return empty array
      return [];
    } catch (error) {
      console.error('Error fetching recent payment intents:', error);
      return [];
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🔧 Stripe Payment Flow Debug Suite
          </h1>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">🎯 What This Tests</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>PaymentIntent Status:</strong> Payment completion and metadata</li>
              <li>• <strong>Webhook Processing:</strong> Order creation via webhook</li>
              <li>• <strong>WooCommerce Orders:</strong> Existence, duplicates, and status</li>
              <li>• <strong>Success Page Flow:</strong> Loading performance simulation</li>
              <li>• <strong>Payment-Order Link:</strong> Data consistency between Stripe and WooCommerce</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test PaymentIntent ID
              </label>
              <input
                type="text"
                value={paymentIntentId}
                onChange={(e) => setPaymentIntentId(e.target.value)}
                placeholder="pi_1234567890abcdef..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => runCompleteFlowTest(paymentIntentId)}
                disabled={isRunning || !paymentIntentId}
                className="w-full px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isRunning ? '⏳ Running Tests...' : '🚀 Run Complete Flow Test'}
              </button>
            </div>
          </div>

          {recentPaymentIntents.length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-700 mb-2">Recent Tests:</h4>
              <div className="flex flex-wrap gap-2">
                {recentPaymentIntents.map((piId) => (
                  <button
                    key={piId}
                    onClick={() => setPaymentIntentId(piId)}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border"
                  >
                    {piId.substring(0, 15)}...
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Test Results */}
        <div className="space-y-6">
          {testResults.map((result, i) => (
            <div key={i} className={`border rounded-lg p-6 ${
              result.overallStatus === 'success' ? 'bg-green-50 border-green-200' :
              result.overallStatus === 'warning' ? 'bg-yellow-50 border-yellow-200' :
              'bg-red-50 border-red-200'
            }`}>
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {result.paymentIntentId}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>✅ {result.summary.success} passed</span>
                    <span>❌ {result.summary.failed} failed</span>
                    <span>⏱️ {result.summary.totalTime}ms</span>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded text-sm font-medium ${
                  result.overallStatus === 'success' ? 'bg-green-100 text-green-800' :
                  result.overallStatus === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {result.overallStatus === 'success' ? '✅ ALL GOOD' :
                   result.overallStatus === 'warning' ? '⚠️ ISSUES' :
                   '🚨 CRITICAL'}
                </span>
              </div>

              {/* Critical Issues */}
              {result.criticalIssues.length > 0 && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded">
                  <h4 className="font-medium text-red-800 mb-1">🚨 Critical Issues:</h4>
                  <ul className="text-sm text-red-700">
                    {result.criticalIssues.map((issue, j) => (
                      <li key={j}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Individual Test Results */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {result.tests.map((test, j) => (
                  <div key={j} className={`border rounded p-3 ${
                    test.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-sm">{test.name}</h4>
                      <div className="flex items-center space-x-1">
                        <span>{test.success ? '✅' : '❌'}</span>
                        {test.responseTime && (
                          <span className="text-xs text-gray-500">{test.responseTime}ms</span>
                        )}
                      </div>
                    </div>
                    
                    {test.error && (
                      <div className="text-xs text-red-600 mb-2">
                        <strong>Error:</strong> {test.error}
                      </div>
                    )}
                    
                    {test.details && (
                      <details className="mb-2">
                        <summary className="text-xs cursor-pointer text-gray-600">View Details</summary>
                        <pre className="text-xs mt-1 p-2 bg-gray-100 rounded overflow-auto max-h-32">
                          {JSON.stringify(test.details, null, 2)}
                        </pre>
                      </details>
                    )}
                    
                    <div className="space-y-1">
                      {test.recommendations.map((rec, k) => (
                        <div key={k} className="text-xs">
                          {rec}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {testResults.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm3 2h6a1 1 0 110 2H7a1 1 0 110-2zm0 4h6a1 1 0 110 2H7a1 1 0 110-2zm0 4h6a1 1 0 110 2H7a1 1 0 110-2z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Tests Run Yet</h3>
            <p className="text-gray-600 mb-4">
              Enter a PaymentIntent ID and run a test to analyze the payment flow.
            </p>
            <p className="text-sm text-gray-500">
              💡 You can find PaymentIntent IDs in your Stripe dashboard or from recent orders.
            </p>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-800 mb-2">📋 How to Use This Debug Tool</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-700">
            <div>
              <h4 className="font-semibold mb-2">🔍 Finding PaymentIntent IDs:</h4>
              <ul className="space-y-1">
                <li>• Check Stripe Dashboard → Payments</li>
                <li>• Look for recent successful payments</li>
                <li>• Copy PaymentIntent ID (starts with pi_)</li>
                <li>• Test both successful and failed payments</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">📊 Interpreting Results:</h4>
              <ul className="space-y-1">
                <li>• <span className="text-green-600">✅ ALL GOOD:</span> Payment flow working perfectly</li>
                <li>• <span className="text-yellow-600">⚠️ ISSUES:</span> Minor problems, may cause delays</li>
                <li>• <span className="text-red-600">🚨 CRITICAL:</span> Major issues, orders may fail</li>
                <li>• Check recommendations for specific fixes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
