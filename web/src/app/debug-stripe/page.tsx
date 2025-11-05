'use client';

import React, { useState } from 'react';

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
  const [environmentData, setEnvironmentData] = useState<any>(null);
  const [envLoading, setEnvLoading] = useState(true);

  // Load environment data on component mount
  const loadEnvironmentData = async () => {
    try {
      setEnvLoading(true);
      const response = await fetch('/api/debug/stripe-env');
      const data = await response.json();
      setEnvironmentData(data);
    } catch (error) {
      console.error('Error loading environment data:', error);
    } finally {
      setEnvLoading(false);
    }
  };

  // Load environment data when component mounts
  React.useEffect(() => {
    loadEnvironmentData();
  }, []);

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
      // Test 1: PaymentIntent Status (most important)
      console.log('🧪 Testing PaymentIntent status...');
      const piTest = await testPaymentIntentStatus(piId);
      results.tests.push(piTest);
      
      // Test 2: WooCommerce Order Search
      console.log('🧪 Testing WooCommerce order search...');
      const orderTest = await testWooCommerceOrderSearch(piId);
      results.tests.push(orderTest);
      
      // Test 3: Webhook Simulation (if needed)
      console.log('🧪 Testing webhook simulation...');
      const webhookTest = await testWebhookSimulation(piId);
      results.tests.push(webhookTest);

      // Calculate summary
      results.summary.success = results.tests.filter(t => t.success).length;
      results.summary.failed = results.tests.filter(t => !t.success).length;
      results.summary.totalTime = Date.now() - startTime;

      // Determine overall status
      const criticalFailures = results.tests.filter(t => 
        !t.success && ['PaymentIntent Status', 'WooCommerce Order Search'].includes(t.name)
      );
      
      if (criticalFailures.length > 0) {
        results.overallStatus = 'error';
        results.criticalIssues = criticalFailures.map(t => t.name);
      } else if (results.summary.failed > 0) {
        results.overallStatus = 'warning';
      }

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
      
      const hasOrderMetadata = !!(data.metadata?.woocommerce_order_number || data.metadata?.order_reference);
      const isSucceeded = data.status === 'succeeded';
      
      return {
        name: 'PaymentIntent Status',
        success: response.ok && isSucceeded,
        details: {
          status: data.status,
          amount: data.amount,
          currency: data.currency,
          hasOrderNumber: !!data.metadata?.woocommerce_order_number,
          hasOrderReference: !!data.metadata?.order_reference,
          orderNumber: data.metadata?.woocommerce_order_number,
          orderReference: data.metadata?.order_reference,
          metadataKeys: Object.keys(data.metadata || {})
        },
        recommendations: [
          ...(response.ok ? ['✅ PaymentIntent accessible'] : ['❌ Cannot access PaymentIntent - check STRIPE_SECRET_KEY']),
          ...(isSucceeded ? ['✅ Payment completed successfully'] : ['❌ Payment not completed - check Stripe dashboard']),
          ...(hasOrderMetadata ? ['✅ Order information found in metadata'] : ['⚠️ No order information in metadata'])
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

  const testWooCommerceOrderSearch = async (piId: string): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const response = await fetch(`/api/woocommerce/orders/search?payment_intent=${piId}`);
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      const orderCount = data.orders?.length || 0;
      const hasOrders = orderCount > 0;
      const hasDuplicates = orderCount > 1;
      
      return {
        name: 'WooCommerce Order Search',
        success: hasOrders && !hasDuplicates,
        details: { 
          orderCount, 
          duplicatesDetected: hasDuplicates,
          orders: data.orders?.map((o: any) => ({
            id: o.id,
            number: o.number,
            status: o.status,
            total: o.total,
            date_created: o.date_created,
            payment_method: o.payment_method
          }))
        },
        recommendations: [
          ...(orderCount === 0 ? ['❌ No order found - webhook may have failed'] : []),
          ...(orderCount === 1 ? ['✅ Single order found - correct state'] : []),
          ...(orderCount > 1 ? ['🚨 DUPLICATE ORDERS DETECTED - race condition issue'] : []),
          ...(data.orders?.[0]?.status === 'pending' ? ['⚠️ Order is pending - payment may not be complete'] : []),
          ...(data.orders?.[0]?.status === 'completed' ? ['✅ Order is completed'] : [])
        ],
        timestamp: new Date().toISOString(),
        responseTime
      };
    } catch (error) {
      return {
        name: 'WooCommerce Order Search',
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

  const testWebhookSimulation = async (piId: string): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const response = await fetch('/api/stripe/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId: piId })
      });
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'Webhook Simulation',
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
        name: 'Webhook Simulation',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        recommendations: [
          '❌ Webhook simulation failed',
          '🔧 Check /api/stripe/webhook-handler endpoint',
          '🔧 Verify webhook configuration'
        ],
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🔧 Stripe Payment Flow Debug Suite (Local Testing)
          </h1>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Local Testing Mode</h3>
            <p className="text-sm text-yellow-700">
              Deze debug suite test de huidige payment flow lokaal voordat wijzigingen naar productie gaan.
              Gebruik PaymentIntent IDs uit Stripe dashboard voor realistische testing.
            </p>
          </div>

          {/* Environment Status */}
          {envLoading ? (
            <div className="bg-gray-100 rounded-lg p-4 mb-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-300 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-300 rounded w-1/2"></div>
              </div>
            </div>
          ) : environmentData && (
            <div className={`rounded-lg p-4 mb-6 border ${
              environmentData.summary?.overall_status === 'ready' ? 'bg-green-50 border-green-200' :
              environmentData.summary?.overall_status === 'partial' ? 'bg-yellow-50 border-yellow-200' :
              'bg-red-50 border-red-200'
            }`}>
              <h3 className="font-semibold mb-2">
                🔧 Environment Status: {
                  environmentData.summary?.overall_status === 'ready' ? '✅ Ready' :
                  environmentData.summary?.overall_status === 'partial' ? '⚠️ Partial' :
                  '❌ Not Ready'
                }
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-1">Stripe:</h4>
                  <ul className="space-y-1">
                    <li>Secret Key: {environmentData.environment_check?.stripe?.secret_key_exists ? '✅' : '❌'} ({environmentData.environment_check?.stripe?.secret_key_prefix})</li>
                    <li>Webhook Secret: {environmentData.environment_check?.stripe?.webhook_secret_exists ? '✅' : '❌'}</li>
                    <li>Connectivity: {environmentData.environment_check?.connectivity_tests?.can_access_stripe ? '✅' : '❌'}</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-1">WooCommerce:</h4>
                  <ul className="space-y-1">
                    <li>Consumer Key: {environmentData.environment_check?.woocommerce?.consumer_key_exists ? '✅' : '❌'}</li>
                    <li>API URL: {environmentData.environment_check?.woocommerce?.api_url !== 'NOT_SET' ? '✅' : '❌'}</li>
                    <li>Connectivity: {environmentData.environment_check?.connectivity_tests?.can_access_woocommerce ? '✅' : '❌'}</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Environment:</h4>
                  <ul className="space-y-1">
                    <li>Node: {environmentData.environment_check?.environment}</li>
                    <li>Vercel: {environmentData.environment_check?.vercel_env || 'N/A'}</li>
                    <li>API Base: {environmentData.environment_check?.api?.base_url !== 'NOT_SET' ? '✅' : '❌'}</li>
                  </ul>
                </div>
              </div>

              {environmentData.recommendations && environmentData.recommendations.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Recommendations:</h4>
                  <div className="space-y-1">
                    {environmentData.recommendations.map((rec: any, i: number) => (
                      <div key={i} className={`text-sm p-2 rounded ${
                        rec.type === 'error' ? 'bg-red-100 text-red-800' :
                        rec.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        <strong>[{rec.category.toUpperCase()}]</strong> {rec.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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
              <p className="text-xs text-gray-500 mt-1">
                💡 Vind PaymentIntent IDs in Stripe Dashboard → Payments
              </p>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => runCompleteFlowTest(paymentIntentId)}
                disabled={isRunning || !paymentIntentId}
                className="w-full px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isRunning ? '⏳ Running Local Tests...' : '🧪 Test Current Flow'}
              </button>
            </div>
          </div>
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready for Local Testing</h3>
            <p className="text-gray-600 mb-4">
              Enter a PaymentIntent ID to test the current payment flow.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
              <h4 className="font-medium text-blue-800 mb-2">🔧 Setup Steps:</h4>
              <ol className="text-sm text-blue-700 space-y-1 text-left">
                <li>1. Kopieer `env.local.template` naar `.env.local`</li>
                <li>2. Vul echte Stripe test keys in</li>
                <li>3. Vul WooCommerce consumer keys in</li>
                <li>4. Start development server: `npm run dev`</li>
                <li>5. Test met echte PaymentIntent IDs</li>
              </ol>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-800 mb-2">📋 Local Testing Guide</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-700">
            <div>
              <h4 className="font-semibold mb-2">🔧 Environment Setup:</h4>
              <ul className="space-y-1">
                <li>• Gebruik Stripe TEST keys (pk_test_, sk_test_)</li>
                <li>• Gebruik productie WooCommerce keys voor data</li>
                <li>• Test met echte PaymentIntent IDs uit dashboard</li>
                <li>• Monitor console voor detailed logging</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">📊 Testing Checklist:</h4>
              <ul className="space-y-1">
                <li>• ✅ PaymentIntent accessible</li>
                <li>• ✅ Orders found without duplicates</li>
                <li>• ✅ Webhook simulation works</li>
                <li>• ✅ No critical errors</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
