// lib/ccavenueEncrypt.js
import CryptoJS from 'crypto-js';

export function encrypt(data, workingKey) {
  // AES key = MD5 of working key
  const md5Hash = CryptoJS.MD5(workingKey).toString();
  const key = CryptoJS.enc.Hex.parse(md5Hash);

  // IV: 16 zero bytes parsed as hex
  const iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');

  const encrypted = CryptoJS.AES.encrypt(data, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  // Return Base64-encoded string
  return encrypted.toString();
}
