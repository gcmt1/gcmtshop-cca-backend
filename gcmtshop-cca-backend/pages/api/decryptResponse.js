// /api/decryptResponse.js
import CryptoJS from "crypto-js";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const workingKey = process.env.CCAVENUE_WORKING_KEY; // keep this secure
  const encResp = req.body.encResp;

  const md5 = CryptoJS.MD5(workingKey).toString();
  const key = CryptoJS.enc.Utf8.parse(md5);
  const iv = CryptoJS.enc.Utf8.parse('\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00');

  const decrypted = CryptoJS.AES.decrypt(encResp, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  }).toString(CryptoJS.enc.Utf8);

  // Turn `key=value&key=value` into JSON
  const data = {};
  decrypted.split('&').forEach((pair) => {
    const [k, v] = pair.split('=');
    data[k] = decodeURIComponent(v || '');
  });

  return res.status(200).json(data);
}
