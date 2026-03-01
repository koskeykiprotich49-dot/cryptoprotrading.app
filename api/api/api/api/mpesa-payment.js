const axios = require('axios');

const MPESA_CONFIG = {
  CONSUMER_KEY: 'nnNJHMXFq6CmO6Uh6GFfFGm0oQWXhiJuLUaUgXJ8oAN1jrgT',
  CONSUMER_SECRET: 'Asyp9CdsENgGnkghbwSr9zPxvhzeVvm8HBKNeyTdeGiZM8dh9Kwm1Oz0dQa2AXCA',
  PASSKEY: 'bfb279f9aa9bdbcf158e97dd71a467cd',
  BUSINESS_SHORT_CODE: '174379',
  CALLBACK_URL: process.env.CALLBACK_URL || 'https://your-project.vercel.app/api/mpesa-callback',
  AUTH_URL: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
  STK_PUSH_URL: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
  // LIVE URLS (uncomment when going live):
  // AUTH_URL: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
  // STK_PUSH_URL: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
};

async function getAccessToken() {
  const auth = Buffer.from(`${MPESA_CONFIG.CONSUMER_KEY}:${MPESA_CONFIG.CONSUMER_SECRET}`).toString('base64');
  const response = await axios.get(MPESA_CONFIG.AUTH_URL, {
    headers: { 'Authorization': `Basic ${auth}` }
  });
  return response.data.access_token;
}

function generatePassword() {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
  const password = Buffer.from(`${MPESA_CONFIG.BUSINESS_SHORT_CODE}${MPESA_CONFIG.PASSKEY}${timestamp}`).toString('base64');
  return { password, timestamp };
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { phoneNumber, amount, email, userName } = req.body;

    if (!phoneNumber || !amount) {
      return res.status(400).json({ success: false, message: 'Phone and amount required' });
    }

    // Format phone
    let phone = phoneNumber.replace(/\+/g, '').replace(/\s/g, '');
    if (phone.startsWith('0')) phone = '254' + phone.substring(1);
    if (!phone.startsWith('254')) phone = '254' + phone;

    const kesAmount = Math.ceil(amount * 130);
    const accessToken = await getAccessToken();
    const { password, timestamp } = generatePassword();

    const payload = {
      BusinessShortCode: MPESA_CONFIG.BUSINESS_SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: kesAmount,
      PartyA: phone,
      PartyB: MPESA_CONFIG.BUSINESS_SHORT_CODE,
      PhoneNumber: phone,
      CallBackURL: MPESA_CONFIG.CALLBACK_URL,
      AccountReference: 'CryptoPro',
      TransactionDesc: `Deposit $${amount}`
    };

    const response = await axios.post(MPESA_CONFIG.STK_PUSH_URL, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return res.status(200).json({
      success: true,
      message: 'STK Push sent! Check your phone.',
      checkoutRequestID: response.data.CheckoutRequestID,
      merchantRequestID: response.data.MerchantRequestID
    });

  } catch (error) {
    console.error('STK Push error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: error.response?.data?.errorMessage || 'Failed to initiate payment'
    });
  }
};
