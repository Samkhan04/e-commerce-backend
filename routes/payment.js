const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');

const hasRazorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'rzp_test_your_key_here' && process.env.RAZORPAY_KEY_SECRET;

let razorpay;
if (hasRazorpay) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

router.post('/create-order', protect, async (req, res) => {
  try {
    console.log('📡 /create-order called with:', req.body);
    
    if (!hasRazorpay) {
      console.error('❌ Razorpay not configured');
      return res.status(503).json({ success: false, message: 'Payment module not configured' });
    }
    
    const { amount, orderId } = req.body;
    const options = {
      amount: amount * 100,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: { orderId: orderId }
    };
    
    
    await Order.findByIdAndUpdate(orderId, { razorpayOrderId: razorpayOrder.id });
    res.json({ success: true, data: razorpayOrder });
  } catch (error) {
    console.error('❌ /create-order error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
router.post('/verify', protect, async (req, res) => {
  try {
    
    
    if (!hasRazorpay) {
      console.error('❌ Razorpay not configured');
      return res.status(503).json({ success: false, message: 'Payment module not configured.' });
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');
    if (expectedSignature === razorpay_signature) {
      await Order.findByIdAndUpdate(orderId, {
        paymentStatus: 'paid',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'confirmed'
      });
      res.json({ success: true, message: 'Payment verified' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid signature' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/config', (req, res) => {
  res.json({
    success: true,
    key: process.env.RAZORPAY_KEY_ID || '',
    enabled: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  });
});

module.exports = router;