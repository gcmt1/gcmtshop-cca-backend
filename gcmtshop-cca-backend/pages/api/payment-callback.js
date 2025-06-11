// api/payment-callback.js
import { decrypt }          from '../../lib/ccavenueEncrypt';      // your existing AES/CryptoJS logic
import { createClient }     from '@supabase/supabase-js';         // server‐side
import Cors                from 'cors';
import initMiddleware      from '../../lib/init-middleware';

const cors = initMiddleware(
  Cors({
    methods: ['POST', 'OPTIONS'],
    origin: ['https://gcmtshop.com', 'http://localhost:3000'],
  })
);

// Initialize Supabase with your SERVICE_ROLE_KEY (env var)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  await cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { encResp } = req.body;
    if (!encResp) return res.status(400).send('Missing encResp');

    // 1️⃣ Decrypt CCAvenue response
    const dataString = decrypt(encResp, process.env.WORKING_KEY);
    // dataString is like: "order_id=ORD123&order_status=Success&merchant_param1=45..."
    const params = new URLSearchParams(dataString);
    const orderId     = params.get('order_id');
    const status      = params.get('order_status');
    const savedOrderId= params.get('merchant_param1');

    const isSuccess = status?.toLowerCase() === 'success';
    const newStatus = isSuccess ? 'SUCCESS' : 'FAILED';

    // 2️⃣ Update your Supabase order row
    const { error: updateErr } = await supabase
      .from('orders')
      .update({ payment_status: newStatus })
      .eq('id', savedOrderId);

    if (updateErr) console.error('❌ Supabase update error:', updateErr);

    // 3️⃣ Redirect user to your frontend
    const frontBase = 'https://gcmtshop.com/#';
    const location = isSuccess
      ? `${frontBase}/order-confirmation/${savedOrderId}`
      : `${frontBase}/payment-failure/${savedOrderId}`;

    res.writeHead(302, { Location: location });
    res.end();

  } catch (err) {
    console.error('💥 payment-callback error:', err);
    res.status(500).send('Server error');
  }
}
