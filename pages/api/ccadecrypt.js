import crypto from 'crypto';

export function decryptCCAvenueResponse(encResp, workingKey) {
  const key = crypto.createHash('md5').update(workingKey).digest();
  const iv = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
  const encrypted = Buffer.from(encResp, 'hex'); // ✅ KEY LINE: It's hex!

  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(true);

  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
