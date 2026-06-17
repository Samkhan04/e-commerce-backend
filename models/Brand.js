const mongoose = require('mongoose');
const brandSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, maxlength: 500 },
  logo: { type: String, default: '' },
  origin: { type: String, default: 'London, UK' },
  established: { type: Number, default: 2020 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
module.exports = mongoose.model('Brand', brandSchema);