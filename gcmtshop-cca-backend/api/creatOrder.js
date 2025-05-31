// api/createOrder.js
import CryptoJS from 'crypto-js';

export default function handler(req, res) {
  // Dynamic CORS: allow your frontend domain + localhost for testing
  const allowedOrigins = ['https://gcmtshop.com', 'http://localhost:3000'];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end(); // Preflight request response
  }

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
    } = req.body;

    // Fetch the working key securely from environment variables
    const working_key = process.env.WORKING_KEY;

    if (!merchant_id || !order_id || !amount || !currency || !redirect_url || !cancel_url || !language || !working_key) {
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
    console.error(error);
    return res.status(500).json({ error: 'Encryption failed' });
  }
}
