export const config = {
  runtime: 'edge', // 🔁 Tells Vercel this is an edge function
};

import CryptoJS from 'crypto-js';

export default async function handler(req) {
  const allowedOrigins = ['https://gcmtshop.com'];

  const origin = req.headers.get('origin');
  const headers = new Headers();

  if (allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();

      const {
        merchant_id,
        order_id,
        amount,
        currency,
        redirect_url,
        cancel_url,
        language,
      } = body;

      const working_key = process.env.WORKING_KEY;
      if (!merchant_id || !order_id || !amount || !currency || !redirect_url || !cancel_url || !language || !working_key) {
        return new Response(JSON.stringify({ error: 'Missing fields' }), {
          status: 400,
          headers,
        });
      }

      const data = `merchant_id=${merchant_id}&order_id=${order_id}&amount=${amount}&currency=${currency}&redirect_url=${redirect_url}&cancel_url=${cancel_url}&language=${language}`;

      const key = CryptoJS.enc.Utf8.parse(working_key);
      const iv = CryptoJS.enc.Utf8.parse('0123456789abcdef');

      const encrypted = CryptoJS.AES.encrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }).ciphertext.toString(CryptoJS.enc.Hex);

      return new Response(JSON.stringify({ encRequest: encrypted }), {
        status: 200,
        headers,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Encryption failed' }), {
        status: 500,
        headers,
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
    status: 405,
    headers,
  });
}
