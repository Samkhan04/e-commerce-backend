const Visitor = require('../models/Visitor');

const trackVisitor = async (req, res, next) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const date = new Date().toISOString().split('T')[0];
    const source = req.query.utm_source || req.headers.referer || 'direct';

    await Visitor.findOneAndUpdate(
      { ip, date },
      { $inc: { count: 1 }, $setOnInsert: { userAgent: req.headers['user-agent'] || '', source } },
      { upsert: true, new: true }
    );
  } catch (e) {
    console.error('Visitor tracking error:', e.message);
  }
  next();
};

module.exports = trackVisitor;