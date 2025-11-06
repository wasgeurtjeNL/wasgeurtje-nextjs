'use client';

import { useState } from 'react';

export default function DebugBulkFixPage() {
  const [result, setResult] = useState<any>(null);
  const [isFixing, setIsFixing] = useState(false);

  const fixAllPendingOrders = async () => {
    setIsFixing(true);
    setResult(null);
    
    try {
      console.log('🚨 Starting bulk fix of all pending orders...');
      
      const response = await fetch('/api/debug/fix-all-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        console.log(`✅ Bulk fix completed: ${data.summary.fixedOrders} orders fixed`);
      } else {
        console.error(`❌ Bulk fix failed:`, data.error);
      }
      
    } catch (error) {
      console.error('Error in bulk fix:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🚨 Bulk Fix: Pending Orders Emergency Tool
          </h1>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-red-800 mb-2">🚨 Critical Issue Detected</h3>
            <p className="text-sm text-red-700 mb-2">
              Multiple orders are stuck in "pending" status with "Stripe (Pending Payment)" despite 
              successful payments. This indicates webhook processing has failed for multiple orders.
            </p>
            <ul className="text-sm text-red-600 space-y-1">
              <li>• <strong>Issue:</strong> Webhook handler not processing payments correctly</li>
              <li>• <strong>Impact:</strong> Orders remain pending despite successful Stripe payments</li>
              <li>• <strong>Solution:</strong> Bulk fix all pending orders with successful payments</li>
              <li>• <strong>Prevention:</strong> Simplified webhook handler implementation</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-yellow-800 mb-2">⚠️ What This Tool Does</h4>
            <ol className="text-sm text-yellow-700 space-y-1">
              <li>1. <strong>Finds</strong> all pending Stripe orders from today</li>
              <li>2. <strong>Verifies</strong> payment status in Stripe for each order</li>
              <li>3. <strong>Updates</strong> orders with successful payments to "processing" status</li>
              <li>4. <strong>Links</strong> PaymentIntent IDs to orders correctly</li>
              <li>5. <strong>Sets</strong> all required WooCommerce fields (payment_method, transaction_id, date_paid)</li>
            </ol>
          </div>

          <button
            onClick={fixAllPendingOrders}
            disabled={isFixing}
            className="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 disabled:bg-gray-400 transition-colors mb-8"
          >
            {isFixing ? '⏳ Fixing All Pending Orders...' : '🚨 Fix All Pending Orders'}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div className={`border rounded-lg p-6 ${
            result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">
                {result.success ? '✅ Bulk Fix Completed' : '❌ Bulk Fix Failed'}
              </h3>
              <span className={`px-3 py-1 rounded text-sm font-medium ${
                result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {result.success ? 'SUCCESS' : 'FAILED'}
              </span>
            </div>

            {result.success && result.summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{result.summary.totalOrders}</div>
                  <div className="text-sm text-gray-600">Total Orders</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{result.summary.fixedOrders}</div>
                  <div className="text-sm text-gray-600">Fixed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{result.summary.errorOrders}</div>
                  <div className="text-sm text-gray-600">Errors</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{result.summary.successRate}</div>
                  <div className="text-sm text-gray-600">Success Rate</div>
                </div>
              </div>
            )}

            {result.error && (
              <div className="text-sm text-red-600 mb-4">
                <strong>Error:</strong> {result.error}
              </div>
            )}

            {result.results && result.results.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3">Individual Order Results:</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {result.results.map((orderResult: any, i: number) => (
                    <div key={i} className={`p-3 rounded border text-sm ${
                      orderResult.success ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'
                    }`}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">
                          Order #{orderResult.orderNumber} (ID: {orderResult.orderId})
                        </span>
                        <span>{orderResult.success ? '✅' : '❌'}</span>
                      </div>
                      
                      {orderResult.success && orderResult.changes && (
                        <div className="mt-1 text-xs text-green-700">
                          <div>Status: {orderResult.changes.status}</div>
                          <div>Payment Method: {orderResult.changes.payment_method}</div>
                          <div>Transaction ID: {orderResult.changes.transaction_id}</div>
                        </div>
                      )}
                      
                      {orderResult.error && (
                        <div className="mt-1 text-xs text-red-700">
                          Error: {orderResult.error}
                        </div>
                      )}
                      
                      {orderResult.paymentIntentId && (
                        <div className="mt-1 text-xs text-gray-600">
                          PaymentIntent: {orderResult.paymentIntentId}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!result && (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready for Emergency Bulk Fix</h3>
            <p className="text-gray-600 mb-4">
              This tool will find and fix all pending orders with successful Stripe payments.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-sm text-red-700">
                <strong>⚠️ Warning:</strong> This will modify multiple orders. Only use if webhook 
                processing has failed and customers have successfully paid but orders remain pending.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
