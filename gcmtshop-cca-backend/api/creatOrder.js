// api/createOrder.js

import CryptoJS from 'crypto-js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { merchant_id, order_id, amount, currency, redirect_url, cancel_url, language, working_key } = req.body;

  try {
    // 1️⃣ Build the payload (concatenate as per CCAvenue format)
    const data = `merchant_id=${merchant_id}&order_id=${order_id}&amount=${amount}&currency=${currency}&redirect_url=${redirect_url}&cancel_url=${cancel_url}&language=${language}`;

    // 2️⃣ Encrypt using AES-CBC + PKCS#7 padding
    const key = CryptoJS.enc.Utf8.parse(working_key);
    const iv = CryptoJS.enc.Utf8.parse('0123456789abcdef'); // 16 bytes IV, static for now

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
