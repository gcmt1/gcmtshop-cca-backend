// pages/api/paymentResponse.js
import crypto from 'crypto';
import supabase from '../../lib/supabase';

const WORKING_KEY = process.env.CCA_WORKING_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    console.log('Request method:', req.method);
    console.log('Request body:', req.body);
    console.log('Request query:', req.query);

    // Get the encrypted response
    let encResp;
    if (req.method === 'POST') {
      encResp = req.body.encResp;
    } else if (req.method === 'GET') {
      encResp = req.query.encResp;
    }

    if (!encResp) {
      console.error('Missing encResp in request');
      return res.status(400).json({ error: 'Missing encResp parameter' });
    }

    console.log('Encrypted response received:', encResp.substring(0, 50) + '...');

    // ✅ NEW DECRYPT FUNCTION
const decryptCCAvenueResponse = (cipherText, workingKey) => {
  try {
    // Decode the encrypted response
    const encrypted = Buffer.from(decodeURIComponent(cipherText), 'base64');

    // Check working key length
    let algorithm;
    if (workingKey.length === 16) {
      algorithm = 'aes-128-cbc';
    } else if (workingKey.length === 32) {
      algorithm = 'aes-256-cbc';
    } else {
      throw new Error(`Invalid working key length: ${workingKey.length}`);
    }

    const key = Buffer.from(workingKey, 'utf8');
    const iv = Buffer.from(workingKey.substr(0, 16), 'utf8');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAutoPadding(true);

    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt response');
  }
};
    // ✅ END DECRYPT FUNCTION

    const decryptedStr = decryptCCAvenueResponse(encResp, WORKING_KEY);
    console.log('Decrypted string:', decryptedStr);

    // Parse the decrypted parameters
    const params = {};
    decryptedStr.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      params[k] = v;
    });
    console.log('Parsed parameters:', params);

    const { order_id, order_status } = params;

    if (!order_id) {
      console.error('Missing order_id in decrypted response');
      return res.status(400).json({ error: 'Missing order_id in response' });
    }

    // ✅ Order Status Handling
    if (order_status === 'Success') {
      console.log('Payment successful, updating database for order:', order_id);

      const { data, error } = await supabase
        .from('orders')
        .update({
          payment_status: 'success',
          order_status: 'confirmed'
        })
        .eq('payment_id', order_id)
        .select();

      if (error) {
        console.error('Supabase update error:', error);
        return res.status(500).json({ error: 'Database update failed', details: error });
      }

      if (data && data.length === 0) {
        console.warn('No rows updated. Check if order_id exists in database:', order_id);
        return res.status(404).json({ error: 'Order not found', order_id });
      }

      // JSON for testing
      if (
        req.headers['user-agent']?.includes('Postman') ||
        req.headers['content-type']?.includes('application/json')
      ) {
        return res.status(200).json({
          success: true,
          message: 'Payment processed successfully',
          order_id,
          updated_rows: data?.length || 0
        });
      }

      return res.redirect('https://gcmtshop.com/#/payment-success');
    } else {
      console.log('Payment failed or cancelled for order:', order_id);

      await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          order_status: 'cancelled'
        })
        .eq('payment_id', order_id);

      if (
        req.headers['user-agent']?.includes('Postman') ||
        req.headers['content-type']?.includes('application/json')
      ) {
        return res.status(200).json({
          success: false,
          message: 'Payment failed or cancelled',
          order_id,
          order_status
        });
      }

      return res.redirect('https://gcmtshop.com/#/payment-cancel');
    }
  } catch (err) {
    console.error('paymentResponse handler error:', err);

    if (
      req.headers['user-agent']?.includes('Postman') ||
      req.headers['content-type']?.includes('application/json')
    ) {
      return res.status(500).json({
        error: 'Internal server error',
        message: err.message
      });
    }

    return res.redirect('https://gcmtshop.com/#/payment-cancel');
  }
}

// Important: Configure body parsing for form data
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
