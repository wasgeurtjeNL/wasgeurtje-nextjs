import { NextRequest, NextResponse } from 'next/server';

/**
 * Simulate Stripe webhook for development
 * This endpoint can be called after a successful payment to trigger order creation
 */

export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId } = await request.json();

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment Intent ID is required' },
        { status: 400 }
      );
    }

    console.log('🧪 Simulating webhook for payment intent:', paymentIntentId);

    // First, get the payment details from Stripe (with better error handling)
    let paymentStatus;
    try {
      const paymentStatusResponse = await fetch(`${request.nextUrl.origin}/api/stripe/payment-status?payment_intent=${paymentIntentId}`);
      
      if (!paymentStatusResponse.ok) {
        const errorText = await paymentStatusResponse.text();
        console.error(`❌ Payment status API failed: ${paymentStatusResponse.status} - ${errorText}`);
        throw new Error(`Failed to get payment status: ${paymentStatusResponse.status}`);
      }

      paymentStatus = await paymentStatusResponse.json();
      
      if (!paymentStatus) {
        throw new Error('Empty payment status response');
      }
      
    } catch (fetchError) {
      console.error(`❌ Error fetching payment status:`, fetchError);
      return NextResponse.json(
        { 
          error: 'Webhook simulation failed', 
          details: 'Failed to get payment status',
          paymentIntentId,
          originalError: fetchError instanceof Error ? fetchError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
    console.log('📋 Payment status:', paymentStatus);

    // For development testing, allow test payments or simulations
    const allowedTestStatuses = ['succeeded', 'requires_payment_method', 'requires_action'];
    if (!allowedTestStatuses.includes(paymentStatus.status)) {
      return NextResponse.json(
        { error: 'Payment is not successful', status: paymentStatus.status },
        { status: 400 }
      );
    }

    // Force status to succeeded for simulation
    console.log(`🧪 Original payment status: ${paymentStatus.status}, forcing to 'succeeded' for simulation`);
    paymentStatus.status = 'succeeded';

    // Create a simulated webhook event payload
    const simulatedEvent = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: paymentIntentId,
          metadata: paymentStatus.metadata || {},
          amount: paymentStatus.amount,
          currency: paymentStatus.currency || 'eur',
          status: 'succeeded'
        }
      }
    };

    console.log('🎭 Simulated webhook event:', simulatedEvent);

    // Call our own webhook handler
    const webhookResponse = await fetch(`${request.nextUrl.origin}/api/stripe/webhook-handler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Simulation': 'true', // Flag to indicate this is a simulation
      },
      body: JSON.stringify(simulatedEvent),
    });

    const webhookResult = await webhookResponse.json();
    console.log('📡 Webhook handler result:', webhookResult);

    if (webhookResponse.ok) {
      return NextResponse.json({
        success: true,
        message: 'Webhook simulation successful',
        result: webhookResult,
        paymentIntentId,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Webhook simulation failed',
        details: webhookResult,
        paymentIntentId,
      });
    }

  } catch (error) {
    console.error('Error simulating webhook:', error);
    return NextResponse.json(
      { 
        error: 'Webhook simulation failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Stripe webhook simulator',
    usage: 'POST with { paymentIntentId: "pi_..." } to simulate webhook',
  });
}
