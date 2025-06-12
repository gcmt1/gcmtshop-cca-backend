import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const workingKey = process.env.CCA_WORKING_KEY; // Add this in Vercel env
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { encResp } = req.body;

    const decrypt = (text) => {
      const mKey = crypto.createHash('md5').update(workingKey).digest('hex');
      const iv = Buffer.from(Array(16).fill(0));
      const decipher = crypto.createDecipheriv('aes-128-cbc', mKey.substring(0, 16), iv);
      decipher.setAutoPadding(true);
      let decoded = decipher.update(text, 'base64', 'utf8');
      decoded += decipher.final('utf8');
      return decoded;
    };

    const decrypted = decrypt(encResp);
    const params = Object.fromEntries(new URLSearchParams(decrypted));
    const { order_id, order_status } = params;

    if (order_status === 'Success') {
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: 'success', order_status: 'confirmed' })
        .eq('payment_id', order_id);

      if (error) throw error;
    }

    return res.redirect('https://gcmtshop.com/#/payment-success');
  } catch (error) {
    console.error(error);
    return res.redirect('https://gcmtshop.com/#/payment-cancel');
  }
}
