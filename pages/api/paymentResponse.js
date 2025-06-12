// pages/api/paymentResponse.js
import crypto from 'crypto';
import supabase from '../../lib/supabase';

const WORKING_KEY = process.env.CCA_WORKING_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { encResp } = req.body;
    if (!encResp) {
      throw new Error('Missing encResp in request body');
    }

    // ✅ Decrypt function (corrected)
    const decrypt = (cipherText) => {
      const key = crypto.createHash('md5').update(WORKING_KEY).digest(); // Correct format
      const iv = Buffer.alloc(16, 0); // 16 zero bytes

      const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
      decipher.setAutoPadding(true);

      let decrypted = decipher.update(cipherText, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    };

    const decryptedStr = decrypt(encResp);
    const params = Object.fromEntries(new URLSearchParams(decryptedStr));
    const { order_id, order_status } = params;

    // ✅ Update order if successful
    if (order_status === 'Success') {
      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: 'success',
          order_status: 'confirmed',
        })
        .eq('payment_id', order_id); // <-- make sure `payment_id` is used for CCAvenue’s order_id

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      return res.redirect('https://gcmtshop.com/#/payment-success');
    } else {
      return res.redirect('https://gcmtshop.com/#/payment-cancel');
    }
  } catch (err) {
    console.error('paymentResponse handler error:', err);
    return res.redirect('https://gcmtshop.com/#/payment-cancel');
  }
}
