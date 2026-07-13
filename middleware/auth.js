// middleware/auth.js
const db = require('../db/init');

// نحدّث "آخر نشاط" للمستخدم، لكن مش على كل ريكوست عشان منزودش الكتابة على قاعدة البيانات؛
// نكتفي بتحديثها لو مرّ أكتر من دقيقة من آخر مرة سجّلناها لنفس الجلسة
const ACTIVE_TOUCH_INTERVAL_MS = 60 * 1000;
const touchStmt = db.prepare(`UPDATE users SET last_active_at = datetime('now') WHERE id = ?`);

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    const now = Date.now();
    if (!req.session.lastTouch || now - req.session.lastTouch > ACTIVE_TOUCH_INTERVAL_MS) {
      req.session.lastTouch = now;
      try { touchStmt.run(req.session.userId); } catch (_) {}
    }
    return next();
  }
  return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'هذه العملية متاحة للمطور فقط' });
}

module.exports = { requireAuth, requireAdmin };
