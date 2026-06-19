const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const coupons = await Coupon.find({ isActive: true, validFrom: { $lte: now }, validUntil: { $gte: now } }).sort({ createdAt: -1 });
    res.json({ success: true, count: coupons.length, data: coupons });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/validate/:code', async (req, res) => {
  try {
    console.log('🏷️ Validating coupon:', req.params.code);
    const coupon = await Coupon.findOne({ code: req.params.code.toUpperCase() });
    
    if (!coupon) {
      console.log('❌ Coupon not found:', req.params.code);
      return res.status(404).json({ success: false, message: 'Invalid coupon code' });
    }
    
    console.log('✅ Coupon found:', coupon.code, 'isValid:', coupon.isValid());
    console.log('Details:', {
      isActive: coupon.isActive,
      validFrom: coupon.validFrom,
      validUntil: coupon.validUntil,
      usageCount: coupon.usageCount,
      usageLimit: coupon.usageLimit,
      now: new Date()
    });
    
    if (!coupon.isValid()) {
      return res.status(400).json({ success: false, message: 'Coupon expired or usage limit reached' });
    }
    
    res.json({ success: true, data: coupon });
  } catch (error) {
    console.error('❌ Coupon validation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json({ success: true, data: coupon });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;