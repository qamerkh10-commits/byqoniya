// server.js
require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const SqliteStoreFactory = require('better-sqlite3-session-store');
const db = require('./db/init');

const authRoutes = require('./routes/auth');
const contentRoutes = require('./routes/content');
const adminRoutes = require('./routes/admin');
const memorizationRoutes = require('./routes/memorization');

const app = express();
const PORT = process.env.PORT || 3000;
const SqliteStore = SqliteStoreFactory(session);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new SqliteStore({
      client: db,
      expired: { clear: true, intervalMs: 15 * 60 * 1000 },
    }),
    secret: process.env.SESSION_SECRET || 'يرجى-تغيير-هذا-المفتاح-في-ملف-env',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // أسبوع
      sameSite: 'lax',
    },
  })
);

// الصفحة العامة (قبل تسجيل الدخول) هي المدخل الرئيسي للموقع
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// الملفات الثابتة العامة (الواجهة، تسجيل الدخول، CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// مسارات الـ API
app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/memorization', memorizationRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'حدث خطأ غير متوقع في السيرفر' });
});

app.listen(PORT, () => {
  console.log(`✅ المنظومة البيقونية شغالة على http://localhost:${PORT}`);
});
