const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

// GET /api/cart - Get my cart with product details
router.get('/', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product', 'name mainImage price stock stockStatus');
    if (!cart) return res.json({ success: true, data: { items: [] } });
    res.json({ success: true, data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/cart - Add item to cart
router.post('/', protect, async (req, res) => {
  try {
    const { productId, quantity, size, color } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: 'Product ID required' });

    const qty = Math.max(1, parseInt(quantity) || 1);
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (product.stockStatus === 'out_of_stock') return res.status(400).json({ success: false, message: 'Out of stock' });
    if (product.stock < qty) return res.status(400).json({ success: false, message: `Only ${product.stock} units available` });

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = new Cart({ user: req.user._id, items: [] });

    const itemIndex = cart.items.findIndex(item =>
      item.product.toString() === productId &&
      item.size === (size || '') &&
      item.color === (color || '')
    );

    if (itemIndex > -1) {
      const newQty = cart.items[itemIndex].quantity + qty;
      if (product.stock < newQty) return res.status(400).json({ success: false, message: `Only ${product.stock} units available. You already have ${cart.items[itemIndex].quantity} in cart.` });
      cart.items[itemIndex].quantity = newQty;
    } else {
      cart.items.push({
        product: productId,
        quantity: qty,
        size: size || '',
        color: color || '',
        price: product.price
      });
    }

    cart.updatedAt = Date.now();
    await cart.save();

    const populatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name mainImage price stock stockStatus');
    res.json({ success: true, data: populatedCart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/cart/:itemId - Update quantity
router.put('/:itemId', protect, async (req, res) => {
  try {
    const { quantity } = req.body;
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    const item = cart.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    const product = await Product.findById(item.product);
    const qty = parseInt(quantity) || 0;

    if (qty <= 0) {
      cart.items.pull(item._id);
    } else {
      if (product && qty > product.stock) {
        return res.status(400).json({ success: false, message: `Only ${product.stock} units available` });
      }
      item.quantity = qty;
    }

    await cart.save();
    const populatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name mainImage price stock stockStatus');
    res.json({ success: true, data: populatedCart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/cart/:itemId - Remove item
router.delete('/:itemId', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    cart.items = cart.items.filter(item => item._id.toString() !== req.params.itemId);
    await cart.save();

    const populatedCart = await Cart.findById(cart._id)
      .populate('items.product', 'name mainImage price stock stockStatus');
    res.json({ success: true, data: populatedCart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/cart - Clear entire cart
router.delete('/', protect, async (req, res) => {
  try {
    await Cart.findOneAndDelete({ user: req.user._id });
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;