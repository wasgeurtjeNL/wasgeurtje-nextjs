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

  // Mandrill API expects the payload in a specific format
  const payload = {
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
      subject: `Contactformulier: ${data.subject}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            h2 { color: #d6ad61; }
            .field { margin-bottom: 15px; }
            .field strong { display: inline-block; width: 120px; }
            hr { border: none; border-top: 2px solid #e9c356; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>📬 Nieuw Contactformulier Bericht</h2>
            <div class="field"><strong>Naam:</strong> ${data.name}</div>
            <div class="field"><strong>Email:</strong> ${data.email}</div>
            ${data.phone ? `<div class="field"><strong>Telefoon:</strong> ${data.phone}</div>` : ''}
            ${data.orderNumber ? `<div class="field"><strong>Ordernummer:</strong> ${data.orderNumber}</div>` : ''}
            <div class="field"><strong>Onderwerp:</strong> ${data.subject}</div>
            <hr>
            <h3>Bericht:</h3>
            <p>${data.message.replace(/\n/g, '<br>')}</p>
          </div>
        </body>
        </html>
      `,
      text: `Nieuw contactformulier bericht\n\nNaam: ${data.name}\nEmail: ${data.email}\n${data.phone ? `Telefoon: ${data.phone}\n` : ''}${data.orderNumber ? `Ordernummer: ${data.orderNumber}\n` : ''}Onderwerp: ${data.subject}\n\nBericht:\n${data.message}`,
      headers: {
        'Reply-To': data.email
      },
      tags: ['contact-form', 'website'],
      track_opens: true,
      track_clicks: true,
    }
  };

  console.log('📧 Mandrill payload ready, API key present:', !!MANDRILL_API_KEY);

  console.log('📧 Sending email via Mandrill to:', ADMIN_EMAIL);
  
  const response = await fetch(MANDRILL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseData = await response.json();
  
  if (!response.ok) {
    console.error('❌ Mandrill API error:', {
      status: response.status,
      statusText: response.statusText,
      data: responseData
    });
    throw new Error(`Mandrill API error: ${responseData.message || response.statusText}`);
  }

  // Check for Mandrill specific errors in successful response
  if (Array.isArray(responseData) && responseData[0]) {
    const result = responseData[0];
    if (result.status === 'rejected' || result.status === 'invalid') {
      console.error('❌ Mandrill rejected email:', result);
      throw new Error(`Email rejected: ${result.reject_reason || 'Unknown reason'}`);
    }
    console.log('✅ Mandrill email sent:', {
      status: result.status,
      id: result._id,
      recipient: result.email
    });
  }

  return responseData;
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


