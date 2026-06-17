const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  hash: { type: String, required: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

// TTL index: auto-delete after expiresAt
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', otpSchema);