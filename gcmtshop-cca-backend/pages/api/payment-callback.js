// api/payment-callback.js
import { supabase } from './_supabaseClient';      // your server-side supabase client
import { decryptCCAvenueResponse } from './ccadecrypt';  
// decryptCCAvenueResponse is a helper you write (see below)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { encResp } = req.body;
  let data;
  try {
    data = decryptCCAvenueResponse(encResp, process.env.CCA_WORKING_KEY);
  } catch (err) {
    console.error('CCA decrypt error:', err);
    return res.status(400).send('Invalid encrypted response');
  }

  const {
    order_id,           // e.g. "ORD123"
    order_status,       // e.g. "Success", "Aborted", "Failure"
    merchant_param1: savedOrderId
  } = data;

  const paymentSuccess = order_status.toLowerCase() === 'success';

  // 3. Update Supabase
  const { error } = await supabase
    .from('orders')
    .update({ payment_status: paymentSuccess ? 'SUCCESS' : 'FAILED' })
    .eq('id', savedOrderId);

  if (error) console.error('Supabase update error:', error);

  // 4. Redirect browser back front-end
  const frontUrl = paymentSuccess
    ? `https://gcmtshop.com/#/order-confirmation/${savedOrderId}`
    : `https://gcmtshop.com/#/payment-failure/${savedOrderId}`;

  // For POST callback, respond with a 302 so the user’s browser follows
  res.writeHead(302, { Location: frontUrl });
  res.end();
}
