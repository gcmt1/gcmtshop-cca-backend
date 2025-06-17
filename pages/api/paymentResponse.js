// pages/api/paymentResponse.js

const { Buffer } = require('buffer');
const { parse: parseQs } = require('querystring');
const crypto = require('crypto');
const supabase = require('../../lib/supabase');

const WORKING_KEY = process.env.CCA_WORKING_KEY;

module.exports = async function handler(req, res) {
  console.log(`⏳ [paymentResponse] got ${req.method}`);

  if (req.method !== 'POST') {
    console.warn('[paymentResponse] Method not allowed:', req.method);
    return res.status(405).end('Method Not Allowed');
  }

  // 1) Read raw body
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  console.log('[paymentResponse] rawBody:', rawBody);

  // 2) Parse form‑encoded data
  const parsed = parseQs(rawBody);
  const encResp = parsed.encResp;
  if (!encResp) {
    console.error('[paymentResponse] missing encResp');
    return res.redirect('https://gcmtshop.com/#/payment-cancel');
  }
  console.log('[paymentResponse] encResp (first 80 chars):', encResp.slice(0,80));

  // 3) Decrypt
  let decrypted;
  try {
    const key = crypto.createHash('md5').update(WORKING_KEY).digest();
    // IV must match CCAvenue’s docs
    const iv = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    decipher.setAutoPadding(true);
    decrypted = decipher.update(encResp, 'base64', 'utf8') + decipher.final('utf8');
    console.log('[paymentResponse] decrypted:', decrypted);
  } catch (err) {
    console.error('[paymentResponse] decryption error:', err);
    return res.redirect('https://gcmtshop.com/#/payment-cancel');
  }

  // 4) Parse decrypted params
  const params = Object.fromEntries(new URLSearchParams(decrypted));
  const order_id = params.order_id;
  const order_status = (params.order_status || '').toLowerCase();
  console.log('[paymentResponse] parsed params:', params);

  if (!order_id) {
    console.error('[paymentResponse] missing order_id');
    return res.redirect('https://gcmtshop.com/#/payment-cancel');
  }

  // 5) Update Supabase and redirect
  try {
    if (order_status === 'success') {
      const { data, error } = await supabase
        .from('orders')
        .update({ payment_status: 'success', order_status: 'confirmed' })
        .eq('payment_id', order_id)
        .select();
      if (error) throw error;
      console.log('[paymentResponse] DB updated, rows:', data?.length);
      if (!data?.length) {
        console.warn('[paymentResponse] no matching order:', order_id);
        return res.redirect('https://gcmtshop.com/#/payment-cancel');
      }
      return res.redirect('https://gcmtshop.com/#/payment-success');
    } else {
      await supabase
        .from('orders')
        .update({ payment_status: 'failed', order_status: 'cancelled' })
        .eq('payment_id', order_id);
      console.log('[paymentResponse] marked failed for', order_id);
      return res.redirect('https://gcmtshop.com/#/payment-cancel');
    }
  } catch (dbErr) {
    console.error('[paymentResponse] Supabase error:', dbErr);
    return res.redirect('https://gcmtshop.com/#/payment-cancel');
  }
};

// Disable Next.js built‑in JSON parser so we can read raw form data
module.exports.config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};
