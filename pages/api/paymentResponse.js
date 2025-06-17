import crypto from 'crypto';
import supabase from '../../lib/supabase';

const WORKING_KEY = process.env.CCA_WORKING_KEY;

export default async function handler(req, res) {
  const traceId = crypto.randomBytes(4).toString('hex'); // unique request identifier for logs
  console.log(`[${traceId}] Incoming ${req.method} request to /api/paymentResponse`);

  if (req.method !== 'POST' && req.method !== 'GET') {
    console.warn(`[${traceId}] Method Not Allowed:`, req.method);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    console.log(`[${traceId}] Headers:`, req.headers);
    console.log(`[${traceId}] Query Params:`, req.query);
    console.log(`[${traceId}] Raw Body:`, req.body);

    let encResp;
    if (req.method === 'POST') {
      encResp = req.body.encResp;
      console.log(`[${traceId}] Received encResp from POST body`);
    } else if (req.method === 'GET') {
      encResp = req.query.encResp;
      console.log(`[${traceId}] Received encResp from GET query`);
    }

    if (!encResp) {
      console.error(`[${traceId}] ❌ Missing encResp`);
      return res.status(400).json({ error: 'Missing encResp parameter' });
    }

    console.log(`[${traceId}] Encrypted Response (first 100 chars): ${encResp.slice(0, 100)}...`);

    // Decryption helper
    const decrypt = (cipherText) => {
      try {
        const key = crypto.createHash('md5').update(WORKING_KEY).digest();
        const iv = Buffer.alloc(16, 0);
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        decipher.setAutoPadding(true);
        let decrypted = decipher.update(cipherText, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } catch (decryptError) {
        console.error(`[${traceId}] 🔐 Decryption failed:`, decryptError);
        throw new Error('Failed to decrypt response');
      }
    };

    const decryptedStr = decrypt(encResp);
    console.log(`[${traceId}] ✅ Decrypted Response String:`, decryptedStr);

    const params = Object.fromEntries(new URLSearchParams(decryptedStr));
    console.log(`[${traceId}] 🔍 Parsed Parameters:`, params);

    const { order_id, order_status } = params;

    if (!order_id) {
      console.error(`[${traceId}] ❌ Missing order_id in decrypted response`);
      return res.status(400).json({ error: 'Missing order_id in response' });
    }

    if (order_status === 'success') {
      console.log(`[${traceId}] 💰 Payment Successful. Updating DB for order_id: ${order_id}`);

      const { data, error } = await supabase
        .from('orders')
        .update({
          payment_status: 'success',
          order_status: 'confirmed'
        })
        .eq('payment_id', order_id)
        .select();

      if (error) {
        console.error(`[${traceId}] ❌ Supabase update error:`, error);
        return res.status(500).json({ error: 'Database update failed', details: error });
      }

      console.log(`[${traceId}] ✅ Supabase update success. Rows updated: ${data?.length}`);
      if (!data?.length) {
        console.warn(`[${traceId}] ⚠️ No matching order found for order_id: ${order_id}`);
        return res.status(404).json({ error: 'Order not found', order_id });
      }

      // JSON response for debugging tools
      if (req.headers['user-agent']?.includes('Postman') || req.headers['content-type']?.includes('application/json')) {
        return res.status(200).json({ 
          success: true, 
          message: 'Payment processed successfully',
          order_id,
          updated_rows: data?.length || 0,
          traceId
        });
      }

      return res.redirect('https://gcmtshop.com/#/payment-success');
    } else {
      console.warn(`[${traceId}] ❌ Payment failed/cancelled for order_id: ${order_id}, status: ${order_status}`);

      await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          order_status: 'cancelled'
        })
        .eq('payment_id', order_id);

      if (req.headers['user-agent']?.includes('Postman') || req.headers['content-type']?.includes('application/json')) {
        return res.status(200).json({ 
          success: false, 
          message: 'Payment failed or cancelled',
          order_id,
          order_status,
          traceId
        });
      }

      return res.redirect('https://gcmtshop.com/#/payment-cancel');
    }
  } catch (err) {
    console.error(`[${traceId}] ❌ Unhandled error:`, err);

    if (req.headers['user-agent']?.includes('Postman') || req.headers['content-type']?.includes('application/json')) {
      return res.status(500).json({ 
        error: 'Internal server error', 
        message: err.message,
        traceId
      });
    }

    return res.redirect('https://gcmtshop.com/#/payment-cancel');
  }
}

// Allow large POST body (up to 1MB) for encrypted payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
