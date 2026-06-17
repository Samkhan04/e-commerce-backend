const mongoose = require('mongoose');
const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  description: { type: String, required: true },
  discountType: { type: String, enum: ['percentage', 'fixed', 'free_delivery'], required: true },
  discountValue: { type: Number, required: true, min: 0 },
  minOrderAmount: { type: Number, default: 0 },
  maxDiscount: { type: Number, default: null },
  validFrom: { type: Date, default: Date.now },
  validUntil: { type: Date, required: true },
  usageLimit: { type: Number, default: null },
  usageCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  applicableCategories: [{ type: String, enum: ['all', 'belts', 'jackets', 'shoes', 'purses', 'sandals', 'slippers', 'wallets', 'accessories'] }]
}, { timestamps: true });
couponSchema.methods.isValid = function() {
  const now = new Date();
  if (!this.isActive) return false;
  if (now < this.validFrom || now > this.validUntil) return false;
  if (this.usageLimit && this.usageCount >= this.usageLimit) return false;
  return true;
};
module.exports = mongoose.model('Coupon', couponSchema);