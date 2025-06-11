// api/ccadecrypt.js
import crypto from 'crypto';

export function decryptCCAvenueResponse(encResp, workingKey) {
  const key = Buffer.from(workingKey, 'utf8');
  const iv  = Buffer.from(workingKey.slice(0, 16), 'utf8');

  // CCAvenue's response is URL-encoded; decode then Base64
  const encrypted = Buffer.from(decodeURIComponent(encResp), 'base64');

  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  // CCAvenue returns a URL-encoded query string: "order_id=ORD123&status=Success…"
  const params = new URLSearchParams(decrypted);
  const result = {};
  for (const [k,v] of params.entries()) result[k] = v;

  return result;
}
