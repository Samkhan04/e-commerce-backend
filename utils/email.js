const nodemailer = require('nodemailer');

// ============================
// BULLETPROOF EMAIL SYSTEM
// ============================

const getTransporter = () => {
  const user = process.env.SMTP_EMAIL || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.warn('⚠️ SMTP credentials missing. Set SMTP_EMAIL + SMTP_PASSWORD in .env');
    return null;
  }

  // Use service:'gmail' for Gmail (handles host/port/auth automatically)
  // Or custom SMTP for other providers
  const isGmail = (process.env.SMTP_HOST || '').includes('gmail') || user.includes('@gmail.com');

  const config = isGmail ? {
    service: 'gmail',
    auth: { user: String(user).trim(), pass: String(pass).trim() },
    tls: { rejectUnauthorized: false }
  } : {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: String(user).trim(), pass: String(pass).trim() },
    tls: { rejectUnauthorized: false }
  };

  return nodemailer.createTransport(config);
};

const sendEmail = async (options) => {
  const transporter = getTransporter();

  if (!transporter) {
    console.warn('📧 Email skipped (SMTP not configured):', options.subject, '→', options.to);
    return { messageId: 'preview-' + Date.now(), preview: true };
  }

  const fromName = process.env.FROM_NAME || 'Velric London';
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_EMAIL || process.env.EMAIL_USER;

  const message = {
    from: `${fromName} <${fromEmail}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  };

  try {
    const info = await transporter.sendMail(message);
    console.log(`✅ Email sent to ${options.to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Email failed to ${options.to}:`, error.message);
    // Return mock so order flow doesn't break
    return { messageId: 'failed-' + Date.now(), preview: true, error: error.message };
  }
};

// ============================
// ORDER EMAILS
// ============================

const sendOrderConfirmation = async (userEmail, order) => {
  const itemsHtml = order.items.map(item =>
    `<tr style="border-bottom:1px solid #e5e5e5;">
      <td style="padding:12px;font-family:Arial,sans-serif;font-size:14px;color:#333;">${item.name}</td>
      <td style="padding:12px;text-align:center;">${item.quantity}</td>
      <td style="padding:12px;text-align:right;">Rs.${item.totalPrice}</td>
    </tr>`
  ).join('');

  const html = `
    <div style="max-width:700px;margin:0 auto;font-family:Arial,sans-serif;border:1px solid #d4af37;border-radius:8px;overflow:hidden;background:#fff;">
      <div style="background:linear-gradient(135deg,#6B3A1F 0%,#8B5A2B 100%);padding:30px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:28px;">VELRIC LONDON</h1>
        <p style="color:#f5e6d3;font-size:14px;">Order Confirmed!</p>
      </div>
      <div style="padding:30px;background:#faf8f5;">
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>Total:</strong> Rs.${order.totalAmount}</p>
        <p><strong>Payment:</strong> ${order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online'}</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <thead><tr style="background:#6B3A1F;color:#fff;">
            <th style="padding:10px;text-align:left;">Item</th>
            <th style="padding:10px;">Qty</th>
            <th style="padding:10px;text-align:right;">Price</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <p style="color:#666;font-size:13px;">Estimated Delivery: 5-7 Business Days</p>
      </div>
    </div>
  `;
  return await sendEmail({ to: userEmail, subject: `Order Confirmed - ${order.orderNumber}`, html });
};

const sendOrderShipped = async (userEmail, order) => {
  const html = `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;padding:30px;border:1px solid #d4af37;border-radius:8px;">
      <h2 style="color:#2196f3;">🚚 Order Shipped!</h2>
      <p>Your order <strong>${order.orderNumber}</strong> has been shipped.</p>
      <p>Tracking ID: <strong>${order.trackingId || 'Will be updated soon'}</strong></p>
      <p>Estimated Delivery: 2-3 days</p>
    </div>
  `;
  return await sendEmail({ to: userEmail, subject: `Order Shipped - ${order.orderNumber}`, html });
};

const sendOrderDelivered = async (userEmail, order) => {
  const html = `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;padding:30px;border:1px solid #d4af37;border-radius:8px;">
      <h2 style="color:#27ae60;">✅ Order Delivered!</h2>
      <p>Your order <strong>${order.orderNumber}</strong> has been delivered.</p>
      <a href="${process.env.CLIENT_URL || 'http://localhost:5500'}/index.html#orders" style="display:inline-block;background:#6B3A1F;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">Rate Your Order</a>
    </div>
  `;
  return await sendEmail({ to: userEmail, subject: `Order Delivered - ${order.orderNumber}`, html });
};

const sendOrderCancelled = async (userEmail, order) => {
  const html = `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;padding:30px;border:1px solid #d4af37;border-radius:8px;">
      <h2 style="color:#e74c3c;">❌ Order Cancelled</h2>
      <p>Your order <strong>${order.orderNumber}</strong> has been cancelled.</p>
      <p>If you have any questions, contact us at velriclondon2004@gmail.com</p>
    </div>
  `;
  return await sendEmail({ to: userEmail, subject: `Order Cancelled - ${order.orderNumber}`, html });
};

const sendAdminNewOrder = async (order) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_EMAIL || process.env.EMAIL_USER;
  if (!adminEmail) {
    console.log('No ADMIN_EMAIL configured');
    return;
  }
  const html = `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;padding:25px;">
      <h2 style="color:#6B3A1F;">🛒 NEW ORDER RECEIVED</h2>
      <p><strong>Order:</strong> ${order.orderNumber}</p>
      <p><strong>Amount:</strong> Rs.${order.totalAmount}</p>
      <p><strong>Items:</strong> ${order.items.length}</p>
      <p><strong>Payment:</strong> ${order.paymentMethod} | ${order.paymentStatus}</p>
      <a href="${process.env.CLIENT_URL || 'http://localhost:5500'}/index.html#admin" style="display:inline-block;background:#6B3A1F;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">Open Admin Panel</a>
    </div>
  `;
  return await sendEmail({ to: adminEmail, subject: `New Order ${order.orderNumber} [Rs.${order.totalAmount}]`, html });
};

const sendAdminOrderStatus = async (order, statusText) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_EMAIL || process.env.EMAIL_USER;
  if (!adminEmail) {
    console.log('No ADMIN_EMAIL configured');
    return;
  }
  const html = `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;padding:25px;">
      <h2 style="color:#6B3A1F;">📦 ORDER STATUS UPDATE</h2>
      <p><strong>Order:</strong> ${order.orderNumber}</p>
      <p><strong>New Status:</strong> ${statusText}</p>
      <p><strong>Amount:</strong> Rs.${order.totalAmount}</p>
      <p><strong>Items:</strong> ${order.items.length}</p>
    </div>
  `;
  return await sendEmail({ to: adminEmail, subject: `Order ${order.orderNumber} - ${statusText}`, html });
};

module.exports = { sendEmail, sendOrderConfirmation, sendOrderShipped, sendOrderDelivered, sendOrderCancelled, sendAdminNewOrder, sendAdminOrderStatus };