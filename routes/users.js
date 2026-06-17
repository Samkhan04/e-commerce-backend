const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const newUsers = await User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } });
    res.json({ success: true, data: { totalUsers, newUsers } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/wishlist', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'favorites',
      match: { isAvailable: true } // 🔥 sirf active products
    });
    res.json({ success: true, data: user.favorites || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/wishlist/:productId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.favorites.includes(req.params.productId)) {
      user.favorites.push(req.params.productId);
      await user.save();
    }
    res.json({ success: true, message: 'Added to wishlist' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/wishlist/:productId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.favorites = user.favorites.filter(id => id.toString() !== req.params.productId);
    await user.save();
    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/address', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const newAddr = req.body;
    if (newAddr.isDefault) user.addresses.forEach(a => a.isDefault = false);
    user.addresses.push(newAddr);
    await user.save();
    res.json({ success: true, data: user.addresses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/address/:idx', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const idx = parseInt(req.params.idx);
    if (isNaN(idx) || idx < 0 || idx >= user.addresses.length) return res.status(400).json({ success: false, message: 'Invalid address index' });
    user.addresses.splice(idx, 1);
    await user.save();
    res.json({ success: true, data: user.addresses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;