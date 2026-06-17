const mongoose = require('mongoose');
const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: String,
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: String,
  createdAt: { type: Date, default: Date.now }
});
const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, maxlength: 1000 },
  price: { type: Number, required: true, min: 0 },
  comparePrice: { type: Number, default: 0 },
  images: [{ type: String }],
  mainImage: { type: String, default: '' },
  category: { type: String, required: true, enum: ['belts', 'jackets', 'shoes', 'purses', 'sandals', 'slippers', 'wallets', 'accessories'] },
  brand: { type: String, default: 'Velric London' },
  sku: { type: String, unique: true, required: true },
  sizes: [{ type: String }],
  colors: [{ name: String, hex: String }],
  material: { type: String, default: 'Genuine Leather' },
  stock: { type: Number, default: 10, min: 0 },
  stockStatus: { type: String, enum: ['in_stock', 'low_stock', 'out_of_stock'], default: 'in_stock' },
  weight: { type: Number, default: 0.5 },
  isTrending: { type: Boolean, default: false },
  isNewArrival: { type: Boolean, default: false },
  isBestseller: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0 },
  reviews: [reviewSchema],
  tags: [String],
  careInstructions: { type: String, default: 'Clean with soft cloth. Avoid water exposure.' }
}, { timestamps: true });
productSchema.pre('save', function(next) {
  if (this.stock === 0) this.stockStatus = 'out_of_stock';
  else if (this.stock <= 3) this.stockStatus = 'low_stock';
  else this.stockStatus = 'in_stock';
  next();
});
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, isAvailable: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ isTrending: -1, rating: -1 });
module.exports = mongoose.model('Product', productSchema);