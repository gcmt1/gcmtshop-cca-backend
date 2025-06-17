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
    console.log('=== PAYMENT RESPONSE HANDLER ===');
    console.log('Request method:', req.method);
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('Request body keys:', Object.keys(req.body || {}));
    console.log('Request query keys:', Object.keys(req.query || {}));
    console.log('Raw body:', req.body);
    console.log('Raw query:', req.query);

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
      console.error('❌ Missing encResp in request');
      console.log('Available POST body keys:', Object.keys(req.body || {}));
      console.log('Available GET query keys:', Object.keys(req.query || {}));
      
      // Log the entire request for debugging
      console.log('Full request body:', JSON.stringify(req.body, null, 2));
      console.log('Full request query:', JSON.stringify(req.query, null, 2));
      
      return res.status(400).json({ 
        error: 'Missing encResp parameter',
        bodyKeys: Object.keys(req.body || {}),
        queryKeys: Object.keys(req.query || {}),
        method: req.method
      });
    }

    console.log('✅ Encrypted response received (length:', encResp.length, ')');
    console.log('First 100 chars:', encResp.substring(0, 100));

    // Decrypt function with better error handling
    const decrypt = (cipherText) => {
      try {
        if (!WORKING_KEY) {
          throw new Error('WORKING_KEY environment variable not set');
        }

        const key = crypto.createHash('md5').update(WORKING_KEY).digest();
        const iv = Buffer.alloc(16, 0);

        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        decipher.setAutoPadding(true);

        let decrypted = decipher.update(cipherText, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } catch (decryptError) {
        console.error('❌ Decryption error details:', {
          error: decryptError.message,
          cipherTextLength: cipherText?.length,
          workingKeyExists: !!WORKING_KEY
        });
        throw new Error(`Failed to decrypt response: ${decryptError.message}`);
      }
    };

    const decryptedStr = decrypt(encResp);
    console.log('✅ Decrypted string:', decryptedStr);

    // Parse the decrypted parameters
    const params = Object.fromEntries(new URLSearchParams(decryptedStr));
    console.log('✅ Parsed parameters:', JSON.stringify(params, null, 2));

    const { 
      order_id, 
      order_status,
      merchant_param1,
      merchant_param2,
      tracking_id,
      bank_ref_no,
      payment_mode,
      card_name,
      status_code,
      status_message,
      trans_date
    } = params;

    if (!order_id) {
      console.error('❌ Missing order_id in decrypted response');
      console.log('Available parameter keys:', Object.keys(params));
      return res.status(400).json({ 
        error: 'Missing order_id in response',
        availableParams: Object.keys(params),
        allParams: params
      });
    }

    console.log('🔍 Key payment details:');
    console.log('- Order ID:', order_id);
    console.log('- Order Status:', order_status);
    console.log('- Status Code:', status_code);
    console.log('- Status Message:', status_message);
    console.log('- Merchant Param1 (DB Order ID):', merchant_param1);
    console.log('- Tracking ID:', tracking_id);
    console.log('- Payment Mode:', payment_mode);

    // ✅ FIXED: Check for successful payment with proper case handling
    const isSuccessful = order_status === 'Success' ||  // CCAvenue typically sends "Success" with capital S
                        order_status === 'success' ||   // Backup check
                        order_status === 'Successful' ||
                        status_code === '200';

    console.log('💳 Payment successful?', isSuccessful);
    console.log('💳 Exact order_status value:', `"${order_status}"`);

    if (isSuccessful) {
      console.log('✅ Processing successful payment...');
      
      // First, try to find the order using payment_id
      let updateResult = null;
      let orderFound = false;

      try {
        console.log('🔍 Searching for order with payment_id:', order_id);
        
        const { data: existingOrder, error: fetchError } = await supabase
          .from('orders')
          .select('id, payment_id, payment_status, order_status, user_name')
          .eq('payment_id', order_id)
          .single();

        if (fetchError) {
          console.log('⚠️ Order not found with payment_id, trying merchant_param1...');
          
          // Try using merchant_param1 (the actual database order ID)
          if (merchant_param1) {
            console.log('🔍 Searching for order with id:', merchant_param1);
            
            const { data: altOrder, error: altFetchError } = await supabase
              .from('orders')
              .select('id, payment_id, payment_status, order_status, user_name')
              .eq('id', parseInt(merchant_param1))
              .single();

            if (altFetchError) {
              console.error('❌ Order not found with either payment_id or id:', {
                payment_id: order_id,
                id: merchant_param1,
                errors: { fetchError, altFetchError }
              });
              
              return res.status(404).json({ 
                error: 'Order not found in database',
                order_id,
                merchant_param1,
                searchErrors: {
                  byPaymentId: fetchError.message,
                  byId: altFetchError.message
                }
              });
            }

            orderFound = true;
            console.log('✅ Found order using merchant_param1:', altOrder);

            // Update using the database ID
            const { data, error } = await supabase
              .from('orders')
              .update({
                payment_status: 'success',
                order_status: 'confirmed',
                tracking_id: tracking_id || null,
                bank_ref_no: bank_ref_no || null,
                payment_mode: payment_mode || null,
                card_name: card_name || null,
                transaction_date: trans_date || null,
                updated_at: new Date().toISOString()
              })
              .eq('id', parseInt(merchant_param1))
              .select();

            updateResult = { data, error };
          }
        } else {
          orderFound = true;
          console.log('✅ Found order using payment_id:', existingOrder);

          // Update using payment_id
          const { data, error } = await supabase
            .from('orders')
            .update({
              payment_status: 'success',
              order_status: 'confirmed',
              tracking_id: tracking_id || null,
              bank_ref_no: bank_ref_no || null,
              payment_mode: payment_mode || null,
              card_name: card_name || null,
              transaction_date: trans_date || null,
              updated_at: new Date().toISOString()
            })
            .eq('payment_id', order_id)
            .select();

          updateResult = { data, error };
        }

        if (!orderFound) {
          return res.status(404).json({ 
            error: 'Order not found',
            order_id,
            merchant_param1
          });
        }

        if (updateResult.error) {
          console.error('❌ Database update error:', updateResult.error);
          return res.status(500).json({ 
            error: 'Database update failed',
            details: updateResult.error,
            order_id
          });
        }

        console.log('✅ Database update successful:', updateResult.data);

        if (updateResult.data && updateResult.data.length === 0) {
          console.warn('⚠️ No rows were updated');
          return res.status(404).json({ 
            error: 'Order update failed - no matching rows',
            order_id,
            merchant_param1
          });
        }

        // Success! Log the completion
        console.log('🎉 Payment processing completed successfully');
        console.log('- Updated rows:', updateResult.data?.length);
        console.log('- Order ID:', order_id);
        console.log('- Database Order ID:', merchant_param1);

      } catch (dbError) {
        console.error('❌ Database operation failed:', dbError);
        return res.status(500).json({ 
          error: 'Database operation failed',
          message: dbError.message,
          order_id
        });
      }

      // Handle response based on request type
      if (req.headers['user-agent']?.includes('Postman') || 
          req.headers['content-type']?.includes('application/json') ||
          req.query.debug === 'true') {
        return res.status(200).json({ 
          success: true, 
          message: 'Payment processed successfully',
          order_id,
          order_status,
          tracking_id,
          payment_mode,
          updated_rows: updateResult.data?.length || 0
        });
      }

      // For actual CCAvenue redirect
      console.log('🔄 Redirecting to success page...');
      return res.redirect('https://gcmtshop.com/#/payment-success');
      
    } else {
      console.log('❌ Payment not successful');
      console.log('- Order Status:', order_status);
      console.log('- Status Code:', status_code);
      console.log('- Status Message:', status_message);
      
      // Update order status to failed
      try {
        let failedUpdateQuery;
        
        if (merchant_param1) {
          failedUpdateQuery = supabase
            .from('orders')
            .update({
              payment_status: 'failed',
              order_status: 'cancelled',
              status_message: status_message || `Payment ${order_status}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', parseInt(merchant_param1));
        } else {
          failedUpdateQuery = supabase
            .from('orders')
            .update({
              payment_status: 'failed',
              order_status: 'cancelled',
              status_message: status_message || `Payment ${order_status}`,
              updated_at: new Date().toISOString()
            })
            .eq('payment_id', order_id);
        }

        const { error: failedUpdateError } = await failedUpdateQuery;
        
        if (failedUpdateError) {
          console.error('❌ Error updating failed payment:', failedUpdateError);
        } else {
          console.log('✅ Updated order status to failed');
        }
      } catch (failedDbError) {
        console.error('❌ Failed to update failed payment status:', failedDbError);
      }

      // Handle response based on request type
      if (req.headers['user-agent']?.includes('Postman') || 
          req.headers['content-type']?.includes('application/json') ||
          req.query.debug === 'true') {
        return res.status(200).json({ 
          success: false, 
          message: 'Payment failed or cancelled',
          order_id,
          order_status,
          status_code,
          status_message
        });
      }

      console.log('🔄 Redirecting to cancel page...');
      return res.redirect('https://gcmtshop.com/#/payment-cancel');
    }
    
  } catch (err) {
    console.error('💥 paymentResponse handler error:', err);
    console.error('💥 Error stack:', err.stack);
    
    // Handle response based on request type
    if (req.headers['user-agent']?.includes('Postman') || 
        req.headers['content-type']?.includes('application/json') ||
        req.query?.debug === 'true') {
      return res.status(500).json({ 
        error: 'Internal server error', 
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }

    console.log('🔄 Redirecting to cancel page due to error...');
    return res.redirect('https://gcmtshop.com/#/payment-cancel');
  }
}

// ✅ CRITICAL: Proper body parser configuration for CCAvenue form data
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
      // This is crucial for parsing CCAvenue's form-encoded response
    },
  },
}
