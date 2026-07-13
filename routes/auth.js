// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db/init');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    googleLinked: !!u.google_id,
  };
}

// إعدادات عامة يحتاجها الفرونت (هل تسجيل الدخول بجوجل مفعّل، وبأي Client ID)
router.get('/config', (req, res) => {
  res.json({ googleEnabled: !!GOOGLE_CLIENT_ID, googleClientId: GOOGLE_CLIENT_ID });
});

// تسجيل مستخدم جديد بالإيميل
router.post('/register', async (req, res) => {
  try {
    const { email, name, password } = req.body || {};

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'من فضلك أدخل الاسم والبريد الإلكتروني وكلمة المرور' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ error: 'البريد الإلكتروني غير صالح' });
    }
    if (String(name).trim().length < 2) {
      return res.status(400).json({ error: 'الاسم قصير جدًا' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'كلمة المرور يجب ألا تقل عن 6 أحرف' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'البريد الإلكتروني ده مسجّل بالفعل، جرّب تسجيل الدخول' });
    }

    const hash = await bcrypt.hash(String(password), 12);
    const countUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    const role = countUsers === 0 ? 'admin' : 'user';

    const info = db
      .prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(cleanEmail, String(name).trim(), hash, role);

    req.session.userId = info.lastInsertRowid;
    req.session.role = role;
    db.prepare(`UPDATE users SET last_login_at = datetime('now'), last_active_at = datetime('now') WHERE id = ?`).run(info.lastInsertRowid);

    res.json(publicUser({ id: info.lastInsertRowid, email: cleanEmail, name: name.trim(), role, google_id: null }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الحساب' });
  }
});

// تسجيل الدخول بالإيميل وكلمة المرور
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'من فضلك أدخل البريد الإلكتروني وكلمة المرور' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
    if (!user) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    req.session.userId = user.id;
    req.session.role = user.role;
    db.prepare(`UPDATE users SET last_login_at = datetime('now'), last_active_at = datetime('now') WHERE id = ?`).run(user.id);

    res.json(publicUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول' });
  }
});

// تسجيل الدخول بحساب Google — بس للإيميلات المسجّلة بالفعل بكلمة مرور
router.post('/google', async (req, res) => {
  try {
    if (!googleClient) {
      return res.status(501).json({ error: 'تسجيل الدخول بجوجل غير مفعّل على هذا السيرفر بعد' });
    }
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json({ error: 'بيانات جوجل ناقصة' });

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const googleEmail = String(payload.email || '').trim().toLowerCase();
    const googleSub = payload.sub;

    if (!payload.email_verified) {
      return res.status(400).json({ error: 'بريد حساب جوجل غير موثّق' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(googleEmail);
    if (!user) {
      return res.status(404).json({
        error: 'مفيش حساب مسجّل بالبريد ده. لازم تسجّل حساب بالبريد الإلكتروني وكلمة المرور الأول، وبعدين تقدر تربطه بجوجل.',
      });
    }

    if (user.google_id && user.google_id !== googleSub) {
      return res.status(409).json({ error: 'الحساب ده مربوط بحساب جوجل تاني بالفعل' });
    }

    if (!user.google_id) {
      db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleSub, user.id);
      user.google_id = googleSub;
    }

    req.session.userId = user.id;
    req.session.role = user.role;
    db.prepare(`UPDATE users SET last_login_at = datetime('now'), last_active_at = datetime('now') WHERE id = ?`).run(user.id);

    res.json(publicUser(user));
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'تعذّر التحقق من حساب جوجل' });
  }
});

// ربط حساب جوجل بحساب مسجّل دخول بالفعل (من صفحة الإعدادات)
router.post('/link-google', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
    }
    if (!googleClient) {
      return res.status(501).json({ error: 'تسجيل الدخول بجوجل غير مفعّل على هذا السيرفر بعد' });
    }
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json({ error: 'بيانات جوجل ناقصة' });

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const googleEmail = String(payload.email || '').trim().toLowerCase();

    const me = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    if (!me) return res.status(401).json({ error: 'الجلسة غير صالحة' });

    if (googleEmail !== me.email) {
      return res.status(400).json({
        error: `لازم تسجّل دخول جوجل بنفس بريدك المسجّل (${me.email}) عشان تربطه`,
      });
    }

    const conflict = db.prepare('SELECT id FROM users WHERE google_id = ? AND id != ?').get(payload.sub, me.id);
    if (conflict) {
      return res.status(409).json({ error: 'حساب جوجل ده مربوط بحساب تاني بالفعل' });
    }

    db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(payload.sub, me.id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'تعذّر التحقق من حساب جوجل' });
  }
});

// تسجيل الخروج
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// بيانات المستخدم الحالي
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ user: null });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.json({ user: null });
  res.json({ user: publicUser(user) });
});

module.exports = router;
