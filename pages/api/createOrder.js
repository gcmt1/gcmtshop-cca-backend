import { encrypt } from '../../lib/ccavenueEncrypt';

// Helper to safely encode values
const safeEncode = (value) => 
  value ? encodeURIComponent(String(value).trim()) : '';

// Manual CORS handler that works better with Vercel
const setCorsHeaders = (res, origin) => {
  const allowedOrigins = [
    'https://gcmtshop.com',
    'https://www.gcmtshop.com',
    'http://localhost:3000',
    'http://localhost:3001'
  ];

  // Check if the origin is allowed
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Fallback for development or if origin is null
    res.setHeader('Access-Control-Allow-Origin', 'https://www.gcmtshop.com');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
};

export default async function handler(req, res) {
  try {
    // Get the origin from the request
    const origin = req.headers.origin;
    
    // Set CORS headers for all requests
    setCorsHeaders(res, origin);
    
    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
      console.log('✅ Handling OPTIONS preflight request from:', origin);
      return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
      console.log('❌ Method not allowed:', req.method);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('🚀 Creating CCAvenue order with request from:', origin);
    console.log('📋 Request body keys:', Object.keys(req.body || {}));

    // Check all possible environment variable names
    const merchant_id = process.env.MERCHANT_ID || process.env.CCAVENUE_MERCHANT_ID;
    const working_key = process.env.WORKING_KEY || process.env.CCAVENUE_WORKING_KEY;
    const access_code = process.env.ACCESS_CODE || process.env.CCAVENUE_ACCESS_CODE;
    
    console.log('🔍 Environment variables check:', {
      MERCHANT_ID: !!process.env.MERCHANT_ID,
      WORKING_KEY: !!process.env.WORKING_KEY,
      ACCESS_CODE: !!process.env.ACCESS_CODE,
      CCAVENUE_MERCHANT_ID: !!process.env.CCAVENUE_MERCHANT_ID,
      CCAVENUE_WORKING_KEY: !!process.env.CCAVENUE_WORKING_KEY,
      CCAVENUE_ACCESS_CODE: !!process.env.CCAVENUE_ACCESS_CODE,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV
    });
    
    // Validate environment variables
    if (!merchant_id || !working_key || !access_code) {
      console.error('❌ Missing environment variables:', {
        merchant_id: !!merchant_id,
        working_key: !!working_key,
        access_code: !!access_code,
        availableEnvVars: Object.keys(process.env).filter(key => 
          key.includes('MERCHANT') || key.includes('WORKING') || key.includes('ACCESS') || key.includes('CCAVENUE')
        )
      });
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Missing required environment variables',
        debug: {
          merchant_id_found: !!merchant_id,
          working_key_found: !!working_key,
          access_code_found: !!access_code,
          env: process.env.NODE_ENV || process.env.VERCEL_ENV || 'unknown'
        }
      });
    }
    
    const {
      order_id,
      amount,
      currency,
      redirect_url,
      cancel_url,
      language,
      billing_name,
      billing_address,
      billing_city,
      billing_state,
      billing_zip,
      billing_country,
      billing_tel,
      billing_email,
      delivery_name,
      delivery_address,
      delivery_city,
      delivery_state,
      delivery_zip,
      delivery_country,
      delivery_tel,
      merchant_param1,
      merchant_param2
    } = req.body || {};

    // Validate required fields
    if (!order_id || !amount || !currency || !redirect_url || !cancel_url || !language) {
      console.error('❌ Missing required request fields:', {
        order_id: !!order_id,
        amount: !!amount,
        currency: !!currency,
        redirect_url: !!redirect_url,
        cancel_url: !!cancel_url,
        language: !!language
      });
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['order_id', 'amount', 'currency', 'redirect_url', 'cancel_url', 'language']
      });
    }

    // Validate amount is a positive number
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      console.error('❌ Invalid amount:', amount);
      return res.status(400).json({ 
        error: 'Invalid amount',
        details: 'Amount must be a positive number'
      });
    }

    // Build data string with URL-encoded values
    const dataFields = [
      `merchant_id=${safeEncode(merchant_id)}`,
      `order_id=${safeEncode(order_id)}`,
      `amount=${safeEncode(amount)}`,
      `currency=${safeEncode(currency)}`,
      `redirect_url=${safeEncode(redirect_url)}`,
      `cancel_url=${safeEncode(cancel_url)}`,
      `language=${safeEncode(language)}`,
    ];

    // Add optional billing fields with safe encoding
    if (billing_name) dataFields.push(`billing_name=${safeEncode(billing_name)}`);
    if (billing_address) dataFields.push(`billing_address=${safeEncode(billing_address)}`);
    if (billing_city) dataFields.push(`billing_city=${safeEncode(billing_city)}`);
    if (billing_state) dataFields.push(`billing_state=${safeEncode(billing_state)}`);
    if (billing_zip) dataFields.push(`billing_zip=${safeEncode(billing_zip)}`);
    if (billing_country) dataFields.push(`billing_country=${safeEncode(billing_country)}`);
    if (billing_tel) dataFields.push(`billing_tel=${safeEncode(billing_tel)}`);
    if (billing_email) dataFields.push(`billing_email=${safeEncode(billing_email)}`);
    
    // Add optional delivery fields
    if (delivery_name) dataFields.push(`delivery_name=${safeEncode(delivery_name)}`);
    if (delivery_address) dataFields.push(`delivery_address=${safeEncode(delivery_address)}`);
    if (delivery_city) dataFields.push(`delivery_city=${safeEncode(delivery_city)}`);
    if (delivery_state) dataFields.push(`delivery_state=${safeEncode(delivery_state)}`);
    if (delivery_zip) dataFields.push(`delivery_zip=${safeEncode(delivery_zip)}`);
    if (delivery_country) dataFields.push(`delivery_country=${safeEncode(delivery_country)}`);
    if (delivery_tel) dataFields.push(`delivery_tel=${safeEncode(delivery_tel)}`);
    
    // Add merchant parameters
    if (merchant_param1) dataFields.push(`merchant_param1=${safeEncode(merchant_param1)}`);
    if (merchant_param2) dataFields.push(`merchant_param2=${safeEncode(merchant_param2)}`);

    const data = dataFields.join('&');
    
    console.log('🔐 Data to encrypt (length):', data.length);
    console.log('🔐 Data sample:', data.substring(0, 100) + '...');
    
    // Encrypt the data
    const encryptedBase64 = encrypt(data, working_key);

    if (!encryptedBase64 || typeof encryptedBase64 !== 'string') {
      throw new Error('Encryption failed - no result returned');
    }

    if (encryptedBase64.length < 64) {
      throw new Error(`Encrypted request is too short: ${encryptedBase64.length} characters`);
    }

    console.log('✅ Encryption successful:', {
      orderId: order_id,
      encryptedLength: encryptedBase64.length,
      dataLength: data.length
    });

    const response = {
      encRequest: encryptedBase64,
      accessCode: access_code,
      debug: {
        merchantId: merchant_id,
        orderId: order_id,
        amount: amount,
        encryptedLength: encryptedBase64.length,
        dataLength: data.length,
        timestamp: new Date().toISOString(),
        success: true
      }
    };

    console.log('📤 Sending response with encRequest length:', encryptedBase64.length);
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('💥 CCAvenue API error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Make sure CORS headers are set even for error responses
    if (!res.headersSent) {
      setCorsHeaders(res, req.headers.origin);
    }
    
    return res.status(500).json({
      error: 'Payment processing failed',
      details: error.message,
      timestamp: new Date().toISOString(),
      success: false
    });
  }
}

// Vercel configuration
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
