const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const sendEmail = require('../utils/email');
const rateLimit = require('express-rate-limit');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' });

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

// Forgot password rate limiter
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many password reset attempts. Try again in 1 hour.' }
});

router.post('/register', [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().trim()
], handleValidation, async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ success: false, message: 'User already exists' });
    const user = await User.create({ name, email, password, phone });
    res.status(201).json({ success: true, token: generateToken(user._id), user: { id: user._id, name: user.name, email: user.email, role: user.role, loyaltyPoints: user.loyaltyPoints } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], handleValidation, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    res.json({ success: true, token: generateToken(user._id), user: { id: user._id, name: user.name, email: user.email, role: user.role, loyaltyPoints: user.loyaltyPoints } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found with this email' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000;
    await user.save();

    // Frontend should extract token from URL hash and send via body
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5500'}/index.html#reset-password/${resetToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Velric London - Password Reset',
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #ddd;border-radius:8px;overflow:hidden;"><div style="background:#6B3A1F;color:#fff;padding:20px;text-align:center;"><h2 style="margin:0;">Velric London</h2></div><div style="padding:30px;"><h3>Password Reset Request</h3><p>Hello ${user.name},</p><p>You requested a password reset. Click the button below:</p><a href="${resetUrl}" style="display:inline-block;background:#6B3A1F;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:16px 0;">Reset Password</a><p style="color:#888;font-size:12px;">This link expires in 30 minutes. If you didn't request this, ignore this email.</p></div></div>`
      });
      res.json({ success: true, message: 'Password reset email sent. Check your inbox.' });
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
      if (process.env.NODE_ENV !== 'production') {
  
  return res.json({ success: true, message: 'Email not sent (dev mode). Check server console for token.' });
}
      res.status(500).json({ success: false, message: 'Email could not be sent' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/reset-password/:resettoken', async (req, res) => {
  try {
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.resettoken).digest('hex');
    const user = await User.findOne({ resetPasswordToken, resetPasswordExpire: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired token' });

    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favorites');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/me', protect, async (req, res) => {
  try {
    const fields = {};
    if (req.body.name) fields.name = req.body.name;
    if (req.body.phone) fields.phone = req.body.phone;
    if (req.body.avatar) fields.avatar = req.body.avatar;
    if (req.body.addresses) fields.addresses = req.body.addresses;
    const user = await User.findByIdAndUpdate(req.user._id, fields, { new: true });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/password', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+password');
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Both passwords required' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    if (!(await user.comparePassword(currentPassword))) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;