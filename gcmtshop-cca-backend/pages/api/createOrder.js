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
  // Run CORS middleware first
  await cors(req, res);

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

      // Verify working key length
      if (working_key.length !== 32) {
        console.error('Working key must be 32 characters, got:', working_key.length);
        return res.status(500).json({ error: 'Invalid working key length' });
      }

      // Prepare data string in CCAvenue format with proper URL encoding
      const data = `merchant_id=${merchant_id}&order_id=${order_id}&amount=${amount}&currency=${currency}&redirect_url=${encodeURIComponent(redirect_url)}&cancel_url=${encodeURIComponent(cancel_url)}&language=${language}`;

      console.log('Data to encrypt:', data); // Debug log

      // Encrypt using AES-128-CBC with CCAvenue's expected IV
      const key = CryptoJS.enc.Utf8.parse(working_key);
      const iv = CryptoJS.enc.Utf8.parse('\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f');

      const encrypted = CryptoJS.AES.encrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }).ciphertext.toString(CryptoJS.enc.Hex);

      console.log('Encrypted request length:', encrypted.length); // Debug log

      if (!encrypted || encrypted.length === 0) {
        throw new Error('Encryption resulted in empty string');
      }

      return res.status(200).json({ encRequest: encrypted });
    } catch (error) {
      console.error('Encryption error:', error);
      return res.status(500).json({ 
        error: 'Encryption failed', 
        details: error.message 
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
