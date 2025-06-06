// pages/api/createOrder.js
import Cors from 'cors';
import initMiddleware from '../../lib/init-middleware.js';
import CryptoJS from 'crypto-js';

// Initialize CORS middleware
const cors = initMiddleware(
  Cors({
    methods: ['POST', 'GET', 'OPTIONS'],
    origin: ['https://gcmtshop.com', 'http://localhost:3000'],
    credentials: true,
  })
);

export default async function handler(req, res) {
  // Run CORS
  await cors(req, res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      merchant_id,
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
    } = req.body;

    // 1) Validate required fields
    const missing = [];
    if (!merchant_id)   missing.push('merchant_id');
    if (!order_id)      missing.push('order_id');
    if (!amount)        missing.push('amount');
    if (!currency)      missing.push('currency');
    if (!redirect_url)  missing.push('redirect_url');
    if (!cancel_url)    missing.push('cancel_url');
    if (!language)      missing.push('language');
    if (!process.env.WORKING_KEY) missing.push('WORKING_KEY env');

    if (missing.length) {
      return res
        .status(400)
        .json({ error: 'Missing required fields', missing });
    }

    const working_key = process.env.WORKING_KEY.trim();

    // 2) Ensure working key is exactly 32 characters
    if (working_key.length !== 32) {
      return res.status(500).json({
        error: 'Invalid working key length',
        details: `Expected 32 chars, got ${working_key.length}`,
      });
    }

    // 3) Build data string in EXACT order CCAvenue expects (no extra encoding)
    //    Note: we do NOT do encodeURIComponent here. If CCAvenue wants URL-encoded values for redirect URLs, they will handle on their side.
    const dataFields = [
      `merchant_id=${merchant_id}`,
      `order_id=${order_id}`,
      `amount=${amount}`,
      `currency=${currency}`,
      `redirect_url=${redirect_url}`,
      `cancel_url=${cancel_url}`,
      `language=${language}`,
    ];

    if (billing_name)    dataFields.push(`billing_name=${billing_name}`);
    if (billing_address) dataFields.push(`billing_address=${billing_address}`);
    if (billing_city)    dataFields.push(`billing_city=${billing_city}`);
    if (billing_state)   dataFields.push(`billing_state=${billing_state}`);
    if (billing_zip)     dataFields.push(`billing_zip=${billing_zip}`);
    if (billing_country) dataFields.push(`billing_country=${billing_country}`);
    if (billing_tel)     dataFields.push(`billing_tel=${billing_tel}`);
    if (billing_email)   dataFields.push(`billing_email=${billing_email}`);

    if (delivery_name)    dataFields.push(`delivery_name=${delivery_name}`);
    if (delivery_address) dataFields.push(`delivery_address=${delivery_address}`);
    if (delivery_city)    dataFields.push(`delivery_city=${delivery_city}`);
    if (delivery_state)   dataFields.push(`delivery_state=${delivery_state}`);
    if (delivery_zip)     dataFields.push(`delivery_zip=${delivery_zip}`);
    if (delivery_country) dataFields.push(`delivery_country=${delivery_country}`);
    if (delivery_tel)     dataFields.push(`delivery_tel=${delivery_tel}`);

    const data = dataFields.join('&');

    // 4) MD5-hash the working_key → AES key (hex)
    const md5Hash = CryptoJS.MD5(CryptoJS.enc.Utf8.parse(working_key)); 
    const key      = CryptoJS.enc.Hex.parse(md5Hash.toString());

    // 5) IV = 16 zero bytes in UTF-8
    const iv = CryptoJS.enc.Utf8.parse(String.fromCharCode(0).repeat(16));

    // 6) Encrypt using AES-128-CBC + PKCS7
    const encrypted = CryptoJS.AES.encrypt(data, key, {
      iv:      iv,
      mode:    CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    // 7) Output as Base64 (CCAvenue expects Base64)
    const encryptedBase64 = encrypted.toString();

    // Sanity check
    if (!encryptedBase64 || encryptedBase64.length < 32) {
      throw new Error('Encryption output too short');
    }

    // 8) Return to frontend
    return res.status(200).json({
      encRequest: encryptedBase64,
      debug: {
        originalDataLength: data.length,
        encryptedLength:    encryptedBase64.length,
        timestamp:          new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('💥 Encryption error:', err.stack);
    return res.status(500).json({
      error: 'Encryption failed',
      details: err.message,
      timestamp: new Date().toISOString(),
    });
  }
}
