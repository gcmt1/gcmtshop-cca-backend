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

    // ✅ DECRYPT FUNCTION
    const decryptCCAvenueResponse = (encResp, workingKey) => {
      try {
        // 1️⃣ Get MD5 hash of the working key
        const key = crypto.createHash('md5').update(workingKey).digest();

        // 2️⃣ Fixed IV for CCAvenue
        const iv = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');

        // 3️⃣ Convert encResp (hex) ➔ Buffer
        const encrypted = Buffer.from(encResp, 'hex');

        // 4️⃣ Decrypt
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        decipher.setAutoPadding(true);

        let decrypted = decipher.update(encrypted, undefined, 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
      } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt response');
      }
    };

    const decryptedStr = decryptCCAvenueResponse(encResp, WORKING_KEY);
    console.log('Decrypted string:', decryptedStr);

    // ✅ Parse as URLSearchParams
    const params = {};
    decryptedStr.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      params[k] = v;
    });

    console.log('Parsed parameters:', params);

    const { 
      order_id, 
      order_status, 
      tracking_id,
      bank_ref_no,
      failure_message,
      payment_mode,
      card_name,
      status_code,
      status_message 
    } = params;

    if (!order_id) {
      console.error('Missing order_id in decrypted response');
      return res.status(400).json({ error: 'Missing order_id in response' });
    }

    // 🔥 FIXED: Enhanced Order Status Handling
    if (order_status === 'Success') {
      console.log('✅ Payment successful, updating database for order:', order_id);

      // Update order with successful payment details
      const updateData = {
        payment_status: 'SUCCESS', // 🔥 FIXED: Change from 'success' to 'SUCCESS'
        order_status: 'CONFIRMED',
        tracking_id: tracking_id || null,
        bank_ref_no: bank_ref_no || null,
        payment_mode: payment_mode || null,
        card_name: card_name || null,
        status_code: status_code || null,
        status_message: status_message || null,
        payment_completed_at: new Date().toISOString()
      };

      console.log('📝 Updating order with data:', updateData);

      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('payment_id', order_id)
        .select();

      if (error) {
        console.error('❌ Supabase update error:', error);
        return res.status(500).json({ 
          error: 'Database update failed', 
          details: error.message,
          order_id 
        });
      }

      if (data && data.length === 0) {
        console.warn('⚠️ No rows updated. Check if order_id exists in database:', order_id);
        return res.status(404).json({ 
          error: 'Order not found in database', 
          order_id 
        });
      }

      console.log('✅ Order updated successfully:', data[0]);

      // JSON response for testing/API calls
      if (
        req.headers['user-agent']?.includes('Postman') ||
        req.headers['content-type']?.includes('application/json') ||
        req.query.format === 'json'
      ) {
        return res.status(200).json({
          success: true,
          message: 'Payment processed successfully',
          order_id,
          tracking_id,
          bank_ref_no,
          payment_mode,
          updated_rows: data?.length || 0,
          order_data: data[0]
        });
      }

      // Redirect to success page
      return res.redirect('https://gcmtshop.com/#/payment-success');

    } else {
      // 🔥 FIXED: Enhanced failure handling
      console.log('❌ Payment failed or cancelled for order:', order_id);
      console.log('Failure details:', { 
        order_status, 
        failure_message, 
        status_code, 
        status_message 
      });

      // Update order with failure details
      const updateData = {
        payment_status: 'FAILED', // 🔥 FIXED: Change from 'failed' to 'FAILED'
        order_status: 'CANCELLED',
        failure_message: failure_message || status_message || 'Payment failed',
        status_code: status_code || null,
        status_message: status_message || null,
        payment_failed_at: new Date().toISOString()
      };

      console.log('📝 Updating failed order with data:', updateData);

      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('payment_id', order_id)
        .select();

      if (error) {
        console.error('❌ Error updating failed order:', error);
      } else {
        console.log('✅ Failed order updated:', data[0]);
      }

      // JSON response for testing/API calls
      if (
        req.headers['user-agent']?.includes('Postman') ||
        req.headers['content-type']?.includes('application/json') ||
        req.query.format === 'json'
      ) {
        return res.status(200).json({
          success: false,
          message: 'Payment failed or cancelled',
          order_id,
          order_status,
          failure_message: failure_message || status_message || 'Payment failed',
          status_code,
          status_message,
          updated_rows: data?.length || 0
        });
      }

      // Redirect to cancel/failure page
      return res.redirect('https://gcmtshop.com/#/payment-cancel');
    }

  } catch (err) {
    console.error('💥 paymentResponse handler error:', err);

    // Try to log the error to database if we have order_id
    if (req.body?.order_id || req.query?.order_id) {
      const order_id = req.body.order_id || req.query.order_id;
      try {
        await supabase
          .from('orders')
          .update({
            payment_status: 'ERROR',
            order_status: 'CANCELLED',
            failure_message: `Processing error: ${err.message}`,
            payment_failed_at: new Date().toISOString()
          })
          .eq('payment_id', order_id);
      } catch (logError) {
        console.error('Failed to log error to database:', logError);
      }
    }

    // JSON response for testing/API calls
    if (
      req.headers['user-agent']?.includes('Postman') ||
      req.headers['content-type']?.includes('application/json') ||
      req.query.format === 'json'
    ) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }

    // Redirect to error page
    return res.redirect('https://gcmtshop.com/#/payment-cancel?error=processing');
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
