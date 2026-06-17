const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const User = require('../models/User');
const Otp = require('../models/Otp');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' });

// ===== MSG91 SEND OTP =====
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit phone required' });
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hash = crypto.createHash('sha256').update(otp + cleanPhone + process.env.JWT_SECRET).digest('hex');

    // Store in MongoDB with 5 min expiry
    await Otp.findOneAndUpdate(
      { phone: cleanPhone },
      { hash, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      { upsert: true, new: true }
    );

    // Send via MSG91
    const authKey = process.env.MSG91_AUTHKEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;
    const senderId = process.env.MSG91_SENDER_ID || 'VLONDN';

    if (authKey && templateId) {
      try {
        const response = await axios.post('https://control.msg91.com/api/v5/otp', {
          template_id: templateId,
          mobile: `91${cleanPhone}`,
          otp: otp,
          sender_id: senderId
        }, {
          headers: {
            'authkey': authKey,
            'Content-Type': 'application/json'
          }
        });

        if (response.data && response.data.type === 'success') {
          return res.json({ success: true, message: 'OTP sent to +91-' + cleanPhone });
        } else {
          console.error('MSG91 response:', response.data);
          throw new Error('MSG91 API error');
        }
      } catch (smsErr) {
        console.error('MSG91 SMS failed:', smsErr.response?.data || smsErr.message);
        
        // Dev mode fallback
        if (process.env.NODE_ENV !== 'production') {
          return res.json({ success: true, message: 'OTP sent (dev mode - SMS failed)', otp, phone: cleanPhone });
        }
        return res.status(500).json({ success: false, message: 'SMS service temporarily unavailable. Please try password login.' });
      }
    }

    // Dev mode fallback (no MSG91 config)
    if (process.env.NODE_ENV !== 'production') {
      return res.json({ success: true, message: 'OTP sent (dev mode)', otp, phone: cleanPhone });
    }
    
    res.status(503).json({ success: false, message: 'SMS service not configured. Please use password login or contact support.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== VERIFY OTP (same as before) =====
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    const stored = await Otp.findOne({ phone: cleanPhone });
    if (!stored || new Date() > stored.expiresAt) {
      return res.status(400).json({ success: false, message: 'OTP expired or invalid' });
    }

    const hash = crypto.createHash('sha256').update(otp + cleanPhone + process.env.JWT_SECRET).digest('hex');
    if (hash !== stored.hash) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    await Otp.deleteOne({ _id: stored._id });

    let user = await User.findOne({ phone: cleanPhone });
    if (!user) {
      user = await User.create({
        name: 'User ' + cleanPhone.slice(-4),
        email: cleanPhone + '@velric.temp',
        phone: cleanPhone,
        password: crypto.randomBytes(24).toString('hex')
      });
    }
    res.json({ success: true, token: generateToken(user._id), user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, loyaltyPoints: user.loyaltyPoints } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;