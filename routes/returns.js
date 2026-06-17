const express = require('express');
const router = express.Router();
const Return = require('../models/Return');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/', protect, async (req, res) => {
  try {
    const { orderId, items, reason, refundMethod, pickupAddress } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Select items to return' });
    }
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.user.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (order.status !== 'delivered') return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });

    const deliveredDate = order.actualDelivery || order.updatedAt;
    const daysSinceDelivery = Math.floor((Date.now() - new Date(deliveredDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceDelivery > 7) return res.status(400).json({ success: false, message: 'Return window closed (7 days exceeded)' });

    const refundAmount = items.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0);

    const returnRequest = await Return.create({
      order: orderId,
      user: req.user._id,
      items: items.map(i => ({ product: i.productId, name: i.name, quantity: i.quantity, price: i.price, reason: i.reason || reason, condition: i.condition || 'unopened' })),
      refundAmount,
      refundMethod: refundMethod || 'original',
      pickupAddress: pickupAddress || order.shippingAddress,
      notes: reason
    });
    // Admin email notification (optional)
    try {
      const { sendEmail } = require('../utils/email');
      await sendEmail({
        to: process.env.ADMIN_EMAIL || 'velriclondon2004@gmail.com',
        subject: `New Return Request — Order ${order.orderNumber}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
            <div style="background:#e74c3c;color:#fff;padding:20px;text-align:center;">
              <h2 style="margin:0;">New Return Request</h2>
            </div>
            <div style="padding:30px;">
              <p><strong>Order:</strong> ${order.orderNumber}</p>
              <p><strong>Refund Amount:</strong> ₹${refundAmount}</p>
              <p><strong>Items:</strong> ${items.map(i => i.name + ' x' + i.quantity).join(', ')}</p>
              <p><strong>Reason:</strong> ${reason}</p>
              <div style="margin-top:20px;text-align:center;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:5500'}/index.html#admin" style="display:inline-block;background:#6B3A1F;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Open Admin Panel</a>
              </div>
            </div>
          </div>
        `
      });
    } catch (e) { console.log('Admin return email failed:', e.message); }

    res.status(201).json({ success: true, data: returnRequest });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }

});

router.get('/my-returns', protect, async (req, res) => {
  try {
    const returns = await Return.find({ user: req.user._id }).populate('order', 'orderNumber').sort({ createdAt: -1 });
    res.json({ success: true, count: returns.length, data: returns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/admin/all', protect, adminOnly, async (req, res) => {
  try {
    const returns = await Return.find().populate('user', 'name email phone').populate('order', 'orderNumber').sort({ createdAt: -1 });
    res.json({ success: true, count: returns.length, data: returns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status, trackingId } = req.body;
    const ret = await Return.findById(req.params.id);
    if (!ret) return res.status(404).json({ success: false, message: 'Not found' });
    ret.status = status;
    if (trackingId) ret.trackingId = trackingId;
    if (status === 'refunded') {
      ret.resolvedAt = new Date();
      for (const item of ret.items) {
        if (item.product) {
          const prod = await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } }, { new: true });
          if (prod) await prod.save(); // 🔥 stockStatus hook trigger hoga
        }
      }
    }
    await ret.save();
    res.json({ success: true, data: ret });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;