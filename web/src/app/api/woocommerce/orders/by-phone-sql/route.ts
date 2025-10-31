import { NextRequest, NextResponse } from 'next/server';

const WORDPRESS_DB_HOST = process.env.WORDPRESS_DB_HOST || 'localhost';
const WORDPRESS_DB_NAME = process.env.WORDPRESS_DB_NAME || 'wordpress';
const WORDPRESS_DB_USER = process.env.WORDPRESS_DB_USER!;
const WORDPRESS_DB_PASSWORD = process.env.WORDPRESS_DB_PASSWORD!;
const WORDPRESS_TABLE_PREFIX = process.env.WORDPRESS_TABLE_PREFIX || 'wp_';

/**
 * GET /api/woocommerce/orders/by-phone-sql
 * Direct database lookup for orders by phone number
 * Query params: phone (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone || !phone.trim()) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Normalize phone number for comparison (remove spaces, dashes, etc.)
    const normalizePhone = (phoneStr: string) => {
      return phoneStr
        .replace(/[\s\-\(\)]/g, '')
        .replace(/^\+31/, '0')
        .replace(/^0031/, '0');
    };

    const normalizedSearchPhone = normalizePhone(phone);
    console.log('🔍 SQL Search for phone:', phone, '(normalized:', normalizedSearchPhone, ')');

    // Import mysql2 for database connection
    const mysql = require('mysql2/promise');
    
    const connection = await mysql.createConnection({
      host: WORDPRESS_DB_HOST,
      user: WORDPRESS_DB_USER,
      password: WORDPRESS_DB_PASSWORD,
      database: WORDPRESS_DB_NAME,
    });

    try {
      // Query to find orders with matching phone number
      // We search with LIKE to handle different phone formats in the database
      const [rows] = await connection.execute(
        `
        SELECT 
          p.ID as order_id,
          p.post_date as order_date,
          MAX(CASE WHEN pm.meta_key = '_billing_phone' THEN pm.meta_value END) as billing_phone,
          MAX(CASE WHEN pm.meta_key = '_billing_first_name' THEN pm.meta_value END) as billing_first_name,
          MAX(CASE WHEN pm.meta_key = '_billing_last_name' THEN pm.meta_value END) as billing_last_name,
          MAX(CASE WHEN pm.meta_key = '_billing_email' THEN pm.meta_value END) as billing_email,
          MAX(CASE WHEN pm.meta_key = '_billing_address_1' THEN pm.meta_value END) as billing_address_1,
          MAX(CASE WHEN pm.meta_key = '_billing_address_2' THEN pm.meta_value END) as billing_address_2,
          MAX(CASE WHEN pm.meta_key = '_billing_city' THEN pm.meta_value END) as billing_city,
          MAX(CASE WHEN pm.meta_key = '_billing_postcode' THEN pm.meta_value END) as billing_postcode,
          MAX(CASE WHEN pm.meta_key = '_billing_country' THEN pm.meta_value END) as billing_country
        FROM ${WORDPRESS_TABLE_PREFIX}posts p
        INNER JOIN ${WORDPRESS_TABLE_PREFIX}postmeta pm ON p.ID = pm.post_id
        WHERE p.post_type = 'shop_order'
          AND p.post_status IN ('wc-completed', 'wc-processing', 'wc-on-hold')
          AND pm.meta_key IN (
            '_billing_phone', '_billing_first_name', '_billing_last_name', 
            '_billing_email', '_billing_address_1', '_billing_address_2',
            '_billing_city', '_billing_postcode', '_billing_country'
          )
        GROUP BY p.ID, p.post_date
        HAVING billing_phone IS NOT NULL
        ORDER BY p.post_date DESC
        LIMIT 100
        `
      );

      console.log(`📦 Retrieved ${rows.length} orders from database`);

      // Filter by normalized phone number
      const matchingOrders = rows.filter((row: any) => {
        const orderPhone = row.billing_phone;
        if (!orderPhone) return false;
        
        const normalizedOrderPhone = normalizePhone(orderPhone);
        const matches = normalizedOrderPhone === normalizedSearchPhone;
        
        console.log(`Order #${row.order_id}: "${orderPhone}" -> "${normalizedOrderPhone}" vs "${normalizedSearchPhone}" ${matches ? '✅ MATCH' : '❌'}`);
        
        return matches;
      });

      console.log(`🔍 Found ${matchingOrders.length} matching orders`);

      if (matchingOrders.length === 0) {
        await connection.end();
        return NextResponse.json({ found: false, order: null });
      }

      // Get the most recent order (first one, since we sorted by date DESC)
      const mostRecentOrder = matchingOrders[0];
      
      console.log('✅ Found order:', mostRecentOrder.order_id);

      // Extract relevant address information
      const addressInfo = {
        orderId: mostRecentOrder.order_id,
        orderDate: mostRecentOrder.order_date,
        billing: {
          firstName: mostRecentOrder.billing_first_name || '',
          lastName: mostRecentOrder.billing_last_name || '',
          phone: mostRecentOrder.billing_phone || '',
          email: mostRecentOrder.billing_email || '',
          address1: mostRecentOrder.billing_address_1 || '',
          address2: mostRecentOrder.billing_address_2 || '',
          city: mostRecentOrder.billing_city || '',
          postcode: mostRecentOrder.billing_postcode || '',
          country: mostRecentOrder.billing_country || '',
          fullAddress: `${mostRecentOrder.billing_address_1 || ''} ${mostRecentOrder.billing_address_2 || ''}`.trim(),
        },
      };

      await connection.end();
      
      return NextResponse.json({
        found: true,
        order: addressInfo,
      });
    } catch (dbError) {
      await connection.end();
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error in SQL phone lookup:', error);
    return NextResponse.json(
      { error: 'Failed to search database', details: error.message },
      { status: 500 }
    );
  }
}

