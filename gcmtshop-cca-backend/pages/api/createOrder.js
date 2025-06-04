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

      const working_key = '5CB292A1C96CD4A0A02166FCF209D84D';

      if (
        !merchant_id || !order_id || !amount || !currency ||
        !redirect_url || !cancel_url || !language || !working_key
      ) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (working_key.length !== 32) {
        return res.status(500).json({ error: 'Invalid working key length' });
      }

      const dataFields = [
        `merchant_id=${merchant_id}`,
        `order_id=${order_id}`,
        `amount=${amount}`,
        `currency=${currency}`,
        `redirect_url=${encodeURIComponent(redirect_url)}`,
        `cancel_url=${encodeURIComponent(cancel_url)}`,
        `language=${language}`,
      ];

      if (billing_name) dataFields.push(`billing_name=${encodeURIComponent(billing_name)}`);
      if (billing_address) dataFields.push(`billing_address=${encodeURIComponent(billing_address)}`);
      if (billing_city) dataFields.push(`billing_city=${encodeURIComponent(billing_city)}`);
      if (billing_state) dataFields.push(`billing_state=${encodeURIComponent(billing_state)}`);
      if (billing_zip) dataFields.push(`billing_zip=${billing_zip}`);
      if (billing_country) dataFields.push(`billing_country=${encodeURIComponent(billing_country)}`);
      if (billing_tel) dataFields.push(`billing_tel=${billing_tel}`);
      if (billing_email) dataFields.push(`billing_email=${encodeURIComponent(billing_email)}`);

      if (delivery_name) dataFields.push(`delivery_name=${encodeURIComponent(delivery_name)}`);
      if (delivery_address) dataFields.push(`delivery_address=${encodeURIComponent(delivery_address)}`);
      if (delivery_city) dataFields.push(`delivery_city=${encodeURIComponent(delivery_city)}`);
      if (delivery_state) dataFields.push(`delivery_state=${encodeURIComponent(delivery_state)}`);
      if (delivery_zip) dataFields.push(`delivery_zip=${delivery_zip}`);
      if (delivery_country) dataFields.push(`delivery_country=${encodeURIComponent(delivery_country)}`);
      if (delivery_tel) dataFields.push(`delivery_tel=${delivery_tel}`);

      const data = dataFields.join('&');

      const key = CryptoJS.enc.Utf8.parse(working_key);
      const iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000'); // 16-byte IV of zeroes

      const encrypted = CryptoJS.AES.encrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      const encryptedBase64 = encrypted.toString(); // CCAvenue expects Base64

      if (!encryptedBase64 || encryptedBase64.length < 32) {
        throw new Error('Invalid encrypted output');
      }

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
