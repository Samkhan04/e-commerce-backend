const mongoose = require('mongoose');
const visitorSchema = new mongoose.Schema({
  ip: { type: String, required: true },
  date: { type: String, required: true },
  userAgent: { type: String, default: '' },
  source: { type: String, default: 'direct' },
  count: { type: Number, default: 1 }
}, { timestamps: true });
visitorSchema.index({ ip: 1, date: 1 }, { unique: true });
module.exports = mongoose.model('Visitor', visitorSchema);