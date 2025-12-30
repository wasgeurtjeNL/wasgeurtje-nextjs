import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.wasgeurtje.nl';
const JWT_AUTH_URL = `${API_BASE_URL}/wp-json/jwt-auth/v1/token`;

/**
 * POST /api/auth/jwt
 * Authenticate user with WordPress JWT
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, action } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Determine the endpoint based on action
    let endpoint = JWT_AUTH_URL;
    if (action === 'validate') {
      endpoint = `${JWT_AUTH_URL}/validate`;
    }

    console.log(`🔐 JWT ${action || 'authenticate'} request for: ${username}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(action === 'validate' && body.token ? { 'Authorization': `Bearer ${body.token}` } : {})
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const responseText = await response.text();
    console.log(`📡 WordPress JWT response status: ${response.status}`);

    // Try to parse as JSON, fallback to text if it fails
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('❌ Failed to parse response as JSON:', responseText);
      
      // Check if response is HTML (nginx error page)
      if (responseText.includes('<html>') || responseText.includes('<!DOCTYPE')) {
        return NextResponse.json(
          { 
            error: 'Server configuration error. Please contact support.',
            details: 'The WordPress API returned an HTML response instead of JSON. This usually indicates a server misconfiguration or CORS issue.'
          },
          { status: 502 }
        );
      }
      
      return NextResponse.json(
        { error: 'Invalid response from authentication server' },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error('❌ JWT authentication failed:', data);
      return NextResponse.json(
        data,
        { status: response.status }
      );
    }

    console.log('✅ JWT authentication successful');
    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ JWT authentication error:', error);
    return NextResponse.json(
      { 
        error: 'Authentication server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/jwt/validate
 * Validate a JWT token
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    console.log('🔐 Validating JWT token...');

    const response = await fetch(`${JWT_AUTH_URL}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const responseText = await response.text();

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('❌ Failed to parse validation response:', responseText);
      
      if (responseText.includes('<html>') || responseText.includes('<!DOCTYPE')) {
        return NextResponse.json(
          { 
            error: 'Server configuration error',
            valid: false
          },
          { status: 502 }
        );
      }
      
      return NextResponse.json(
        { error: 'Invalid response from server', valid: false },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.log('❌ Token validation failed');
      return NextResponse.json(
        { ...data, valid: false },
        { status: response.status }
      );
    }

    console.log('✅ Token validation successful');
    return NextResponse.json({ ...data, valid: true });

  } catch (error) {
    console.error('❌ Token validation error:', error);
    return NextResponse.json(
      { 
        error: 'Validation server error',
        valid: false
      },
      { status: 500 }
    );
  }
}










