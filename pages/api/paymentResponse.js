// pages/api/paymentResponse.js
import crypto from 'crypto';
import supabase from '../../lib/supabase';

const WORKING_KEY = process.env.CCA_WORKING_KEY;

export default async function handler(req, res) {
  // Allow both POST and GET methods (CCAvenue might use either)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    console.log('Request method:', req.method);
    console.log('Request body:', req.body);
    console.log('Request query:', req.query);

    // Handle both JSON and form-encoded data
    let encResp;
    
    if (req.method === 'POST') {
      // For form-encoded data (typical CCAvenue response)
      encResp = req.body.encResp;
    } else if (req.method === 'GET') {
      // Some CCAvenue integrations use GET with query parameters
      encResp = req.query.encResp;
    }

    if (!encResp) {
      console.error('Missing encResp in request');
      return res.status(400).json({ error: 'Missing encResp parameter' });
    }

    console.log('Encrypted response received:', encResp.substring(0, 50) + '...');

    // Decrypt function
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
        console.error('Decryption error:', decryptError);
        throw new Error('Failed to decrypt response');
      }
    };

    const decryptedStr = decrypt(encResp);
    console.log('Decrypted string:', decryptedStr);

    // Parse the decrypted parameters
    const params = Object.fromEntries(new URLSearchParams(decryptedStr));
    console.log('Parsed parameters:', params);

    const { order_id, order_status } = params;

    if (!order_id) {
      console.error('Missing order_id in decrypted response');
      return res.status(400).json({ error: 'Missing order_id in response' });
    }

    // Update order if successful
    if (order_status === 'Success') {
      console.log('Payment successful, updating database for order:', order_id);
      
      const { data, error } = await supabase
        .from('orders')
        .update({
          payment_status: 'success',
          order_status: 'confirmed'
        })
        .eq('payment_id', order_id)
        .select(); // Add select to see what was updated

      if (error) {
        console.error('Supabase update error:', error);
        return res.status(500).json({ error: 'Database update failed', details: error });
      }

      console.log('Database update result:', data);

      if (data && data.length === 0) {
        console.warn('No rows were updated. Check if order_id exists in database:', order_id);
        return res.status(404).json({ error: 'Order not found', order_id });
      }

      // For testing purposes, return JSON response
      if (req.headers['user-agent']?.includes('Postman') || req.headers['content-type']?.includes('application/json')) {
        return res.status(200).json({ 
          success: true, 
          message: 'Payment processed successfully',
          order_id,
          updated_rows: data?.length || 0
        });
      }

      // For actual CCAvenue redirect
      return res.redirect('https://gcmtshop.com/#/payment-success');
    } else {
      console.log('Payment failed or cancelled:', order_status);
      
      // Update order status to failed
      await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          order_status: 'cancelled'
        })
        .eq('payment_id', order_id);

      // For testing purposes, return JSON response
      if (req.headers['user-agent']?.includes('Postman') || req.headers['content-type']?.includes('application/json')) {
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
    
    // For testing purposes, return JSON error
    if (req.headers['user-agent']?.includes('Postman') || req.headers['content-type']?.includes('application/json')) {
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
}
