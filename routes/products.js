const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const cloudinary = require('../config/cloudinary');
const upload = require('../middleware/upload');
const { protect, adminOnly } = require('../middleware/auth');

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get('/', async (req, res) => {
  try {
    const { category, search, trending, newArrival, bestseller, brand, minPrice, maxPrice, size, sortBy, page = 1, limit = 24 } = req.query;
    const query = { isAvailable: true, stockStatus: { $ne: 'out_of_stock' } };

    if (category && category !== 'all') query.category = category;
    if (trending === 'true') query.isTrending = true;
    if (newArrival === 'true') query.isNewArrival = true;
    if (bestseller === 'true') query.isBestseller = true;
    if (brand) query.brand = brand;
    if (size) query.sizes = { $in: [size] };
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
        { tags: { $in: [new RegExp(safeSearch, 'i')] } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    let sortOption = { isTrending: -1, rating: -1 };
    if (sortBy === 'price_low') sortOption = { price: 1 };
    else if (sortBy === 'price_high') sortOption = { price: -1 };
    else if (sortBy === 'newest') sortOption = { createdAt: -1 };
    else if (sortBy === 'rating') sortOption = { rating: -1 };

    const items = await Product.find(query).sort(sortOption).skip(skip).limit(Number(limit));
    const total = await Product.countDocuments(query);

    res.json({ success: true, count: items.length, total, page: Number(page), pages: Math.ceil(total / Number(limit)), data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await Product.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', protect, adminOnly, upload.array('images', 6), async (req, res) => {
  try {
    const { name, price, category, sku } = req.body;
    if (!name || !price || !category || !sku) {
      return res.status(400).json({ success: false, message: 'Name, price, category, and SKU are required' });
    }

    // 🔥 Parse colors from JSON strings (FormData sends strings)
    let colors = [];
    if (req.body.colors) {
      const colorArr = Array.isArray(req.body.colors) ? req.body.colors : [req.body.colors];
      colors = colorArr.map(c => {
        try { return typeof c === 'string' ? JSON.parse(c) : c; } 
        catch(e) { return null; }
      }).filter(Boolean);
    }

    // Ensure arrays
    const sizes = req.body.sizes ? (Array.isArray(req.body.sizes) ? req.body.sizes : [req.body.sizes]) : [];
    const tags = req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags]) : [];

    let images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(`data:${file.mimetype};base64,${file.buffer.toString('base64')}`);
        images.push(result.secure_url);
      }
    }

    const product = await Product.create({
      name,
      description: req.body.description || '',
      price: Number(price),
      comparePrice: Number(req.body.comparePrice) || 0,
      category,
      sku,
      sizes,
      colors,
      material: req.body.material || 'Genuine Leather',
      stock: Number(req.body.stock) || 0,
      weight: Number(req.body.weight) || 0.5,
      tags,
      careInstructions: req.body.careInstructions || 'Clean with soft cloth. Avoid water exposure.',
      isTrending: req.body.isTrending === 'true' || req.body.isTrending === true,
      isNewArrival: req.body.isNewArrival === 'true' || req.body.isNewArrival === true,
      isBestseller: req.body.isBestseller === 'true' || req.body.isBestseller === true,
      mainImage: images[0] || '',
      images
    });

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error('Product create error:', error); // 🔥 Server console mein exact error dikhega
    res.status(500).json({ success: false, message: error.message });
  }
});
router.put('/:id', protect, adminOnly, upload.array('images', 6), async (req, res) => {
  try {
    let updateData = { 
      name: req.body.name,
      description: req.body.description || '',
      price: Number(req.body.price),
      comparePrice: Number(req.body.comparePrice) || 0,
      category: req.body.category,
      sku: req.body.sku,
      material: req.body.material || 'Genuine Leather',
      stock: Number(req.body.stock) || 0,
      weight: Number(req.body.weight) || 0.5,
      careInstructions: req.body.careInstructions || 'Clean with soft cloth. Avoid water exposure.',
      isTrending: req.body.isTrending === 'true' || req.body.isTrending === true,
      isNewArrival: req.body.isNewArrival === 'true' || req.body.isNewArrival === true,
      isBestseller: req.body.isBestseller === 'true' || req.body.isBestseller === true,
    };

    // Parse colors
    if (req.body.colors) {
      const colorArr = Array.isArray(req.body.colors) ? req.body.colors : [req.body.colors];
      updateData.colors = colorArr.map(c => {
        try { return typeof c === 'string' ? JSON.parse(c) : c; } 
        catch(e) { return null; }
      }).filter(Boolean);
    }

    // Arrays
    if (req.body.sizes) {
      updateData.sizes = Array.isArray(req.body.sizes) ? req.body.sizes : [req.body.sizes];
    }
    if (req.body.tags) {
      updateData.tags = Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags];
    }

    // Images
    if (req.files && req.files.length > 0) {
      // Images 🔥 FIX: existing images + new images merge
    // Images: merge existing + new
    let images = [];
    
    // Step 1: Pehle se saved images (frontend se aayi hain)
    if (req.body.existingImages) {
      const existing = Array.isArray(req.body.existingImages) ? req.body.existingImages : [req.body.existingImages];
      images.push(...existing);
    }

    // Step 2: Nayi images upload karo
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(`data:${file.mimetype};base64,${file.buffer.toString('base64')}`);
        images.push(result.secure_url);
      }
    }

    // Step 3: Save only if images exist (existing ya new)
    if (images.length > 0) {
      updateData.images = images;
      updateData.mainImage = images[0];
    }
    }
    const item = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Product update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { isAvailable: false, stockStatus: 'out_of_stock' });
    res.json({ success: true, message: 'Product removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/permanent', protect, adminOnly, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product permanently deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/review', protect, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be 1-5' });
    }
    const item = await Product.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });

    item.reviews.push({ user: req.user._id, name: req.user.name, rating, comment: (comment || '').slice(0, 500) });
    const total = item.reviews.reduce((sum, r) => sum + r.rating, 0);
    item.rating = total / item.reviews.length;
    item.ratingCount = item.reviews.length;
    await item.save();
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;