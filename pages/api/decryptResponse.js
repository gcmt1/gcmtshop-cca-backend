import crypto from 'crypto';

function decryptCCAvenueResponse(encResp, workingKey) {
  const key = Buffer.from(workingKey, 'utf8');
  const iv = Buffer.from(workingKey.substr(0, 16), 'utf8'); // FIRST 16 CHARS AS IV

  const encrypted = Buffer.from(encResp, 'hex');
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(true);

  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
