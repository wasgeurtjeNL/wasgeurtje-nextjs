import { NextRequest, NextResponse } from 'next/server';

// Mandrill API configuration
const MANDRILL_API_KEY = process.env.MANDRILL_API_KEY || '';
const MANDRILL_API_URL = 'https://mandrillapp.com/api/1.0/messages/send';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@wasgeurtje.nl';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@wasgeurtje.nl';
const FROM_NAME = process.env.FROM_NAME || 'Wasgeurtje Website';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  phone?: string;
  orderNumber?: string;
}

async function sendEmailViaMandrill(data: ContactFormData) {
  if (!MANDRILL_API_KEY) {
    console.error('MANDRILL_API_KEY not configured');
    throw new Error('Email service not configured');
  }

  const message = {
    key: MANDRILL_API_KEY,
    message: {
      from_email: FROM_EMAIL,
      from_name: FROM_NAME,
      to: [
        {
          email: ADMIN_EMAIL,
          name: 'Wasgeurtje Team',
          type: 'to'
        }
      ],
      subject: `Contact Form: ${data.subject}`,
      html: `
        <h2>Nieuw contactformulier bericht</h2>
        <p><strong>Naam:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        ${data.phone ? `<p><strong>Telefoon:</strong> ${data.phone}</p>` : ''}
        ${data.orderNumber ? `<p><strong>Ordernummer:</strong> ${data.orderNumber}</p>` : ''}
        <p><strong>Onderwerp:</strong> ${data.subject}</p>
        <hr>
        <p><strong>Bericht:</strong></p>
        <p>${data.message.replace(/\n/g, '<br>')}</p>
      `,
      text: `
        Nieuw contactformulier bericht
        
        Naam: ${data.name}
        Email: ${data.email}
        ${data.phone ? `Telefoon: ${data.phone}\n` : ''}
        ${data.orderNumber ? `Ordernummer: ${data.orderNumber}\n` : ''}
        Onderwerp: ${data.subject}
        
        Bericht:
        ${data.message}
      `,
      headers: {
        'Reply-To': data.email
      },
      tags: ['contact-form', 'website'],
      track_opens: true,
      track_clicks: true,
    }
  };

  const response = await fetch(MANDRILL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Mandrill API error:', errorData);
    throw new Error('Failed to send email via Mandrill');
  }

  return await response.json();
}

export async function POST(request: NextRequest) {
  try {
    const data: ContactFormData = await request.json();

    // Validate required fields
    if (!data.name || !data.email || !data.subject || !data.message) {
      return NextResponse.json(
        { message: 'Alle verplichte velden moeten ingevuld zijn' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return NextResponse.json(
        { message: 'Ongeldig e-mailadres' },
        { status: 400 }
      );
    }

    // Log submission
    console.log('Contact form submission:', {
      ...data,
      timestamp: new Date().toISOString(),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    });

    // Send email via Mandrill
    try {
      const result = await sendEmailViaMandrill(data);
      console.log('✅ Email sent via Mandrill:', result);
    } catch (emailError) {
      console.error('❌ Failed to send email:', emailError);
      // Don't fail the request if email fails, just log it
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Bedankt voor je bericht! We nemen binnen 2 werkdagen contact met je op.',
      reference: `CONTACT-${Date.now()}`
    });

  } catch (error) {
    console.error('Error processing contact form:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Er is een fout opgetreden. Probeer het later opnieuw.' 
      },
      { status: 500 }
    );
  }
}


