// pages/api/paymentResponse.js
import crypto from 'crypto';
import supabase from '../../lib/supabase';

const WORKING_KEY = process.env.CCA_WORKING_KEY; // Your CCAvenue working key

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { encResp } = req.body;
    if (!encResp) {
      throw new Error('Missing encResp in request body');
    }

    // Decrypt function
    const decrypt = (cipherText) => {
      // MD5 of working key, take first 16 bytes
      const md5Hash = crypto.createHash('md5').update(WORKING_KEY).digest('hex').substring(0, 16);
      const iv = Buffer.alloc(16, 0); // 16 zero bytes

      const decipher = crypto.createDecipheriv('aes-128-cbc', md5Hash, iv);
      decipher.setAutoPadding(true);

      let decrypted = decipher.update(cipherText, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    };

    // Decrypt and parse into an object
    const decryptedStr = decrypt(encResp);
    const params = Object.fromEntries(new URLSearchParams(decryptedStr));
    const { order_id, order_status } = params;

    // If payment is successful, update Supabase
    if (order_status === 'Success') {
      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: 'success',
          order_status: 'confirmed',
        })
        .eq('payment_id', order_id);

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }
      // Redirect to frontend success page
      return res.redirect('https://gcmtshop.com/#/payment-success');
    } else {
      // If not success, redirect to cancel/failure
      return res.redirect('https://gcmtshop.com/#/payment-cancel');
    }
  } catch (err) {
    console.error('paymentResponse handler error:', err);
    // On any error, send user to cancel page
    return res.redirect('https://gcmtshop.com/#/payment-cancel');
  }
}