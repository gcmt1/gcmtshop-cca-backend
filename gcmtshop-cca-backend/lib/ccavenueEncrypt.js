// File: lib/ccavenueEncrypt.js
import CryptoJS from 'crypto-js';

export function encrypt(data, workingKey) {
  const md5Hash = CryptoJS.MD5(workingKey).toString(); // MD5 of key
  const key = CryptoJS.enc.Hex.parse(md5Hash);
  const iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000'); // IV = 16 zeros

  const encrypted = CryptoJS.AES.encrypt(data, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  // ✅ Return as Base64 string — NOT hex
  return encrypted.toString(); // ← this gives the correct format
}
