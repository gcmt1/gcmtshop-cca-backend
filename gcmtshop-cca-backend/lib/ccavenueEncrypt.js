// lib/ccavenueEncrypt.js
import CryptoJS from 'crypto-js';

export function encrypt(data, workingKey) {
  const md5Hash = CryptoJS.MD5(workingKey).toString(); // AES key = MD5 of working key
  const key = CryptoJS.enc.Hex.parse(md5Hash);

  // ✅ CORRECT: 16 zero BYTES
  const iv = CryptoJS.enc.Utf8.parse('\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00');

  const encrypted = CryptoJS.AES.encrypt(data, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  // ✅ return ciphertext in HEX (as required)
  return encrypted.ciphertext.toString(CryptoJS.enc.Hex);
}
