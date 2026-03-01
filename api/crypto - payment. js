module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { email, userName, amount, cryptoType, txHash } = req.body;

    if (!txHash) {
      return res.status(400).json({ success: false, message: 'Transaction hash required' });
    }

    const paymentId = 'CRYPTO-' + Date.now();

    // Send email notification to admin via EmailJS REST API
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: 'service_p61trhq',
        template_id: 'template_14jwbju',
        user_id: 'wbl3XpIjAm_87c4Nl',
        accessToken: 'ZQ5HwvJhuZ8C1veOR8B_I',
        template_params: {
          to_email: 'youradmin@gmail.com',
          subject: `💎 CRYPTO DEPOSIT — $${amount}`,
          from_name: userName,
          user_email: email,
          message: `Crypto Payment!\nAmount: $${amount}\nType: ${cryptoType}\nTX: ${txHash}\nID: ${paymentId}`
        }
      })
    });

    return res.status(200).json({
      success: true,
      message: 'Crypto payment submitted for verification',
      paymentId
    });

  } catch (error) {
    console.error('Crypto payment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit' });
  }
};
