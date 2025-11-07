import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Testing direct WordPress API access...');
    
    const WP_API_URL = 'https://api.wasgeurtje.nl/wp-json/wp/v2';
    const testUrl = `${WP_API_URL}/pages?slug=veel-gestelde-vragen&_fields=id,slug,title,content`;
    
    console.log('Fetching from:', testUrl);
    
    const response = await fetch(testUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        error: 'WordPress API request failed',
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
        url: testUrl,
      }, { status: 500 });
    }
    
    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      url: testUrl,
      dataReceived: Array.isArray(data),
      itemCount: Array.isArray(data) ? data.length : 1,
      firstItem: Array.isArray(data) ? data[0] : data,
    });
    
  } catch (error: any) {
    console.error('Error in test route:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}

