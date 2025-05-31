// api/createOrder.js
import CryptoJS from 'crypto-js';

export default function handler(req, res) {
  // Define allowed origins for CORS
  const allowedOrigins = ['https://gcmtshop.com', 'http://localhost:3000'];
  const origin = req.headers.origin;

  // Set CORS headers
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Handle preflight (OPTIONS) request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Reject non-POST methods
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
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
    } = req.body;

    const working_key = process.env.WORKING_KEY;

    // Check for missing fields
    if (!merchant_id || !order_id || !amount || !currency || !redirect_url || !cancel_url || !language || !working_key) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Prepare data string as per CCAvenue format
    const data = `merchant_id=${merchant_id}&order_id=${order_id}&amount=${amount}&currency=${currency}&redirect_url=${redirect_url}&cancel_url=${cancel_url}&language=${language}`;

    // Encrypt using AES-128-CBC with working_key and fixed IV
    const key = CryptoJS.enc.Utf8.parse(working_key);
    const iv = CryptoJS.enc.Utf8.parse('0123456789abcdef');

    const encrypted = CryptoJS.AES.encrypt(data, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }).ciphertext.toString(CryptoJS.enc.Hex);

    res.status(200).json({ encRequest: encrypted });
  } catch (error) {
    console.error('Encryption error:', error);
    res.status(500).json({ error: 'Encryption failed' });
  }
}
