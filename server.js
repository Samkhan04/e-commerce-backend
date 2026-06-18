const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors'); // 🔥 CORS package import karo
const morgan = require('morgan');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');
const hpp = require('hpp');
const compression = require('compression');

dotenv.config({ path: path.join(__dirname, '.env') });

// ============================
// ENV VALIDATION (CRITICAL)
// ============================
const requiredEnv = ['JWT_SECRET', 'MONGODB_URI'];
const missing = requiredEnv.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`FATAL: Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const connectDB = require('./config/db');
let dbConnected = false;
connectDB().then(connected => { dbConnected = connected; });

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const brandRoutes = require('./routes/brands');
const couponRoutes = require('./routes/coupons');
const userRoutes = require('./routes/users');
const cartRoutes = require('./routes/cart');
const otpRoutes = require('./routes/otp');
const returnRoutes = require('./routes/returns');
const analyticsRoutes = require('./routes/analytics');
const trackVisitor = require('./middleware/visitor');

let paymentRoutes;
try {
  paymentRoutes = require('./routes/payment');
} catch (e) {
  console.log('Payment routes not found, skipping Razorpay');
  paymentRoutes = express.Router();
  paymentRoutes.all('*', (req, res) => res.status(503).json({ success: false, message: 'Payment module not configured' }));
}

const app = express();

// ============================
// CORS - ABSOLUTE FIRST (FIXED)
// ============================
// 🔥 CORS sabse pehle hona chahiye, koi bhi middleware usse pehle nahi
// ============================
// CORS — FIXED FOR ALL NETLIFY URLS
// ============================

const allowedOrigins = [
  'https://velric-london.netlify.app',
  'https://*.netlify.app',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Allow all Netlify deploy previews + main URL
  let allowOrigin = false;
  if (!origin) {
    allowOrigin = true;
  } else if (allowedOrigins.includes(origin)) {
    allowOrigin = true;
  } else if (origin.includes('netlify.app') || origin.includes('render.com')) {
    allowOrigin = true;
  }
  
  if (origin && allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// ============================
// GLOBAL MIDDLEWARE
// ============================
app.use(compression());
app.set('trust proxy', 1);

// ============================
// SECURITY MIDDLEWARE
// ============================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https://placehold.co", "https://res.cloudinary.com", "https://images.unsplash.com", "blob:"],
      connectSrc: ["'self'", "https://api.razorpay.com", "https://velric-london-api.onrender.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// HTTPS Redirect in Production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, 'https://' + req.headers.host + req.url);
    }
    next();
  });
}

// ❌ YEH PURANA CUSTOM CORS HATA DO - ab cors() package handle karega
// app.use((req, res, next) => { ... });
// ❌ YEH BHI HATA DO
// app.use(cors({ origin: true, credentials: true, ... }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/otp/send-otp', authLimiter);

// Body parsing & sanitization
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(mongoSanitize());
app.use(hpp());

if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Visitor tracking
app.use(trackVisitor);

// DB Check
const dbCheck = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Database not connected. Please check MongoDB configuration.'
    });
  }
  next();
};

// ============================
// ROUTES
// ============================
app.use('/api/auth', dbCheck, authRoutes);
app.use('/api/products', dbCheck, productRoutes);
app.use('/api/orders', dbCheck, orderRoutes);
app.use('/api/brands', dbCheck, brandRoutes);
app.use('/api/coupons', dbCheck, couponRoutes);
app.use('/api/payment', dbCheck, paymentRoutes);
app.use('/api/users', dbCheck, userRoutes);
app.use('/api/cart', dbCheck, cartRoutes);
app.use('/api/otp', dbCheck, otpRoutes);
app.use('/api/returns', dbCheck, returnRoutes);
app.use('/api/analytics', dbCheck, analyticsRoutes);

// ============================
// CONTACT FORM & NEWSLETTER
// ============================
const { sendEmail } = require('./utils/email');

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Please fill all required fields' });
    }

    await sendEmail({
      to: process.env.ADMIN_EMAIL || 'velriclondon2004@gmail.com',
      subject: `Contact Form: ${subject || 'New Message'}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
          <div style="background:#6B3A1F;color:#fff;padding:20px;text-align:center;">
            <h2 style="margin:0;">Velric London - Contact Form</h2>
          </div>
          <div style="padding:30px;">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject || 'N/A'}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
            <p><strong>Message:</strong></p>
            <p style="white-space:pre-wrap;">${message}</p>
          </div>
        </div>
      `
    });

    res.json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Contact email error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message. Please try again.' });
  }
});

app.post('/api/newsletter', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email required' });
    }

    await sendEmail({
      to: process.env.ADMIN_EMAIL || 'velriclondon2004@gmail.com',
      subject: 'New Newsletter Subscription',
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px;">
          <h2 style="color:#6B3A1F;">New Newsletter Subscriber</h2>
          <p><strong>Email:</strong> ${email}</p>
          <p>Subscribed on: ${new Date().toLocaleString()}</p>
        </div>
      `
    });

    await sendEmail({
      to: email,
      subject: 'Welcome to Velric London Newsletter!',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
          <div style="background:#6B3A1F;color:#fff;padding:20px;text-align:center;">
            <h2 style="margin:0;">Velric London</h2>
          </div>
          <div style="padding:30px;">
            <h3>Welcome to the Family!</h3>
            <p>Thank you for subscribing to our newsletter.</p>
          </div>
        </div>
      `
    });

    res.json({ success: true, message: 'Subscribed successfully!' });
  } catch (error) {
    console.error('Newsletter error:', error);
    res.status(500).json({ success: false, message: 'Subscription failed' });
  }
});

// ============================
// HEALTH & ROOT
// ============================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Velric London API v2.1',
    dbConnected: dbConnected,
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Velric London API is running',
    status: 'OK',
    endpoints: '/api/health, /api/auth, /api/products, /api/orders, etc.'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('ERROR:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method
  });
  
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Something went wrong. Please try again later.'
    : (err.message || 'Internal Server Error');
    
  res.status(status).json({ 
    success: false, 
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================
// SERVER START (HTTP + HTTPS)
// ============================
const PORT = process.env.PORT || 5000;

// HTTP Server (always start)
const server = http.createServer(app);
server.timeout = 30000;
server.listen(PORT, () => {
  console.log(`🚀 Velric London HTTP server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`🌐 CORS enabled for all origins`);
});

// HTTPS Server (only if SSL certificates exist)
const sslKeyPath = process.env.SSL_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH;

if (sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
  try {
    const httpsOptions = {
      key: fs.readFileSync(sslKeyPath),
      cert: fs.readFileSync(sslCertPath),
    };
    const sslCaPath = process.env.SSL_CA_PATH;
    if (sslCaPath && fs.existsSync(sslCaPath)) {
      httpsOptions.ca = fs.readFileSync(sslCaPath);
    }

    const httpsServer = https.createServer(httpsOptions, app);
    httpsServer.listen(process.env.HTTPS_PORT || 5443, () => {
      console.log(`🔒 Velric London HTTPS server running on port ${process.env.HTTPS_PORT || 5443}`);
    });
  } catch (err) {
    console.error('❌ Failed to start HTTPS server:', err.message);
  }
} else {
  console.log('ℹ️  HTTPS not configured. Using HTTP only (Render provides SSL termination)');
}

const { init } = require('./utils/socket');
init(server);

module.exports = server;