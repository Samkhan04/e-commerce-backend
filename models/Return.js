const mongoose = require('mongoose');
const returnItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: String,
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  reason: { type: String, required: true },
  condition: { type: String, enum: ['unopened', 'opened_unused', 'damaged', 'wrong_item'], default: 'unopened' }
});
const returnSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [returnItemSchema],
  status: { type: String, enum: ['requested', 'approved', 'rejected', 'picked_up', 'refunded', 'cancelled'], default: 'requested' },
  refundAmount: { type: Number, required: true },
  refundMethod: { type: String, enum: ['original', 'wallet'], default: 'original' },
  pickupAddress: {
    fullName: String,
    phone: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },
  trackingId: { type: String, default: '' },
  notes: { type: String, maxlength: 1000 },
  resolvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Return', returnSchema);