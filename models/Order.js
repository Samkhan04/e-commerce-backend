const mongoose = require('mongoose');
const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: String,
  size: { type: String, default: '' },
  color: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  totalPrice: { type: Number, required: true }
});
const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderNumber: { type: String, unique: true, sparse: true },
  items: [orderItemSchema],
  subtotal: { type: Number, required: true },
  shippingFee: { type: Number, default: 0 },
  platformFee: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  couponCode: { type: String, default: null },
  status: { type: String, enum: ['pending', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'], default: 'pending' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  paymentMethod: { type: String, enum: ['cod', 'card', 'upi', 'wallet', 'razorpay'], default: 'cod' },
  shippingAddress: {
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
  estimatedDelivery: { type: Date },
  actualDelivery: { type: Date },
  notes: { type: String, maxlength: 200 },
  rating: { score: { type: Number, min: 1, max: 5 }, review: String, createdAt: Date },
  isDeleted: { type: Boolean, default: false },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String }
}, { timestamps: true });
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.orderNumber = `VL-${new Date().getFullYear()}-${timestamp}-${random}`;
  }
  next();
});
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
module.exports = mongoose.model('Order', orderSchema);