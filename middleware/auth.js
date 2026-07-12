// middleware/auth.js

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
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
