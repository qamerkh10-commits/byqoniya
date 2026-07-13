// routes/content.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const CONTENT_DIR = path.join(__dirname, '..', 'content');

// قائمة الصفحات (محتاج تسجيل دخول)
router.get('/pages', requireAuth, (req, res) => {
  const pages = db
    .prepare('SELECT id, slug, title, description, icon, sort_order, updated_at FROM pages ORDER BY sort_order ASC, id ASC')
    .all();
  res.json({ pages });
});

// محتوى صفحة معيّنة (محمي بتسجيل الدخول - عشان كده مش بنقدمه كملف static عادي)
router.get('/pages/:slug', requireAuth, (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE slug = ?').get(req.params.slug);
  if (!page) return res.status(404).send('الصفحة غير موجودة');

  const filePath = path.join(CONTENT_DIR, page.filename);
  // تأكيد إن الملف جوه مجلد content فقط (حماية من path traversal)
  if (!filePath.startsWith(CONTENT_DIR)) {
    return res.status(400).send('مسار غير صالح');
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('الملف غير موجود على السيرفر');
  }

  res.sendFile(filePath);
});

module.exports = router;
