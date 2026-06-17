const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const { protect, adminOnly } = require('../middleware/auth');
const { sendOrderConfirmation, sendOrderShipped, sendOrderDelivered, sendOrderCancelled, sendAdminNewOrder, sendAdminOrderStatus } = require('../utils/email');
const { emitOrderUpdate } = require('../utils/socket');

// ============================
// CREATE ORDER (with atomic stock)
// ============================
router.post('/', protect, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, shippingAddress, paymentMethod, couponCode, notes } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      let productId = item.productId || item.id || item._id;
      if (!productId) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: 'Missing product ID' });
      }
      if (typeof productId === 'object') productId = productId.toString();
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: 'Invalid product ID' });
      }

      const qty = parseInt(item.quantity) || 1;

      // ATOMIC stock decrement
      const product = await Product.findOneAndUpdate(
        { _id: productId, stock: { $gte: qty }, stockStatus: { $ne: 'out_of_stock' } },
        { $inc: { stock: -qty } },
        { session, new: true }
      );

      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: `Product not available or insufficient stock` });
      }
      if (product) {
        await product.save({ session });
      }

      const total = product.price * qty;
      subtotal += total;
      orderItems.push({
        product: product._id,
        name: product.name,
        size: item.size || '',
        color: item.color || '',
        quantity: qty,
        price: product.price,
        totalPrice: total
      });
    }

    let discount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() }).session(session);
      if (coupon && coupon.isValid() && subtotal >= coupon.minOrderAmount) {
        if (coupon.discountType === 'percentage') {
          discount = (subtotal * coupon.discountValue) / 100;
          if (coupon.maxDiscount && discount > coupon.maxDiscount) discount = coupon.maxDiscount;
        } else if (coupon.discountType === 'fixed') {
          discount = coupon.discountValue;
        }
        coupon.usageCount++;
        await coupon.save({ session });
        appliedCoupon = coupon.code;
      }
    }

    const shippingFee = subtotal > 999 ? 0 : 50;
    const platformFee = 0;
    const gst = 0;
    const totalAmount = subtotal + shippingFee + platformFee - discount;

    const [order] = await Order.create([{
      user: req.user._id,
      items: orderItems,
      subtotal,
      shippingFee,
      platformFee,
      gst,
      discount,
      totalAmount,
      couponCode: appliedCoupon,
      paymentMethod: paymentMethod || 'cod',
      shippingAddress: shippingAddress || { fullName: req.user.name, phone: req.user.phone || '', addressLine1: '', city: '', state: '', pincode: '' },
      notes: notes || '',
      estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    }], { session });

    await User.findByIdAndUpdate(req.user._id, { $inc: { loyaltyPoints: Math.floor(totalAmount / 20) } }, { session });

    await session.commitTransaction();
    session.endSession();

    // Send emails
    try {
      const user = await User.findById(req.user._id);
      if (user && user.email) {
        await sendOrderConfirmation(user.email, order);
        console.log('✅ Order confirmation email sent to customer');
      }
      await sendAdminNewOrder(order);
      console.log('✅ New order notification sent to admin');
    } catch (e) {
      console.error('❌ Order email failed:', e.message);
      // Don't fail the order if email fails
    }

    emitOrderUpdate(req.user._id, order);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Order error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/', protect, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { user: req.user._id, isDeleted: false };
    if (status) query.status = status;
    const skip = (Number(page) - 1) * Number(limit);
    const orders = await Order.find(query).populate('items.product', 'name mainImage').sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await Order.countDocuments(query);
    res.json({ success: true, count: orders.length, total, page: Number(page), pages: Math.ceil(total / Number(limit)), data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================
// PROFESSIONAL INVOICE PDF (FIXED)
// ============================
router.get('/admin/all', protect, adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const query = { isDeleted: false };
    if (status) query.status = status;
    const skip = (Number(page) - 1) * Number(limit);
    const orders = await Order.find(query).populate('user', 'name email').populate('items.product', 'name mainImage').sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await Order.countDocuments(query);
    res.json({ success: true, count: orders.length, total, page: Number(page), pages: Math.ceil(total / Number(limit)), data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/invoice', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product', 'name sku').populate('user', 'name email phone');
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });

    const orderUserId = order.user && order.user._id ? order.user._id.toString() : order.user.toString();
    const reqUserId = req.user._id ? req.user._id.toString() : req.user.id;
    if (orderUserId !== reqUserId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.orderNumber}.pdf`);
    doc.pipe(res);

    const primaryColor = '#6B3A1F';
    const goldColor = '#C9A961';
    const lightBg = '#FAF8F5';
    const textDark = '#2C2C2C';
    const textLight = '#666666';

    const drawLine = (y, color = '#E5E5E5') => {
      doc.moveTo(50, y).lineTo(545, y).strokeColor(color).lineWidth(1).stroke();
    };

    // ===== HEADER =====
    doc.rect(0, 0, 595, 120).fillColor(primaryColor).fill();
    doc.fillColor('#FFFFFF').fontSize(28).text('VELRIC LONDON', 50, 35);
    doc.fillColor(goldColor).fontSize(11).text('PREMIUM HANDCRAFTED LEATHER GOODS', 50, 68);
    doc.fillColor('#FFFFFF').fontSize(10).text('London, UK | support@velriclondon.com | GSTIN: 09AABCU9603R1ZX', 50, 88);

    // Invoice title box (using rect instead of roundedRect for compatibility)
    doc.rect(420, 30, 125, 55).fillColor('#FFFFFF').fill().strokeColor(goldColor).lineWidth(2).stroke();
    doc.fillColor(primaryColor).fontSize(16).text('TAX INVOICE', 435, 40);
    doc.fillColor(textDark).fontSize(9).text(`No: ${order.orderNumber}`, 435, 55);
    doc.fillColor(textLight).fontSize(9).text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 435, 70);

    // ===== SOLD BY / BILL TO / SHIP TO =====
    let y = 145;
    doc.fillColor(primaryColor).fontSize(11).text('SOLD BY:', 50, y);
    doc.fillColor(textDark).fontSize(10).text('Velric London Pvt. Ltd.', 50, y + 16);
    doc.fillColor(textLight).fontSize(9).text('Kanpur Nagar, Uttar Pradesh, 208010', 50, y + 30);
    doc.fillColor(textLight).fontSize(9).text('Email: velriclondon2004@gmail.com | Phone: +91-9653078168', 50, y + 44);
    doc.fillColor(textLight).fontSize(9).text('GSTIN: 09AABCU9603R1ZX | PAN: JTZPK5172E', 50, y + 44);

    doc.fillColor(primaryColor).fontSize(11).text('BILL TO:', 320, y);
    const custName = order.user.name || order.shippingAddress.fullName || 'Customer';
    doc.fillColor(textDark).fontSize(10).text(custName, 320, y + 16);
    doc.fillColor(textLight).fontSize(9).text(`${order.shippingAddress.city || ''}, ${order.shippingAddress.state || ''}, ${order.shippingAddress.pincode || ''}`, 320, y + 30);
    doc.fillColor(textLight).fontSize(9).text(`Phone: ${order.shippingAddress.phone || order.user.phone || 'N/A'}`, 320, y + 44);

    y = 215;
    doc.fillColor(primaryColor).fontSize(11).text('SHIP TO:', 50, y);
    doc.fillColor(textDark).fontSize(10).text(order.shippingAddress.fullName || custName, 50, y + 16);
    doc.fillColor(textLight).fontSize(9).text(`${order.shippingAddress.addressLine1 || ''}${order.shippingAddress.addressLine2 ? ', ' + order.shippingAddress.addressLine2 : ''}`, 50, y + 30);
    doc.fillColor(textLight).fontSize(9).text(`${order.shippingAddress.city || ''}, ${order.shippingAddress.state || ''}, ${order.shippingAddress.pincode || ''}`, 50, y + 44);
    doc.fillColor(textLight).fontSize(9).text(`Place of Supply: ${order.shippingAddress.state || 'N/A'}`, 50, y + 58);

    // Order summary box
    doc.rect(320, 215, 225, 70).fillColor(lightBg).fill().strokeColor('#E5E5E5').lineWidth(1).stroke();
    doc.fillColor(textDark).fontSize(9).text(`Order Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 335, 225);
    doc.fillColor(textDark).fontSize(9).text(`Payment: ${order.paymentMethod.toUpperCase()}`, 335, 240);
    doc.fillColor(textDark).fontSize(9).text(`Status: ${order.status.toUpperCase()}`, 335, 255);
    doc.fillColor(textDark).fontSize(9).text(`Delivery: ${order.estimatedDelivery ? new Date(order.estimatedDelivery).toLocaleDateString('en-IN') : '5-7 Days'}`, 335, 270);

    // ===== ITEMS TABLE =====
    y = 310;
    drawLine(y - 10, primaryColor);

    // Table header
    doc.fillColor('#FFFFFF').fontSize(10);
    doc.rect(50, y - 10, 495, 28).fillColor(primaryColor).fill();
    doc.text('S.N.', 55, y - 2, { width: 30, align: 'center' });
    doc.text('DESCRIPTION', 95, y - 2, { width: 180, align: 'left' });
    doc.text('HSN', 285, y - 2, { width: 50, align: 'center' });
    doc.text('UNIT', 345, y - 2, { width: 50, align: 'right' });
    doc.text('QTY', 400, y - 2, { width: 40, align: 'center' });
    doc.text('DISCOUNT', 445, y - 2, { width: 50, align: 'right' });
    doc.text('TOTAL', 500, y - 2, { width: 45, align: 'right' });

    y += 28;
    doc.fillColor(textDark).fontSize(9);

    order.items.forEach((item, idx) => {
      const rowY = y + (idx * 28);
      if (idx % 2 === 1) {
        doc.rect(50, rowY - 2, 495, 28).fillColor(lightBg).fill();
      }
      doc.fillColor(textDark).fontSize(9);
      doc.text((idx + 1).toString(), 55, rowY + 4, { width: 30, align: 'center' });
      doc.text(item.name, 95, rowY + 4, { width: 180, align: 'left' });
      doc.text('4203', 285, rowY + 4, { width: 50, align: 'center' });
      doc.text(`Rs.${item.price}`, 345, rowY + 4, { width: 50, align: 'right' });
      doc.text(item.quantity.toString(), 400, rowY + 4, { width: 40, align: 'center' });
      doc.text('Rs.0', 445, rowY + 4, { width: 50, align: 'right' });
      doc.text(`Rs.${item.totalPrice}`, 500, rowY + 4, { width: 45, align: 'right' });

      if (item.size || item.color) {
        doc.fillColor(textLight).fontSize(8).text(`${item.size ? 'Size: ' + item.size : ''} ${item.color ? 'Color: ' + item.color : ''}`, 95, rowY + 16, { width: 180 });
      }
    });

    y = y + (order.items.length * 28) + 15;
    drawLine(y, primaryColor);
    y += 15;

    // ===== TOTALS SECTION =====
    const totalsX = 360;

    doc.fillColor(textDark).fontSize(10).text('Subtotal', totalsX, y, { width: 90, align: 'left' });
    doc.fillColor(textDark).fontSize(10).text(`Rs.${order.subtotal}`, totalsX + 95, y, { width: 90, align: 'right' });

    y += 18;
    doc.fillColor(textDark).fontSize(10).text('Shipping', totalsX, y, { width: 90, align: 'left' });
    doc.fillColor(textDark).fontSize(10).text(order.shippingFee === 0 ? 'FREE' : `Rs.${order.shippingFee}`, totalsX + 95, y, { width: 90, align: 'right' });

    y += 18;
    

    if (order.discount > 0) {
      y += 18;
      doc.fillColor('#C0392B').fontSize(10).text('Discount', totalsX, y, { width: 90, align: 'left' });
      doc.fillColor('#C0392B').fontSize(10).text(`-Rs.${order.discount}`, totalsX + 95, y, { width: 90, align: 'right' });
    }

    y += 22;
    drawLine(y, goldColor);
    y += 10;

    doc.fillColor(primaryColor).fontSize(14).text('GRAND TOTAL', totalsX, y, { width: 90, align: 'left' });
    doc.fillColor(primaryColor).fontSize(14).text(`Rs.${order.totalAmount}`, totalsX + 95, y, { width: 90, align: 'right' });

    y += 25;
    doc.fillColor(textLight).fontSize(9).text(`Amount in words: ${numberToWords(order.totalAmount)} Rupees Only`, 50, y, { width: 300 });

    // ===== TERMS & FOOTER =====
    y += 40;
    drawLine(y, '#E5E5E5');
    y += 15;

    doc.fillColor(primaryColor).fontSize(10).text('TERMS & CONDITIONS', 50, y);
    y += 18;
    doc.fillColor(textLight).fontSize(8);
    doc.text('1. Delivery will be provided to the ship-to address specified above.', 50, y, { width: 495 });
    y += 14;
    doc.text('2. Free shipping on all orders above Rs.999. Standard delivery: 5-7 business days.', 50, y, { width: 495 });
    y += 14;
    doc.text('3. In case of returns, items must be unused and in original packaging. Return window: 7 days.', 50, y, { width: 495 });
    y += 14;
    doc.text('4. For support, email velriclondon2004@gmail.com or call +91-9653078168.', 50, y, { width: 495 });

    y += 30;
    doc.fillColor(textLight).fontSize(8).text('This is a computer-generated invoice and does not require a signature.', 50, y, { width: 495, align: 'center' });
    y += 14;
    doc.fillColor(primaryColor).fontSize(9).text('Thank you for shopping with Velric London!', 50, y, { width: 495, align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Invoice error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate invoice: ' + error.message });
    }
  }
});

// Number to words helper
function numberToWords(num) {
  num = Math.round(num);
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  if (num === 0) return 'Zero';
  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? ' ' + ones[num%10] : '');
  if (num < 1000) return ones[Math.floor(num/100)] + ' Hundred' + (num%100 ? ' and ' + numberToWords(num%100) : '');
  if (num < 100000) return numberToWords(Math.floor(num/1000)) + ' Thousand' + (num%1000 ? ' ' + numberToWords(num%1000) : '');
  return numberToWords(Math.floor(num/100000)) + ' Lakh' + (num%100000 ? ' ' + numberToWords(num%100000) : '');
}

router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product');
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    const orderUserId = order.user?._id?.toString() || order.user?.toString();
    const reqUserId = req.user?._id?.toString() || req.user.id;
    if (orderUserId !== reqUserId && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Not authorized' });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status, trackingId } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });

    order.status = status;
    if (trackingId) order.trackingId = trackingId;
    if (status === 'delivered') {
      order.actualDelivery = new Date();
      order.paymentStatus = 'paid';
    }
    await order.save();

    // Send emails (single clean block)
    try {
      const user = await User.findById(order.user);
      if (user && user.email) {
        if (status === 'shipped') {
          await sendOrderShipped(user.email, order);
          console.log('✅ Shipped email sent to customer');
        } else if (status === 'delivered') {
          await sendOrderDelivered(user.email, order);
          console.log('✅ Delivered email sent to customer');
        } else if (status === 'cancelled') {
          await sendOrderCancelled(user.email, order);
          console.log('✅ Cancelled email sent to customer');
        }
      }
      await sendAdminOrderStatus(order, status.toUpperCase());
      console.log('✅ Admin status email sent');
    } catch (e) {
      console.error('❌ Status email failed:', e.message);
    }

    const userId = order.user?._id?.toString() || order.user?.toString();
    emitOrderUpdate(userId, order);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/cancel', protect, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findById(req.params.id).session(session);
    if (!order) {
      await session.abortTransaction(); session.endSession();
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    if (order.user.toString() !== req.user._id.toString()) {
      await session.abortTransaction(); session.endSession();
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (['delivered', 'cancelled', 'shipped', 'out_for_delivery'].includes(order.status)) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: 'Cannot cancel at this stage' });
    }

    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } }, { session });
    }

    order.status = 'cancelled';
    await order.save({ session });
    await session.commitTransaction();
    session.endSession();

    const userId = order.user?._id?.toString() || order.user?.toString();
    emitOrderUpdate(userId, order);
    res.json({ success: true, data: order });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/rate', protect, async (req, res) => {
  try {
    const { score, review } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    if (order.user.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (order.status !== 'delivered') return res.status(400).json({ success: false, message: 'Can only rate delivered orders' });

    order.rating = { score, review, createdAt: new Date() };
    await order.save();
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});



module.exports = router;