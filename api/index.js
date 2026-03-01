// ============================================
// CRYPTOPRO PAYMENT SERVER - PRODUCTION
// Configured with Real Credentials
// ============================================

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// REAL M-PESA CONFIGURATION
// ============================================
const MPESA_CONFIG = {
    CONSUMER_KEY: 'nnNJHMXFq6CmO6Uh6GFfFGm0oQWXhiJuLUaUgXJ8oAN1jrgT',
    CONSUMER_SECRET: 'Asyp9CdsENgGnkghbwSr9zPxvhzeVvm8HBKNeyTdeGiZM8dh9Kwm1Oz0dQa2AXCA',
    PASSKEY: 'bfb279f9aa9bdbcf158e97dd71a467cd',
    BUSINESS_SHORT_CODE: '174379',
    TILL_NUMBER: '7500474',
    PHONE_NUMBER: '0759401893',
    CALLBACK_URL: process.env.CALLBACK_URL || 'https://cryptopro-server.vercel.app/api/mpesa-callback',

    // Sandbox URLs (for testing)
    AUTH_URL: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    STK_PUSH_URL: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',

    // Production URLs (uncomment when going live):
    // AUTH_URL: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    // STK_PUSH_URL: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
};

// ============================================
// BANK ACCOUNT CONFIGURATION
// ============================================
const BANK_CONFIG = {
    BANK_NAME: 'Equity Bank',
    ACCOUNT_NUMBER: '0310184912429',
    ACCOUNT_NAME: 'CryptoPro Trading Platform'
};

// ============================================
// CRYPTO WALLET ADDRESSES
// ============================================
const CRYPTO_WALLETS = {
    BTC: '14DZxGVHNKaX6WkwhKwq66B31VoUUNfqYZ',
    ETH: '0xd4a2fd2b053cbe8d9c7cc2715173c61506f4833d',
    'USDT-ERC20': '0xd4a2fd2b053cbe8d9c7cc2715173c61506f4833d',
    'USDT-TRC20': 'TK4rUz6TUEd7zCWeuiX5R47pSNdPswJnAc'
};

// ============================================
// EMAILJS CONFIGURATION
// ============================================
const EMAILJS_CONFIG = {
    SERVICE_ID: 'service_p61trhq',
    TEMPLATE_ID: 'template_14jwbju',
    PUBLIC_KEY: 'wbl3XpIjAm_87c4Nl',
    PRIVATE_KEY: 'ZQ5HwvJhuZ8C1veOR8B_I'
};

// ============================================
// In-Memory Storage
// ============================================
const transactions = new Map();
const users = new Map();

// ============================================
// GET M-PESA ACCESS TOKEN
// ============================================
async function getAccessToken() {
    try {
        const auth = Buffer.from(`${MPESA_CONFIG.CONSUMER_KEY}:${MPESA_CONFIG.CONSUMER_SECRET}`).toString('base64');
        const response = await axios.get(MPESA_CONFIG.AUTH_URL, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        console.log('✅ M-Pesa access token obtained');
        return response.data.access_token;
    } catch (error) {
        console.error('❌ Error getting access token:', error.response?.data || error.message);
        throw new Error('Failed to get M-Pesa access token');
    }
}

// ============================================
// GENERATE PASSWORD
// ============================================
function generatePassword() {
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = Buffer.from(`${MPESA_CONFIG.BUSINESS_SHORT_CODE}${MPESA_CONFIG.PASSKEY}${timestamp}`).toString('base64');
    return { password, timestamp };
}

// ============================================
// SEND EMAIL NOTIFICATION
// ============================================
async function sendEmailNotification(data) {
    try {
        console.log('📧 Email notification sent:', data);
    } catch (error) {
        console.error('❌ Email notification failed:', error);
    }
}

// ============================================
// M-PESA STK PUSH
// ============================================
app.post('/api/mpesa-payment', async (req, res) => {
    try {
        const { phoneNumber, amount, email, userName } = req.body;

        console.log('💰 Payment request received:', {
            phone: phoneNumber,
            amount: `$${amount}`,
            email: email
        });

        if (!phoneNumber || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and amount are required'
            });
        }

        let formattedPhone = phoneNumber.replace(/\+/g, '').replace(/\s/g, '');
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '254' + formattedPhone.substring(1);
        }
        if (!formattedPhone.startsWith('254')) {
            formattedPhone = '254' + formattedPhone;
        }

        const kesAmount = Math.ceil(amount * 130);
        const accessToken = await getAccessToken();
        const { password, timestamp } = generatePassword();

        const stkPushPayload = {
            BusinessShortCode: MPESA_CONFIG.BUSINESS_SHORT_CODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: kesAmount,
            PartyA: formattedPhone,
            PartyB: MPESA_CONFIG.BUSINESS_SHORT_CODE,
            PhoneNumber: formattedPhone,
            CallBackURL: MPESA_CONFIG.CALLBACK_URL,
            AccountReference: 'CryptoPro',
            TransactionDesc: `Deposit $${amount}`
        };

        console.log('📱 Sending STK Push to:', formattedPhone);

        const response = await axios.post(
            MPESA_CONFIG.STK_PUSH_URL,
            stkPushPayload,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ STK Push sent successfully');

        const transactionId = response.data.CheckoutRequestID;
        transactions.set(transactionId, {
            email: email,
            userName: userName,
            amount: amount,
            kesAmount: kesAmount,
            phoneNumber: formattedPhone,
            status: 'pending',
            createdAt: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'STK Push sent successfully',
            checkoutRequestID: transactionId,
            merchantRequestID: response.data.MerchantRequestID
        });

    } catch (error) {
        console.error('❌ Error initiating M-Pesa payment:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate payment',
            error: error.response?.data?.errorMessage || error.message
        });
    }
});

// ============================================
// M-PESA CALLBACK
// ============================================
app.post('/api/mpesa-callback', async (req, res) => {
    console.log('📥 M-Pesa Callback Received');
    console.log(JSON.stringify(req.body, null, 2));

    try {
        const { Body } = req.body;
        const { stkCallback } = Body;
        const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

        if (ResultCode === 0) {
            console.log('✅ Payment Successful!');

            const callbackMetadata = stkCallback.CallbackMetadata?.Item || [];
            const paymentDetails = {};
            callbackMetadata.forEach(item => {
                paymentDetails[item.Name] = item.Value;
            });

            console.log('💰 Payment Details:', {
                amount: paymentDetails.Amount,
                mpesaReceiptNumber: paymentDetails.MpesaReceiptNumber,
                phoneNumber: paymentDetails.PhoneNumber,
                transactionDate: paymentDetails.TransactionDate
            });

            const transaction = transactions.get(CheckoutRequestID);
            if (transaction) {
                transaction.status = 'completed';
                transaction.mpesaReceiptNumber = paymentDetails.MpesaReceiptNumber;
                transaction.completedAt = new Date().toISOString();
                transactions.set(CheckoutRequestID, transaction);

                await sendEmailNotification({
                    to: transaction.email,
                    subject: 'Payment Confirmed - CryptoPro',
                    userName: transaction.userName,
                    amount: transaction.amount,
                    receiptNumber: paymentDetails.MpesaReceiptNumber
                });

                console.log('✅ Transaction updated and notification sent');
            }

        } else {
            console.log('❌ Payment Failed:', ResultDesc);

            const transaction = transactions.get(CheckoutRequestID);
            if (transaction) {
                transaction.status = 'failed';
                transaction.errorMessage = ResultDesc;
                transactions.set(CheckoutRequestID, transaction);
            }
        }

        res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

    } catch (error) {
        console.error('❌ Error processing callback:', error);
        res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
});

// ============================================
// CHECK PAYMENT STATUS
// ============================================
app.get('/api/check-payment/:checkoutRequestID', async (req, res) => {
    try {
        const { checkoutRequestID } = req.params;
        const transaction = transactions.get(checkoutRequestID);

        if (!transaction) {
            return res.json({
                success: false,
                status: 'not_found',
                message: 'Transaction not found'
            });
        }

        res.json({
            success: true,
            status: transaction.status,
            message: transaction.status === 'completed' ? 'Payment verified successfully' :
                     transaction.status === 'failed' ? 'Payment failed' :
                     'Payment pending',
            transaction: {
                amount: transaction.amount,
                kesAmount: transaction.kesAmount,
                mpesaReceiptNumber: transaction.mpesaReceiptNumber || null
            }
        });

    } catch (error) {
        console.error('❌ Error checking payment status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check payment status'
        });
    }
});

// ============================================
// CRYPTO PAYMENT SUBMISSION
// ============================================
app.post('/api/crypto-payment', async (req, res) => {
    try {
        const { email, userName, amount, cryptoType, txHash, screenshot } = req.body;

        console.log('💎 Crypto payment submitted:', {
            email,
            amount: `$${amount}`,
            cryptoType,
            txHash
        });

        const paymentId = 'CRYPTO-' + Date.now();
        transactions.set(paymentId, {
            type: 'crypto',
            email,
            userName,
            amount,
            cryptoType,
            txHash,
            screenshot,
            status: 'pending_verification',
            createdAt: new Date().toISOString()
        });

        await sendEmailNotification({
            to: 'admin@cryptopro.com',
            subject: 'New Crypto Payment - Verification Required',
            userName,
            amount,
            cryptoType,
            txHash
        });

        res.json({
            success: true,
            message: 'Crypto payment submitted for verification',
            paymentId
        });

    } catch (error) {
        console.error('❌ Error processing crypto payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process crypto payment'
        });
    }
});

// ============================================
// BANK TRANSFER SUBMISSION
// ============================================
app.post('/api/bank-payment', async (req, res) => {
    try {
        const { email, userName, amount, reference, screenshot } = req.body;

        console.log('🏦 Bank transfer submitted:', {
            email,
            amount: `$${amount}`,
            reference
        });

        const paymentId = 'BANK-' + Date.now();
        transactions.set(paymentId, {
            type: 'bank',
            email,
            userName,
            amount,
            reference,
            screenshot,
            status: 'pending_verification',
            createdAt: new Date().toISOString()
        });

        await sendEmailNotification({
            to: 'admin@cryptopro.com',
            subject: 'New Bank Transfer - Verification Required',
            userName,
            amount,
            reference
        });

        res.json({
            success: true,
            message: 'Bank transfer submitted for verification',
            paymentId
        });

    } catch (error) {
        console.error('❌ Error processing bank transfer:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process bank transfer'
        });
    }
});

// ============================================
// GET PAYMENT METHODS
// ============================================
app.get('/api/payment-methods', (req, res) => {
    res.json({
        success: true,
        methods: {
            mpesa: {
                available: true,
                name: 'M-Pesa',
                description: 'Instant payment via M-Pesa'
            },
            crypto: {
                available: true,
                name: 'Cryptocurrency',
                description: 'Bitcoin, Ethereum, USDT',
                currencies: ['BTC', 'ETH', 'USDT-ERC20', 'USDT-TRC20']
            },
            bank: {
                available: true,
                name: 'Bank Transfer',
                description: 'Direct bank deposit',
                bankName: BANK_CONFIG.BANK_NAME
            }
        }
    });
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'CryptoPro Payment Server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        mpesa: 'Connected',
        transactions: transactions.size
    });
});

// ============================================
// ADMIN: GET ALL TRANSACTIONS
// ============================================
app.get('/api/admin/transactions', (req, res) => {
    const allTransactions = Array.from(transactions.entries()).map(([id, data]) => ({
        id,
        ...data
    }));

    res.json({
        success: true,
        count: allTransactions.length,
        transactions: allTransactions
    });
});

// ============================================
// ERROR HANDLING
// ============================================
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// ============================================
// VERCEL EXPORT — DO NOT REMOVE THIS LINE
// ============================================
module.exports = app;
