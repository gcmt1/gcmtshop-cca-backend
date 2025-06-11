// /api/decryptResponse.js

import CryptoJS from 'crypto-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { encResp } = req.body;
    const workingKey = process.env.CCAVENUE_WORKING_KEY; // Keep this in Vercel env variables

    // Generate key and IV as per CCAvenue's instructions
    const key = CryptoJS.MD5(workingKey);
    const iv = CryptoJS.enc.Hex.parse('000102030405060708090a0b0c0d0e0f');

    const decrypted = CryptoJS.AES.decrypt(
      {
        ciphertext: CryptoJS.enc.Hex.parse(encResp)
      },
      key,
      {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    ).toString(CryptoJS.enc.Utf8);

    // Parse key=value&key=value string to JSON
    const result = {};
    decrypted.split('&').forEach((pair) => {
      const [k, v] = pair.split('=');
      result[k] = decodeURIComponent(v || '');
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error("Decryption error:", err);
    return res.status(500).json({ error: "Failed to decrypt CCAvenue response." });
  }
}
