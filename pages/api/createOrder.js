import Cors from 'cors';
import initMiddleware from '../../lib/init-middleware';
import { encrypt } from '../../lib/ccavenueEncrypt';

const cors = initMiddleware(
  Cors({
    methods: ['POST', 'OPTIONS'],
    origin: ['https://gcmtshop.com', 'http://localhost:3000'],
    credentials: true,
  })
);

// Helper to safely encode values
const safeEncode = (value) => 
  value ? encodeURIComponent(value) : '';

export default async function handler(req, res) {
  await cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const merchant_id = process.env.MERCHANT_ID;
    const working_key = process.env.WORKING_KEY;
    const access_code = process.env.ACCESS_CODE;
    
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

    // Validate required fields
    if (!merchant_id || !working_key || !access_code ||
        !order_id || !amount || !currency ||
        !redirect_url || !cancel_url || !language) {
      return res.status(400).json({ error: 'Missing required fields' });
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

    // Add optional fields with safe encoding
    if (billing_name) dataFields.push(`billing_name=${safeEncode(billing_name)}`);
    if (billing_address) dataFields.push(`billing_address=${safeEncode(billing_address)}`);
    if (billing_city) dataFields.push(`billing_city=${safeEncode(billing_city)}`);
    if (billing_state) dataFields.push(`billing_state=${safeEncode(billing_state)}`);
    if (billing_zip) dataFields.push(`billing_zip=${safeEncode(billing_zip)}`);
    if (billing_country) dataFields.push(`billing_country=${safeEncode(billing_country)}`);
    if (billing_tel) dataFields.push(`billing_tel=${safeEncode(billing_tel)}`);
    if (billing_email) dataFields.push(`billing_email=${safeEncode(billing_email)}`);
    
    if (delivery_name) dataFields.push(`delivery_name=${safeEncode(delivery_name)}`);
    if (delivery_address) dataFields.push(`delivery_address=${safeEncode(delivery_address)}`);
    if (delivery_city) dataFields.push(`delivery_city=${safeEncode(delivery_city)}`);
    if (delivery_state) dataFields.push(`delivery_state=${safeEncode(delivery_state)}`);
    if (delivery_zip) dataFields.push(`delivery_zip=${safeEncode(delivery_zip)}`);
    if (delivery_country) dataFields.push(`delivery_country=${safeEncode(delivery_country)}`);
    if (delivery_tel) dataFields.push(`delivery_tel=${safeEncode(delivery_tel)}`);
    
    if (merchant_param1) dataFields.push(`merchant_param1=${safeEncode(merchant_param1)}`);

    const data = dataFields.join('&');
    const encryptedBase64 = encrypt(data, working_key);

    if (!encryptedBase64 || encryptedBase64.length < 64) {
      throw new Error('Encrypted request is invalid or too short');
    }

    return res.status(200).json({
      encRequest: encryptedBase64,
      accessCode: access_code,
      debug: {
        merchantId: merchant_id,
        orderId: order_id,
        encryptedLength: encryptedBase64.length,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('💥 Encryption error:', error);
    return res.status(500).json({
      error: 'Encryption failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
//test