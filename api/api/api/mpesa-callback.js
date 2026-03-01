// Since Vercel is stateless, use KV store or external DB
// Using Vercel KV (Redis) — install: npm i @vercel/kv
const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { Body } = req.body;
    const { stkCallback } = Body;
    const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

    if (ResultCode === 0) {
      // Payment SUCCESS
      const items = stkCallback.CallbackMetadata?.Item || [];
      const details = {};
      items.forEach(item => { details[item.Name] = item.Value; });

      // Save to Vercel KV
      await kv.set(`payment:${CheckoutRequestID}`, {
        status: 'completed',
        mpesaReceiptNumber: details.MpesaReceiptNumber,
        amount: details.Amount,
        phone: details.PhoneNumber,
        completedAt: new Date().toISOString()
      }, { ex: 3600 }); // expires in 1 hour

      console.log('✅ Payment confirmed:', details.MpesaReceiptNumber);

    } else {
      // Payment FAILED
      await kv.set(`payment:${CheckoutRequestID}`, {
        status: 'failed',
        error: ResultDesc,
        failedAt: new Date().toISOString()
      }, { ex: 3600 });

      console.log('❌ Payment failed:', ResultDesc);
    }

    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  } catch (error) {
    console.error('Callback error:', error);
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};
