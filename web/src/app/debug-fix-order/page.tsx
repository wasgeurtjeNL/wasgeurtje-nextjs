'use client';

import { useState } from 'react';

export default function DebugFixOrderPage() {
  const [orderId, setOrderId] = useState('348769');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [isFixing, setIsFixing] = useState(false);

  const fixOrder = async () => {
    if (!orderId || !paymentIntentId) {
      alert('Please provide both Order ID and PaymentIntent ID');
      return;
    }

    setIsFixing(true);
    
    try {
      console.log(`🔧 Fixing order ${orderId} with PaymentIntent ${paymentIntentId}`);
      
      const response = await fetch('/api/debug/fix-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId,
          paymentIntentId: paymentIntentId
        })
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        console.log(`✅ Order ${orderId} successfully fixed!`);
      } else {
        console.error(`❌ Failed to fix order ${orderId}:`, data.error);
      }
      
    } catch (error) {
      console.error('Error fixing order:', error);
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
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🔧 Order Fix Tool
          </h1>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-red-800 mb-2">🚨 Webhook Issue Detected</h3>
            <p className="text-sm text-red-700 mb-2">
              Order #348769 was created as pending but webhook failed to update it to completed status 
              after successful payment. This tool manually fixes such orders.
            </p>
            <ul className="text-sm text-red-600 space-y-1">
              <li>• <strong>Issue:</strong> Pre-created order not updated by webhook</li>
              <li>• <strong>Status:</strong> pending (should be completed)</li>
              <li>• <strong>Payment:</strong> Successful in Stripe but not reflected in WooCommerce</li>
              <li>• <strong>Fix:</strong> Manual status update with PaymentIntent linking</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                WooCommerce Order ID
              </label>
              <input
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="348769"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stripe PaymentIntent ID
              </label>
              <input
                type="text"
                value={paymentIntentId}
                onChange={(e) => setPaymentIntentId(e.target.value)}
                placeholder="pi_3SQ33JdU1452TfM1ZjwR33"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={fixOrder}
            disabled={isFixing || !orderId || !paymentIntentId}
            className="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 disabled:bg-gray-400 transition-colors mb-8"
          >
            {isFixing ? '⏳ Fixing Order...' : '🔧 Fix Order Status'}
          </button>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">📋 How to Use:</h4>
            <ol className="text-sm text-blue-700 space-y-1">
              <li>1. Find the Order ID from WooCommerce (e.g., 348769)</li>
              <li>2. Find the PaymentIntent ID from Stripe dashboard</li>
              <li>3. Enter both IDs above</li>
              <li>4. Click "Fix Order Status" to manually update</li>
              <li>5. Order will be marked as completed and linked to PaymentIntent</li>
            </ol>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className={`border rounded-lg p-6 ${
            result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">
                {result.success ? '✅ Order Fixed Successfully' : '❌ Order Fix Failed'}
              </h3>
              <span className={`px-3 py-1 rounded text-sm font-medium ${
                result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {result.success ? 'SUCCESS' : 'FAILED'}
              </span>
            </div>

            {result.success ? (
              <div className="space-y-2 text-sm">
                <p><strong>Order Number:</strong> #{result.orderNumber}</p>
                <p><strong>Previous Status:</strong> {result.previousStatus}</p>
                <p><strong>New Status:</strong> {result.newStatus}</p>
                <p><strong>PaymentIntent:</strong> {result.paymentIntentId}</p>
                <p><strong>Fixed At:</strong> {result.timestamp}</p>
                <p><strong>Message:</strong> {result.message}</p>
              </div>
            ) : (
              <div className="text-sm text-red-600">
                <p><strong>Error:</strong> {result.error}</p>
              </div>
            )}

            {/* Next Steps */}
            {result.success && (
              <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded">
                <h4 className="font-medium text-green-800 mb-1">✅ Next Steps:</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Order is now marked as completed and paid</li>
                  <li>• Customer will receive order confirmation email</li>
                  <li>• Order is linked to PaymentIntent for tracking</li>
                  <li>• Check WooCommerce admin to verify status</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Analysis */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-800 mb-2">🔍 Issue Analysis</h3>
          <div className="text-sm text-yellow-700 space-y-2">
            <p><strong>Problem:</strong> Pre-created orders not being updated by webhook after successful payment.</p>
            <p><strong>Impact:</strong> Orders remain in "pending" status despite successful payment.</p>
            <p><strong>Root Cause:</strong> Webhook handler not finding/updating pre-created orders correctly.</p>
            <p><strong>Solution:</strong> Manual fix + webhook handler improvement needed.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
