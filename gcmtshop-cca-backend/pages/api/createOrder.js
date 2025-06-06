// File: pages/api/createOrder.js

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
  await cors(req, res);

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

      const working_key = process.env.WORKING_KEY;

      if (
        !merchant_id || !order_id || !amount || !currency ||
        !redirect_url || !cancel_url || !language || !working_key
      ) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const dataFields = [
        `merchant_id=${merchant_id}`,
        `order_id=${order_id}`,
        `amount=${amount}`,
        `currency=${currency}`,
        `redirect_url=${redirect_url}`,   // ✅ No encodeURIComponent
        `cancel_url=${cancel_url}`,
        `language=${language}`,
      ];

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

      const data = dataFields.join('&');

      // ✅ MD5-hash the working_key to get the AES key
      const md5Hash = CryptoJS.MD5(CryptoJS.enc.Utf8.parse(working_key));
      const key = CryptoJS.enc.Hex.parse(md5Hash.toString());

      // ✅ IV = 16 zero bytes (UTF-8)
      const iv = CryptoJS.enc.Utf8.parse('\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00');

      // ✅ AES encryption with proper padding
      const encrypted = CryptoJS.AES.encrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      const encryptedBase64 = encrypted.toString();

      return res.status(200).json({
        encRequest: encryptedBase64,
        debug: {
          originalDataLength: data.length,
          encryptedLength: encryptedBase64.length,
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error) {
      console.error('💥 Encryption error:', error.stack);
      return res.status(500).json({
        error: 'Encryption failed',
        details: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
