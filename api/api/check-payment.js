const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Get ID from query: /api/check-payment?id=xxxxx
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Payment ID required' });
    }

    const transaction = await kv.get(`payment:${id}`);

    if (!transaction) {
      return res.status(200).json({ success: true, status: 'pending' });
    }

    return res.status(200).json({
      success: true,
      status: transaction.status,
      transaction: {
        mpesaReceiptNumber: transaction.mpesaReceiptNumber || null,
        amount: transaction.amount || null
      }
    });

  } catch (error) {
    console.error('Check payment error:', error);
    return res.status(500).json({ success: false, message: 'Error checking payment' });
  }
};
