// api/createOrder.js
import CryptoJS from 'crypto-js';

export default function handler(req, res) {
  // 1️⃣ Handle CORS preflight (OPTIONS request)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', 'https://gcmtshop.com'); // Your frontend domain
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // 2️⃣ Set CORS headers for actual request
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', 'https://gcmtshop.com'); // Your frontend domain
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 3️⃣ Handle POST request
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
      working_key,
    } = req.body;

    if (!merchant_id || !order_id || !amount || !currency || !redirect_url || !cancel_url || !language || !working_key) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 4️⃣ Build the data string as per CCAvenue format
    const data = `merchant_id=${merchant_id}&order_id=${order_id}&amount=${amount}&currency=${currency}&redirect_url=${redirect_url}&cancel_url=${cancel_url}&language=${language}`;

    // 5️⃣ Encrypt using AES-CBC + PKCS#7 padding
    const key = CryptoJS.enc.Utf8.parse(working_key);
    const iv = CryptoJS.enc.Utf8.parse('0123456789abcdef'); // 16-byte static IV

    const encrypted = CryptoJS.AES.encrypt(data, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }).ciphertext.toString(CryptoJS.enc.Hex);

    // 6️⃣ Return the encrypted request
    return res.status(200).json({ encRequest: encrypted });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Encryption failed' });
  }
}
