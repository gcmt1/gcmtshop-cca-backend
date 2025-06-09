// File: pages/api/createOrder.js
import Cors from 'cors';
import initMiddleware from '../../lib/init-middleware.js';
import { encrypt } from '../../lib/ccavenueEncrypt.js';

const cors = initMiddleware(
  Cors({
    methods: ['POST', 'OPTIONS'],
    origin: ['https://gcmtshop.com', 'http://localhost:3000'],
    credentials: true,
  })
);

export default async function handler(req, res) {
  await cors(req, res);
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ✅ Get credentials from environment variables ONLY
    const merchant_id = process.env.MERCHANT_ID;
    const working_key = process.env.WORKING_KEY;
    const access_code = process.env.ACCESS_CODE; // ✅ ADD THIS
    
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
    } = req.body;

    // ✅ Validate all required fields including credentials
    if (
      !merchant_id || !working_key || !access_code ||
      !order_id || !amount || !currency ||
      !redirect_url || !cancel_url || !language
    ) {
      console.error('❌ Missing required fields:', {
        hasMerchantId: !!merchant_id,
        hasWorkingKey: !!working_key,
        hasAccessCode: !!access_code,
        hasOrderId: !!order_id,
        hasAmount: !!amount,
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // ✅ Build the data string in the exact order CCAvenue expects
    const dataFields = [
      `merchant_id=${merchant_id}`,
      `order_id=${order_id}`,
      `amount=${amount}`,
      `currency=${currency}`,
      `redirect_url=${redirect_url}`,
      `cancel_url=${cancel_url}`,
      `language=${language}`,
    ];

    // Add optional fields
    if (billing_name) dataFields.push(`billing_name=${billing_name}`);
    if (billing_address) dataFields.push(`billing_address=${billing_address}`);
    if (billing_city) dataFields.push(`billing_city=${billing_city}`);
    if (billing_state) dataFields.push(`billing_state=${billing_state}`);
    if (billing_zip) dataFields.push(`billing_zip=${billing_zip}`);
    if (billing_country) dataFields.push(`billing_country=${billing_country}`);
    if (billing_tel) dataFields.push(`billing_tel=${billing_tel}`);
    if (billing_email) dataFields.push(`billing_email=${billing_email}`);
    if (delivery_name) dataFields.push(`delivery_name=${delivery_name}`);
    if (delivery_address) dataFields.push(`delivery_address=${delivery_address}`);
    if (delivery_city) dataFields.push(`delivery_city=${delivery_city}`);
    if (delivery_state) dataFields.push(`delivery_state=${delivery_state}`);
    if (delivery_zip) dataFields.push(`delivery_zip=${delivery_zip}`);
    if (delivery_country) dataFields.push(`delivery_country=${delivery_country}`);
    if (delivery_tel) dataFields.push(`delivery_tel=${delivery_tel}`);
    if (merchant_param1) dataFields.push(`merchant_param1=${merchant_param1}`);

    const data = dataFields.join('&');
    
    console.log('🔐 Data to encrypt:', data.substring(0, 100) + '...');
    console.log('🔑 Working key length:', working_key.length);

    const encryptedHex = encrypt(data, working_key);

    if (!encryptedHex || encryptedHex.length < 32) {
      throw new Error('Encrypted output is invalid or too short.');
    }

    console.log('✅ Encryption successful, length:', encryptedHex.length);

    return res.status(200).json({
      encRequest: encryptedHex,
      accessCode: access_code, // ✅ RETURN ACCESS CODE
      debug: {
        originalDataLength: data.length,
        encryptedLength: encryptedHex.length,
        timestamp: new Date().toISOString(),
        merchantId: merchant_id, // For debugging
      }
    });

  } catch (error) {
    console.error('💥 Error in /api/createOrder:', error);
    return res.status(500).json({
      error: 'Encryption failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
