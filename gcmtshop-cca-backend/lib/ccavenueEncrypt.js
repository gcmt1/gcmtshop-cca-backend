import CryptoJS from 'crypto-js';

export function encrypt(data, workingKey) {
  // Generate key directly as WordArray
  const key = CryptoJS.MD5(workingKey);
  
  // Correct IV per CCAvenue docs: 000102030405060708090a0b0c0d0e0f
  const iv = CryptoJS.enc.Hex.parse('000102030405060708090a0b0c0d0e0f');
  
  const encrypted = CryptoJS.AES.encrypt(data, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  
  return encrypted.ciphertext.toString(CryptoJS.enc.Hex);
}
