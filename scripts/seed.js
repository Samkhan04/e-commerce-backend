const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const Brand = require('../models/Brand');
const Product = require('../models/Product');
const User = require('../models/User');
const Coupon = require('../models/Coupon');

const seed = async () => {
  try {
    await connectDB();
    const existingUsers = await User.countDocuments();
    if (existingUsers === 0) {
      await User.create([
        { name: 'Admin', email: 'admin@velriclondon.com', password: 'admin123', role: 'admin', phone: '+91-9999999999' },
        { name: 'Haris', email: 'haris@velric.com', password: 'password123', phone: '+91-9876543210' }
      ]);
      console.log('Users seeded: admin@velriclondon.com / admin123 | haris@velric.com / password123');
    } else {
      console.log('Users already exist, skipping...');
    }
    const existingBrands = await Brand.countDocuments();
    if (existingBrands === 0) {
      await Brand.insertMany([
        { name: 'Velric London', description: 'Premium handcrafted leather goods from London', origin: 'London, UK', established: 2018 },
        { name: 'Heritage Leather', description: 'Traditional Indian leather craftsmanship', origin: 'India', established: 1995 }
      ]);
      console.log('Brands seeded');
    } else {
      console.log('Brands already exist, skipping...');
    }
    const existingProducts = await Product.countDocuments();
    if (existingProducts === 0) {
      await Product.insertMany([
        // ===== MEN =====
        { name: 'Classic Brown Leather Belt', description: 'Full-grain leather belt with antique brass buckle. Perfect for formal and casual wear.', price: 1299, comparePrice: 1999, category: 'belts', brand: 'Velric London', sku: 'VL-M-BLT-001', sizes: ['28','30','32','34','36','38','40'], colors: [{ name: 'Brown', hex: '#8B4513' }, { name: 'Black', hex: '#000000' }], material: 'Full-Grain Leather', stock: 25, weight: 0.3, isBestseller: true, tags: ['men', 'bestseller', 'formal', 'gift'] },
        { name: 'Vintage Bomber Leather Jacket', description: 'Genuine lambskin leather jacket with quilted lining. Rugged style for the modern man.', price: 4999, comparePrice: 7999, category: 'jackets', brand: 'Velric London', sku: 'VL-M-JKT-001', sizes: ['S','M','L','XL','XXL'], colors: [{ name: 'Black', hex: '#000000' }, { name: 'Tan', hex: '#D2B48C' }], material: 'Lambskin Leather', stock: 12, weight: 1.2, isTrending: true, tags: ['men', 'winter', 'premium'] },
        { name: 'Oxford Formal Leather Shoes', description: 'Hand-stitched oxford shoes with leather sole. Boardroom to wedding ready.', price: 3499, comparePrice: 5499, category: 'shoes', brand: 'Velric London', sku: 'VL-M-SHO-001', sizes: ['6','7','8','9','10','11'], colors: [{ name: 'Black', hex: '#000000' }, { name: 'Brown', hex: '#8B4513' }], material: 'Calf Leather', stock: 18, weight: 0.8, isNewArrival: true, tags: ['men', 'formal', 'office'] },
        { name: 'Slim Leather Wallet', description: 'Minimalist bi-fold wallet with 6 card slots and RFID protection.', price: 899, comparePrice: 1299, category: 'wallets', brand: 'Velric London', sku: 'VL-M-WLT-001', sizes: ['One Size'], colors: [{ name: 'Black', hex: '#000000' }, { name: 'Brown', hex: '#8B4513' }], material: 'Top-Grain Leather', stock: 35, weight: 0.1, isBestseller: true, tags: ['men', 'accessory', 'gift'] },
        { name: 'Men Leather Duffle Bag', description: 'Spacious travel duffle with leather handles and shoulder strap. Weekend trips made stylish.', price: 3999, comparePrice: 5999, category: 'purses', brand: 'Velric London', sku: 'VL-M-BAG-001', sizes: ['Medium'], colors: [{ name: 'Tan', hex: '#D2B48C' }, { name: 'Black', hex: '#000000' }], material: 'Buffalo Leather', stock: 15, weight: 1.5, isTrending: true, tags: ['men', 'travel', 'duffle'] },
        { name: 'Leather Watch Strap 22mm', description: 'Quick-release leather watch strap compatible with all 22mm watches.', price: 599, comparePrice: 899, category: 'accessories', brand: 'Velric London', sku: 'VL-M-ACC-001', sizes: ['22mm'], colors: [{ name: 'Brown', hex: '#8B4513' }, { name: 'Black', hex: '#000000' }], material: 'Calf Leather', stock: 45, weight: 0.05, tags: ['men', 'watch', 'accessory'] },
        { name: 'Mens Leather Sandals', description: 'Handcrafted leather sandals with cushioned footbed and anti-slip sole.', price: 1299, comparePrice: 1899, category: 'sandals', brand: 'Heritage Leather', sku: 'HL-M-SND-001', sizes: ['6','7','8','9','10','11'], colors: [{ name: 'Brown', hex: '#8B4513' }], material: 'Buffalo Leather', stock: 22, weight: 0.5, tags: ['men', 'casual', 'summer'] },
        { name: 'Mens Leather Bracelet', description: 'Braided genuine leather bracelet with stainless steel clasp.', price: 499, comparePrice: 799, category: 'accessories', brand: 'Velric London', sku: 'VL-M-BRC-001', sizes: ['One Size'], colors: [{ name: 'Brown', hex: '#8B4513' }, { name: 'Black', hex: '#000000' }], material: 'Genuine Leather', stock: 40, weight: 0.05, tags: ['men', 'fashion', 'jewelry'] },

        // ===== WOMEN =====
        { name: 'Elegant Women Leather Purse', description: 'Elegant shoulder purse with multiple compartments and gold-tone hardware.', price: 2199, comparePrice: 3499, category: 'purses', brand: 'Velric London', sku: 'VL-W-PRS-001', sizes: ['Medium'], colors: [{ name: 'Red', hex: '#DC143C' }, { name: 'Black', hex: '#000000' }, { name: 'Tan', hex: '#D2B48C' }], material: 'Genuine Leather', stock: 30, weight: 0.4, isTrending: true, tags: ['women', 'fashion', 'gift'] },
        { name: 'Women Leather Tote Bag', description: 'Spacious everyday tote with laptop compartment and inner pockets.', price: 2899, comparePrice: 4499, category: 'purses', brand: 'Velric London', sku: 'VL-W-TOT-001', sizes: ['Large'], colors: [{ name: 'Black', hex: '#000000' }, { name: 'Beige', hex: '#F5F5DC' }, { name: 'Maroon', hex: '#800000' }], material: 'Full-Grain Leather', stock: 20, weight: 0.7, isNewArrival: true, tags: ['women', 'office', 'tote'] },
        { name: 'Women Leather Clutch', description: 'Sleek evening clutch with detachable chain strap. Party essential.', price: 1599, comparePrice: 2499, category: 'purses', brand: 'Velric London', sku: 'VL-W-CLU-001', sizes: ['One Size'], colors: [{ name: 'Gold', hex: '#FFD700' }, { name: 'Black', hex: '#000000' }, { name: 'Rose', hex: '#FF007F' }], material: 'Lambskin Leather', stock: 25, weight: 0.2, isTrending: true, tags: ['women', 'party', 'clutch'] },
        { name: 'Women Leather Sandals', description: 'Stylish flat sandals with floral cutwork and cushioned sole.', price: 1199, comparePrice: 1799, category: 'sandals', brand: 'Heritage Leather', sku: 'HL-W-SND-001', sizes: ['5','6','7','8','9'], colors: [{ name: 'Tan', hex: '#D2B48C' }, { name: 'Black', hex: '#000000' }], material: 'Sheep Leather', stock: 28, weight: 0.3, tags: ['women', 'casual', 'summer'] },
        { name: 'Women Leather Slippers', description: 'Soft sheep leather home slippers with fur lining. Ultimate comfort.', price: 799, comparePrice: 1199, category: 'slippers', brand: 'Heritage Leather', sku: 'HL-W-SLP-001', sizes: ['S','M','L'], colors: [{ name: 'Pink', hex: '#FFC0CB' }, { name: 'Cream', hex: '#FFFDD0' }], material: 'Sheep Leather', stock: 35, weight: 0.2, tags: ['women', 'home', 'comfort'] },
        { name: 'Women Leather Belt', description: 'Slim fashion belt with antique buckle. Perfect for dresses and jeans.', price: 799, comparePrice: 1299, category: 'belts', brand: 'Velric London', sku: 'VL-W-BLT-001', sizes: ['28','30','32','34'], colors: [{ name: 'Brown', hex: '#8B4513' }, { name: 'Black', hex: '#000000' }, { name: 'Red', hex: '#DC143C' }], material: 'Top-Grain Leather', stock: 30, weight: 0.2, tags: ['women', 'fashion', 'belt'] },
        { name: 'Women Leather Wallet', description: 'Compact tri-fold wallet with coin pocket and card slots.', price: 699, comparePrice: 999, category: 'wallets', brand: 'Velric London', sku: 'VL-W-WLT-001', sizes: ['One Size'], colors: [{ name: 'Red', hex: '#DC143C' }, { name: 'Black', hex: '#000000' }, { name: 'Tan', hex: '#D2B48C' }], material: 'Genuine Leather', stock: 32, weight: 0.1, tags: ['women', 'accessory', 'gift'] },
        { name: 'Women Leather Jacket', description: 'Cropped leather jacket with zipper details. Bold and beautiful.', price: 4499, comparePrice: 6999, category: 'jackets', brand: 'Velric London', sku: 'VL-W-JKT-001', sizes: ['XS','S','M','L'], colors: [{ name: 'Black', hex: '#000000' }, { name: 'Maroon', hex: '#800000' }], material: 'Lambskin Leather', stock: 14, weight: 1.0, isNewArrival: true, tags: ['women', 'winter', 'fashion'] },

        // ===== KIDS =====
        { name: 'Kids Leather Belt', description: 'Adjustable leather belt for boys and girls. Durable and safe.', price: 499, comparePrice: 799, category: 'belts', brand: 'Velric London', sku: 'VL-K-BLT-001', sizes: ['22','24','26','28'], colors: [{ name: 'Brown', hex: '#8B4513' }, { name: 'Black', hex: '#000000' }, { name: 'Blue', hex: '#0000FF' }], material: 'Top-Grain Leather', stock: 40, weight: 0.15, tags: ['kids', 'school', 'belt'] },
        { name: 'Kids Leather Shoes', description: 'School formal shoes with soft leather upper and padded insole.', price: 1499, comparePrice: 2299, category: 'shoes', brand: 'Velric London', sku: 'VL-K-SHO-001', sizes: ['1','2','3','4','5','6'], colors: [{ name: 'Black', hex: '#000000' }, { name: 'Brown', hex: '#8B4513' }], material: 'Calf Leather', stock: 30, weight: 0.4, tags: ['kids', 'school', 'formal'] },
        { name: 'Kids Leather Sandals', description: 'Comfortable open-toe sandals with Velcro strap for easy wear.', price: 699, comparePrice: 1099, category: 'sandals', brand: 'Heritage Leather', sku: 'HL-K-SND-001', sizes: ['7C','8C','9C','10C','11C','12C'], colors: [{ name: 'Brown', hex: '#8B4513' }, { name: 'Tan', hex: '#D2B48C' }], material: 'Buffalo Leather', stock: 35, weight: 0.3, tags: ['kids', 'casual', 'summer'] },
        { name: 'Kids Mini Wallet', description: 'Cute pocket wallet for kids to carry pocket money safely.', price: 399, comparePrice: 599, category: 'wallets', brand: 'Velric London', sku: 'VL-K-WLT-001', sizes: ['One Size'], colors: [{ name: 'Red', hex: '#DC143C' }, { name: 'Blue', hex: '#0000FF' }, { name: 'Green', hex: '#008000' }], material: 'Genuine Leather', stock: 50, weight: 0.05, tags: ['kids', 'accessory', 'gift'] },
        { name: 'Kids Leather Bag', description: 'Small backpack with leather flap and adjustable straps. School ready.', price: 1899, comparePrice: 2799, category: 'purses', brand: 'Velric London', sku: 'VL-K-BAG-001', sizes: ['Small'], colors: [{ name: 'Brown', hex: '#8B4513' }, { name: 'Tan', hex: '#D2B48C' }], material: 'Buffalo Leather', stock: 20, weight: 0.6, tags: ['kids', 'school', 'bag'] },
        { name: 'Kids Leather Bracelet', description: 'Colorful braided leather band with fun charm. Adjustable fit.', price: 299, comparePrice: 499, category: 'accessories', brand: 'Velric London', sku: 'VL-K-BRC-001', sizes: ['One Size'], colors: [{ name: 'Multi', hex: '#FF6347' }, { name: 'Blue', hex: '#0000FF' }], material: 'Genuine Leather', stock: 45, weight: 0.03, tags: ['kids', 'fashion', 'jewelry'] },

        // ===== UNISEX / GENERAL =====
        { name: 'Comfort Leather Sandals', description: 'Handcrafted leather sandals with cushioned footbed.', price: 999, comparePrice: 1499, category: 'sandals', brand: 'Heritage Leather', sku: 'HL-SND-001', sizes: ['6','7','8','9','10'], colors: [{ name: 'Brown', hex: '#8B4513' }], material: 'Buffalo Leather', stock: 40, weight: 0.5, tags: ['unisex', 'casual', 'summer'] },
        { name: 'Premium Home Slippers', description: 'Soft sheep leather slippers for indoor comfort.', price: 699, comparePrice: 999, category: 'slippers', brand: 'Heritage Leather', sku: 'HL-SLP-001', sizes: ['S','M','L','XL'], colors: [{ name: 'Tan', hex: '#D2B48C' }, { name: 'Brown', hex: '#8B4513' }], material: 'Sheep Leather', stock: 50, weight: 0.3, tags: ['unisex', 'home', 'comfort'] },
        { name: 'Leather Watch Strap 20mm', description: 'Quick-release leather watch strap compatible with 20mm watches.', price: 599, comparePrice: 899, category: 'accessories', brand: 'Velric London', sku: 'VL-ACC-001', sizes: ['20mm'], colors: [{ name: 'Brown', hex: '#8B4513' }, { name: 'Black', hex: '#000000' }], material: 'Calf Leather', stock: 45, weight: 0.05, tags: ['unisex', 'watch', 'accessory'] },
        { name: 'Leather Passport Holder', description: 'Slim passport cover with card slots and boarding pass pocket.', price: 899, comparePrice: 1399, category: 'accessories', brand: 'Velric London', sku: 'VL-ACC-002', sizes: ['One Size'], colors: [{ name: 'Brown', hex: '#8B4513' }, { name: 'Black', hex: '#000000' }, { name: 'Tan', hex: '#D2B48C' }], material: 'Full-Grain Leather', stock: 28, weight: 0.1, isNewArrival: true, tags: ['unisex', 'travel', 'gift'] },
        { name: 'Leather Keychain', description: 'Handcrafted leather keychain with brass ring.', price: 299, comparePrice: 499, category: 'accessories', brand: 'Velric London', sku: 'VL-ACC-003', sizes: ['One Size'], colors: [{ name: 'Brown', hex: '#8B4513' }, { name: 'Black', hex: '#000000' }], material: 'Genuine Leather', stock: 60, weight: 0.03, tags: ['unisex', 'gift', 'daily'] }
      ]);
      console.log('Products seeded (Men, Women, Kids + Unisex)');
    } else {
      console.log('Products already exist, skipping...');
    }
    const existingCoupons = await Coupon.countDocuments();
    if (existingCoupons === 0) {
      await Coupon.insertMany([
        { code: 'WELCOME20', description: '20% off on first order', discountType: 'percentage', discountValue: 20, minOrderAmount: 0, maxDiscount: 500, validFrom: new Date(), validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), usageLimit: 1000, applicableCategories: ['all'] },
        { code: 'LEATHER50', description: 'Flat Rs.50 off', discountType: 'fixed', discountValue: 50, minOrderAmount: 499, validFrom: new Date(), validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), usageLimit: 500, applicableCategories: ['all'] },
        { code: 'FREESHIP', description: 'Free shipping on all orders', discountType: 'free_delivery', discountValue: 50, minOrderAmount: 0, validFrom: new Date(), validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), usageLimit: 300, applicableCategories: ['all'] },
        { code: 'MEN10', description: '10% off on all Men products', discountType: 'percentage', discountValue: 10, minOrderAmount: 999, maxDiscount: 300, validFrom: new Date(), validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), usageLimit: 200, applicableCategories: ['all'] },
        { code: 'WOMEN15', description: '15% off on Women collection', discountType: 'percentage', discountValue: 15, minOrderAmount: 1499, maxDiscount: 500, validFrom: new Date(), validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), usageLimit: 200, applicableCategories: ['all'] }
      ]);
      console.log('Coupons seeded');
    } else {
      console.log('Coupons already exist, skipping...');
    }
    console.log('\nSeed complete!');
    console.log('Admin: admin@velriclondon.com / admin123');
    console.log('User:  haris@velric.com / password123');
    process.exit();
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
};

seed();