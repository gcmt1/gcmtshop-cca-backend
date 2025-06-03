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
        console.error('Missing required fields:', {
          merchant_id: !!merchant_id,
          order_id: !!order_id,
          amount: !!amount,
          currency: !!currency,
          redirect_url: !!redirect_url,
          cancel_url: !!cancel_url,
          language: !!language,
          working_key: !!working_key
        });
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Verify working key length (32 characters for AES-128)
      if (working_key.length !== 32) {
        console.error('Working key must be 32 characters, got:', working_key.length);
        return res.status(500).json({ error: 'Invalid working key length' });
      }

      // Build comprehensive data string for CCAvenue
      // Include all fields that CCAvenue expects
      const dataFields = [
        `merchant_id=${merchant_id}`,
        `order_id=${order_id}`,
        `amount=${amount}`,
        `currency=${currency}`,
        `redirect_url=${encodeURIComponent(redirect_url)}`,
        `cancel_url=${encodeURIComponent(cancel_url)}`,
        `language=${language}`
      ];

      // Add billing information if provided
      if (billing_name) dataFields.push(`billing_name=${encodeURIComponent(billing_name)}`);
      if (billing_address) dataFields.push(`billing_address=${encodeURIComponent(billing_address)}`);
      if (billing_city) dataFields.push(`billing_city=${encodeURIComponent(billing_city)}`);
      if (billing_state) dataFields.push(`billing_state=${encodeURIComponent(billing_state)}`);
      if (billing_zip) dataFields.push(`billing_zip=${billing_zip}`);
      if (billing_country) dataFields.push(`billing_country=${encodeURIComponent(billing_country)}`);
      if (billing_tel) dataFields.push(`billing_tel=${billing_tel}`);
      if (billing_email) dataFields.push(`billing_email=${encodeURIComponent(billing_email)}`);

      // Add delivery information if provided
      if (delivery_name) dataFields.push(`delivery_name=${encodeURIComponent(delivery_name)}`);
      if (delivery_address) dataFields.push(`delivery_address=${encodeURIComponent(delivery_address)}`);
      if (delivery_city) dataFields.push(`delivery_city=${encodeURIComponent(delivery_city)}`);
      if (delivery_state) dataFields.push(`delivery_state=${encodeURIComponent(delivery_state)}`);
      if (delivery_zip) dataFields.push(`delivery_zip=${delivery_zip}`);
      if (delivery_country) dataFields.push(`delivery_country=${encodeURIComponent(delivery_country)}`);
      if (delivery_tel) dataFields.push(`delivery_tel=${delivery_tel}`);

      const data = dataFields.join('&');
      
      console.log('📋 Data to encrypt:');
      console.log('  Length:', data.length);
      console.log('  Content preview:', data.substring(0, 200) + '...');

      // Encrypt using AES-128-CBC with proper CCAvenue configuration
      const key = CryptoJS.enc.Utf8.parse(working_key);
      
      // CCAvenue uses a specific IV pattern
      const iv = CryptoJS.enc.Utf8.parse('\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f');
      
      // Perform encryption
      const encrypted = CryptoJS.AES.encrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      // Convert to hex string (CCAvenue expects hex format)
      const encryptedHex = encrypted.ciphertext.toString(CryptoJS.enc.Hex);

      console.log('🔐 Encryption results:');
      console.log('  Raw encrypted length:', encrypted.ciphertext.sigBytes);
      console.log('  Hex string length:', encryptedHex.length);
      console.log('  Hex preview:', encryptedHex.substring(0, 50) + '...');

      // Validate encryption result
      if (!encryptedHex || encryptedHex.length === 0) {
        throw new Error('Encryption resulted in empty string');
      }

      // Additional validation - CCAvenue encrypted strings are typically quite long
      if (encryptedHex.length < 32) {
        throw new Error('Encrypted string appears too short');
      }

      return res.status(200).json({ 
        encRequest: encryptedHex,
        debug: {
          originalDataLength: data.length,
          encryptedLength: encryptedHex.length,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('💥 Encryption error:', error);
      console.error('Error stack:', error.stack);
      
      return res.status(500).json({ 
        error: 'Encryption failed', 
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
