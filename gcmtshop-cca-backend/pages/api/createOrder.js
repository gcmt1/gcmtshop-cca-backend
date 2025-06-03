// api/createOrder.js
import CryptoJS from 'crypto-js';

export default async function handler(req, res) {
  const allowedOrigins = ['https://gcmtshop.com', 'http://localhost:3000']; // Add dev origin if needed
  const origin = req.headers.origin;

  // Set CORS headers for every request
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end(); // Important: Return early for OPTIONS
  }

  if (req.method === 'POST') {
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

      // Validate required fields
      if (!merchant_id || !order_id || !amount || !currency || !redirect_url || !cancel_url || !language || !working_key) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Prepare data string in CCAvenue format
      const data = `merchant_id=${merchant_id}&order_id=${order_id}&amount=${amount}&currency=${currency}&redirect_url=${redirect_url}&cancel_url=${cancel_url}&language=${language}`;

      // Encrypt using AES-128-CBC
      const key = CryptoJS.enc.Utf8.parse(working_key);
      const iv = CryptoJS.enc.Utf8.parse('0123456789abcdef');

      const encrypted = CryptoJS.AES.encrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }).ciphertext.toString(CryptoJS.enc.Hex);

      return res.status(200).json({ encRequest: encrypted });
    } catch (error) {
      console.error('Encryption error:', error);
      return res.status(500).json({ error: 'Encryption failed' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
