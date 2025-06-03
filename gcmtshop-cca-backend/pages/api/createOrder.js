import Cors from 'cors';
import initMiddleware from '../../lib/init-middleware.js';
import CryptoJS from 'crypto-js';

// Initialize CORS middleware (not used alone anymore, just for fallback)
const cors = initMiddleware(
  Cors({
    methods: ['POST', 'GET', 'OPTIONS'],
    origin: ['https://gcmtshop.com', 'http://localhost:3000'],
    credentials: true,
  })
);

export default async function handler(req, res) {
  // Always set CORS headers explicitly
  res.setHeader('Access-Control-Allow-Origin', 'https://gcmtshop.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle POST requests
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

      if (
        !merchant_id ||
        !order_id ||
        !amount ||
        !currency ||
        !redirect_url ||
        !cancel_url ||
        !language ||
        !working_key
      ) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const data = `merchant_id=${merchant_id}&order_id=${order_id}&amount=${amount}&currency=${currency}&redirect_url=${redirect_url}&cancel_url=${cancel_url}&language=${language}`;

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
  }

  // Any other methods
  return res.status(405).json({ error: 'Method not allowed' });
}
