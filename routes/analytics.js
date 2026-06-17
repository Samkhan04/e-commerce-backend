const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Visitor = require('../models/Visitor');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const todayVisitors = await Visitor.countDocuments({ date: today });
    const totalVisitors = await Visitor.countDocuments();
    const weekVisitors = await Visitor.countDocuments({ date: { $gte: weekAgo.toISOString().split('T')[0] } });

    const totalOrders = await Order.countDocuments({ isDeleted: false });
    const todayOrders = await Order.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd }, isDeleted: false });
    const pendingOrders = await Order.countDocuments({ status: 'pending', isDeleted: false });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered', isDeleted: false });

    const revenueAgg = await Order.aggregate([
      { $match: { status: { $nin: ['cancelled', 'returned'] }, isDeleted: false } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueAgg[0]?.total || 0;

    const todayRevenueAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: todayStart, $lte: todayEnd }, status: { $nin: ['cancelled', 'returned'] }, isDeleted: false } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const todayRevenue = todayRevenueAgg[0]?.total || 0;

    const bestsellers = await Order.aggregate([
      { $match: { status: { $nin: ['cancelled', 'returned'] } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.product', name: { $first: '$items.name' }, totalSold: { $sum: '$items.quantity' }, revenue: { $sum: '$items.totalPrice' } } },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    const abandonedCarts = await Cart.countDocuments({ 'items.0': { $exists: true } });
    const abandonedValue = await Cart.aggregate([
      { $match: { 'items.0': { $exists: true } } },
      { $unwind: '$items' },
      { $group: { _id: null, total: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } }
    ]);

    const conversionRate = totalVisitors > 0 ? ((totalOrders / totalVisitors) * 100).toFixed(2) : 0;
    const cartConversion = totalVisitors > 0 ? ((abandonedCarts / totalVisitors) * 100).toFixed(2) : 0;

    const trafficSources = await Visitor.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]);

    const lowStock = await Product.find({ stock: { $lte: 5, $gt: 0 }, isAvailable: true }).select('name stock sku category').sort({ stock: 1 }).limit(15);
    const outOfStock = await Product.find({ stock: 0, isAvailable: true }).select('name stock sku category').limit(15);

    const categorySales = await Order.aggregate([
      { $match: { status: { $nin: ['cancelled', 'returned'] } } },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'prod' } },
      { $unwind: '$prod' },
      { $group: { _id: '$prod.category', revenue: { $sum: '$items.totalPrice' }, count: { $sum: '$items.quantity' } } },
      { $sort: { revenue: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        visitors: { today: todayVisitors, total: totalVisitors, week: weekVisitors },
        orders: { total: totalOrders, today: todayOrders, pending: pendingOrders, delivered: deliveredOrders },
        revenue: { total: totalRevenue, today: todayRevenue },
        bestsellers,
        abandoned: { carts: abandonedCarts, value: abandonedValue[0]?.total || 0, rate: cartConversion },
        conversionRate,
        trafficSources,
        inventory: { lowStock, outOfStock },
        categorySales
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/visitors', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const count = await Visitor.countDocuments({ date: today });
    res.json({ success: true, data: { todayVisitors: count } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;