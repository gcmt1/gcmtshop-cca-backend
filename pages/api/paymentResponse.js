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
    console.log('[PAYMENT] Received callback from CCAvenue');

    // Handle both JSON and form-encoded data
    let encResp = req.body.encResp || req.query.encResp;

    if (!encResp) {
      console.error('[PAYMENT] Missing encResp parameter');
      return res.status(400).send('Missing encResp parameter');
    }

    // Add detailed logging
    console.log(`[PAYMENT] encResp received (${encResp.length} chars):`, 
                encResp.substring(0, 100) + (encResp.length > 100 ? '...' : ''));

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
        console.error('[PAYMENT] Decryption error:', decryptError);
        throw new Error('Failed to decrypt response');
      }
    };

    const decryptedStr = decrypt(encResp);
    console.log('[PAYMENT] Decrypted response:', decryptedStr);

    // Parse the decrypted parameters
    const params = Object.fromEntries(new URLSearchParams(decryptedStr));
    console.log('[PAYMENT] Parsed parameters:', params);

    const { order_id, order_status, merchant_param1, merchant_param2 } = params;

    // FIX 1: Case-insensitive status check
    const isSuccess = order_status?.toLowerCase() === 'success';

    // FIX 2: Add user identification
    const userId = merchant_param2 || 'guest';
    console.log(`[PAYMENT] Updating order for user: ${userId}`);

    // Update order status
    const updateData = {
      payment_status: isSuccess ? 'success' : 'failed',
      order_status: isSuccess ? 'confirmed' : 'cancelled',
    };

    console.log(`[PAYMENT] Updating order ${order_id} with:`, updateData);

    // FIX 3: More robust update query
    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .match({ 
        payment_id: order_id,
        user_id: userId === 'guest' ? null : userId
      })
      .select();

    if (error) {
      console.error('[PAYMENT] Supabase update error:', error);
      return res.status(500).json({ 
        error: 'Database update failed', 
        details: error.message 
      });
    }

    // FIX 4: Handle missing orders
    if (!data || data.length === 0) {
      console.warn('[PAYMENT] No orders updated. Creating fallback record...');
      // Create fallback record for debugging
      await supabase.from('payment_errors').insert({
        payment_id: order_id,
        raw_data: JSON.stringify(params),
        error: 'ORDER_NOT_FOUND'
      });
    }

    // Handle redirects
if (isSuccess) {
  console.log('[PAYMENT] Payment successful, updating database for order:', order_id);
  
  // FIX: Properly handle NULL for guest users
  const updatePayload = {
    payment_status: 'success',
    order_status: 'confirmed',
    updated_at: new Date().toISOString()
  };

  // Build the query conditionally
  let query = supabase
    .from('orders')
    .update(updatePayload)
    .eq('payment_id', order_id);

  // For guest users
  if (userId === 'guest') {
    query = query.is('user_id', null);  // Use .is() for NULL comparison
  } 
  // For logged-in users
  else {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.select();
  
    // Save error to database for debugging
    await supabase.from('payment_errors').insert({
      error_type: 'SERVER_ERROR',
      error_message: err.message,
      raw_data: JSON.stringify(req.body || req.query)
    });

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
