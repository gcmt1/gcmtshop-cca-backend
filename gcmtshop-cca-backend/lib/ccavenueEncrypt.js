// File: lib/ccavenueEncrypt.js
import CryptoJS from 'crypto-js';

export function encrypt(data, workingKey) {
  // Create MD5 hash of the working key
  const md5Hash = CryptoJS.MD5(workingKey).toString();
  const key = CryptoJS.enc.Hex.parse(md5Hash);
  const iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');

  const encrypted = CryptoJS.AES.encrypt(data, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  return encrypted.ciphertext.toString(CryptoJS.enc.Hex); // HEX format
}
