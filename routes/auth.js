// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db/init');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_\u0621-\u064A\u0660-\u0669 ]{3,30}$/;

// تسجيل مستخدم جديد
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'من فضلك أدخل اسم المستخدم وكلمة المرور' });
    }
    if (!USERNAME_RE.test(username.trim())) {
      return res.status(400).json({ error: 'اسم المستخدم يجب أن يكون بين 3 و30 حرفًا (حروف/أرقام فقط)' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'كلمة المرور يجب ألا تقل عن 6 أحرف' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
    if (existing) {
      return res.status(409).json({ error: 'اسم المستخدم مستخدم بالفعل' });
    }

    const hash = await bcrypt.hash(String(password), 12);

    // أول مستخدم يتسجل في النظام يبقى مطور (admin) تلقائيًا، والباقي مستخدمين عاديين
    const countUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    const role = countUsers === 0 ? 'admin' : 'user';

    const info = db
      .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
      .run(username.trim(), hash, role);

    req.session.userId = info.lastInsertRowid;
    req.session.username = username.trim();
    req.session.role = role;

    res.json({ id: info.lastInsertRowid, username: username.trim(), role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الحساب' });
  }
});

// تسجيل الدخول
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'من فضلك أدخل اسم المستخدم وكلمة المرور' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
    if (!user) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    res.json({ id: user.id, username: user.username, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول' });
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
  res.json({
    user: {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.role,
    },
  });
});

module.exports = router;
