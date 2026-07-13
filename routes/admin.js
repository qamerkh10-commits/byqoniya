// routes/admin.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db/init');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const CONTENT_DIR = path.join(__dirname, '..', 'content');

const ALLOWED_EXT = ['.html', '.htm', '.txt', '.pdf', '.png', '.jpg', '.jpeg', '.svg'];

function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\u0621-\u064A\u0660-\u0669-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'page-' + Date.now();
}

function safeFilename(original) {
  const ext = path.extname(original).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    throw new Error('نوع الملف غير مسموح به. الأنواع المسموحة: ' + ALLOWED_EXT.join(', '));
  }
  const base = path
    .basename(original, ext)
    .replace(/[^a-zA-Z0-9\u0621-\u064A\u0660-\u0669_-]/g, '_')
    .slice(0, 60);
  return `${Date.now()}-${base}${ext}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CONTENT_DIR),
  filename: (req, file, cb) => {
    try {
      cb(null, safeFilename(file.originalname));
    } catch (err) {
      cb(err);
    }
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// كل مسارات الأدمن محمية
router.use(requireAdmin);

// رفع ملف جديد وإضافته للقائمة الجانبية
router.post('/pages', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'من فضلك اختر ملفًا لرفعه' });
    }
    const title = (req.body.title || req.file.originalname).trim();
    const icon = (req.body.icon || '📄').trim();
    const description = (req.body.description || '').trim();
    let slug = slugify(req.body.slug || title);

    const exists = db.prepare('SELECT id FROM pages WHERE slug = ?').get(slug);
    if (exists) slug = `${slug}-${Date.now()}`;

    const maxOrder = db.prepare('SELECT MAX(sort_order) AS m FROM pages').get().m || 0;

    const info = db
      .prepare(
        `INSERT INTO pages (slug, title, icon, description, filename, sort_order, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(slug, title, icon, description, req.file.filename, maxOrder + 1, req.session.userId);

    res.json({ id: info.lastInsertRowid, slug, title, icon, description, filename: req.file.filename });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'حدث خطأ أثناء رفع الملف' });
  }
});

// جلب محتوى ملف نصي/HTML للتعديل
router.get('/pages/:id/raw', (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id);
  if (!page) return res.status(404).json({ error: 'الصفحة غير موجودة' });

  const ext = path.extname(page.filename).toLowerCase();
  if (!['.html', '.htm', '.txt'].includes(ext)) {
    return res.status(400).json({ error: 'هذا النوع من الملفات لا يمكن تعديله كنص (صورة/PDF)، يمكنك استبداله برفع ملف جديد' });
  }

  const filePath = path.join(CONTENT_DIR, page.filename);
  if (!filePath.startsWith(CONTENT_DIR) || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'الملف غير موجود' });
  }

  const content = fs.readFileSync(filePath, 'utf8');
  res.json({ page, content });
});

// تعديل بيانات الصفحة (العنوان/الأيقونة/الترتيب) و/أو محتوى الملف النصي
router.put('/pages/:id', (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id);
  if (!page) return res.status(404).json({ error: 'الصفحة غير موجودة' });

  const { title, icon, sort_order, content, description } = req.body || {};

  if (typeof content === 'string') {
    const ext = path.extname(page.filename).toLowerCase();
    if (!['.html', '.htm', '.txt'].includes(ext)) {
      return res.status(400).json({ error: 'هذا الملف لا يمكن تعديله كنص' });
    }
    const filePath = path.join(CONTENT_DIR, page.filename);
    if (!filePath.startsWith(CONTENT_DIR)) return res.status(400).json({ error: 'مسار غير صالح' });
    fs.writeFileSync(filePath, content, 'utf8');
  }

  db.prepare(
    `UPDATE pages SET
       title = COALESCE(?, title),
       icon = COALESCE(?, icon),
       description = COALESCE(?, description),
       sort_order = COALESCE(?, sort_order),
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(title ?? null, icon ?? null, description ?? null, sort_order ?? null, page.id);

  res.json({ ok: true });
});

// استبدال ملف صفحة موجودة برفع ملف جديد
router.put('/pages/:id/file', upload.single('file'), (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id);
  if (!page) return res.status(404).json({ error: 'الصفحة غير موجودة' });
  if (!req.file) return res.status(400).json({ error: 'من فضلك اختر ملفًا' });

  const oldPath = path.join(CONTENT_DIR, page.filename);
  if (fs.existsSync(oldPath)) {
    try { fs.unlinkSync(oldPath); } catch (_) {}
  }

  db.prepare(`UPDATE pages SET filename = ?, updated_at = datetime('now') WHERE id = ?`).run(
    req.file.filename,
    page.id
  );

  res.json({ ok: true, filename: req.file.filename });
});

// حذف صفحة
router.delete('/pages/:id', (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id);
  if (!page) return res.status(404).json({ error: 'الصفحة غير موجودة' });

  const filePath = path.join(CONTENT_DIR, page.filename);
  if (filePath.startsWith(CONTENT_DIR) && fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }

  db.prepare('DELETE FROM pages WHERE id = ?').run(page.id);
  res.json({ ok: true });
});

// قائمة المستخدمين (للمطور)
router.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY id ASC').all();
  res.json({ users });
});

module.exports = router;
