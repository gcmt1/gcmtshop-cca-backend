import crypto from 'crypto';
import supabase from '../../lib/supabase';

const WORKING_KEY = process.env.CCA_WORKING_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Get encResp from request
    let encResp = req.method === 'POST' ? req.body.encResp : req.query.encResp;

    if (!encResp) {
      console.error('Missing encResp parameter');
      return res.status(400).json({ error: 'Missing encResp parameter' });
    }

    // Decrypt function
    const decrypt = (cipherText) => {
      try {
        const key = crypto.createHash('md5').update(WORKING_KEY).digest();
        const iv = Buffer.alloc(16, 0);
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        let decrypted = decipher.update(cipherText, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } catch (decryptError) {
        console.error('Decryption error:', decryptError);
        throw new Error('Failed to decrypt response');
      }
    };

    const decryptedStr = decrypt(encResp);
    const params = Object.fromEntries(new URLSearchParams(decryptedStr));
    
    console.log('Received CCAvenue Parameters:', params);
    
    const { order_id, order_status, merchant_param1 } = params;
    const normalizedStatus = order_status?.toLowerCase()?.trim();

    if (!order_id) {
      console.error('Missing order_id in response');
      return res.status(400).json({ error: 'Missing order_id in response' });
    }

    // Handle successful payment
    if (normalizedStatus === 'success') {
      console.log('Payment successful for order:', order_id);
      
      const { data, error } = await supabase
        .from('orders')
        .update({
          payment_status: 'success',
          order_status: 'confirmed'
        })
        .eq('payment_id', order_id);

      if (error) {
        console.error('Supabase update error:', error);
        return res.status(500).json({ 
          error: 'Database update failed', 
          details: error.message 
        });
      }

      console.log('Database updated successfully for order:', order_id);
      
      // Get order_id from merchant_param1 for redirect
      const orderId = merchant_param1 || order_id;
      
      // Handle API clients like Postman
      if (req.headers['user-agent']?.includes('Postman') || 
          req.headers['content-type']?.includes('application/json')) {
        return res.status(200).json({ 
          success: true, 
          message: 'Payment processed successfully',
          order_id: orderId
        });
      }

      // Redirect to FRONTEND success page
      return res.redirect(`https://gcmtshop.com/payment-success?order_id=${orderId}`);
    } 
    // Handle failed/canceled payment
    else {
      console.log('Payment failed for order:', order_id);
      
      await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          order_status: 'cancelled'
        })
        .eq('payment_id', order_id);

      // API client response
      if (req.headers['user-agent']?.includes('Postman') || 
          req.headers['content-type']?.includes('application/json')) {
        return res.status(200).json({ 
          success: false, 
          message: 'Payment failed or cancelled',
          order_id
        });
      }

      // Redirect to FRONTEND cancel page
      return res.redirect(`https://gcmtshop.com/payment-cancel?order_id=${order_id}`);
    }
  } catch (err) {
    console.error('Payment processing error:', err);
    
    // API client response
    if (req.headers['user-agent']?.includes('Postman') || 
        req.headers['content-type']?.includes('application/json')) {
      return res.status(500).json({ 
        error: 'Internal server error', 
        message: err.message 
      });
    }

    // Redirect to cancel page on error
    return res.redirect('https://gcmtshop.com/payment-cancel');
  }
}
