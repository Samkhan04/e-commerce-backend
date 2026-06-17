const express = require('express');
const router = express.Router();
const Brand = require('../models/Brand');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const brands = await Brand.find({ isActive: true });
    res.json({ success: true, count: brands.length, data: brands });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const brand = await Brand.create(req.body);
    res.status(201).json({ success: true, data: brand });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;