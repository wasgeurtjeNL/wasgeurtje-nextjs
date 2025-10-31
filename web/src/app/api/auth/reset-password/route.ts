import { NextRequest, NextResponse } from 'next/server';

const WORDPRESS_API_URL = process.env.NEXT_PUBLIC_WORDPRESS_API_URL || 'https://wasgeurtje.nl';

/**
 * Password reset endpoint
 * Calls WordPress lost password functionality
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'E-mailadres is verplicht' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Voer een geldig e-mailadres in' },
        { status: 400 }
      );
    }

    console.log('Password reset requested for:', email);

    // Call custom WordPress REST API endpoint for password reset
    const response = await fetch(
      `${WORDPRESS_API_URL}/wp-json/custom/v1/password-reset`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Password reset failed:', data);
      return NextResponse.json(
        { error: data.error || 'Er is een fout opgetreden bij het versturen van de resetlink.' },
        { status: response.status }
      );
    }

    console.log('Password reset email sent successfully');

    return NextResponse.json({
      success: true,
      message: data.message || 'Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten een e-mail met instructies.',
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Er is een fout opgetreden bij het versturen van de resetlink. Probeer het later opnieuw.' },
      { status: 500 }
    );
  }
}

