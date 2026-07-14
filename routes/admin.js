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

// قائمة المجموعات الحالية (الكتب، التلخيصات، ...) عشان تظهر في قائمة اختيار المجموعة بالأدمن
router.get('/groups', requireAdmin, (req, res) => {
  const groups = db
    .prepare(
      `SELECT group_key, group_title, group_icon, COUNT(*) AS pages_count
       FROM pages WHERE group_key IS NOT NULL GROUP BY group_key ORDER BY group_title ASC`
    )
    .all();
  res.json({ groups });
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

    let groupKey = (req.body.group_key || '').trim() || null;
    let groupTitle = (req.body.group_title || '').trim() || null;
    let groupIcon = (req.body.group_icon || '').trim() || null;
    if (groupKey) {
      // لو المجموعة دي موجودة بالفعل، خُد عنوانها وأيقونتها الرسمية بدل ما تتكرر بقيم مختلفة لكل صفحة
      const existingGroup = db
        .prepare('SELECT group_title, group_icon FROM pages WHERE group_key = ? AND group_title IS NOT NULL LIMIT 1')
        .get(groupKey);
      if (existingGroup) {
        groupTitle = existingGroup.group_title;
        groupIcon = existingGroup.group_icon;
      } else {
        groupTitle = groupTitle || groupKey;
        groupIcon = groupIcon || '📚';
      }
    }

    const info = db
      .prepare(
        `INSERT INTO pages (slug, title, icon, description, filename, sort_order, created_by, group_key, group_title, group_icon)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(slug, title, icon, description, req.file.filename, maxOrder + 1, req.session.userId, groupKey, groupTitle, groupIcon);

    res.json({ id: info.lastInsertRowid, slug, title, icon, description, filename: req.file.filename, group_key: groupKey, group_title: groupTitle, group_icon: groupIcon });
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

  let groupKey = req.body.group_key;
  let groupTitle = req.body.group_title;
  let groupIcon = req.body.group_icon;
  if (groupKey !== undefined) {
    groupKey = String(groupKey).trim() || null;
    if (groupKey) {
      const existingGroup = db
        .prepare('SELECT group_title, group_icon FROM pages WHERE group_key = ? AND id != ? AND group_title IS NOT NULL LIMIT 1')
        .get(groupKey, page.id);
      if (existingGroup) {
        groupTitle = existingGroup.group_title;
        groupIcon = existingGroup.group_icon;
      } else {
        groupTitle = (groupTitle && String(groupTitle).trim()) || groupKey;
        groupIcon = (groupIcon && String(groupIcon).trim()) || '📚';
      }
    } else {
      groupTitle = null;
      groupIcon = null;
    }
  }

  db.prepare(
    `UPDATE pages SET
       title = COALESCE(?, title),
       icon = COALESCE(?, icon),
       description = COALESCE(?, description),
       sort_order = COALESCE(?, sort_order),
       group_key = CASE WHEN ? THEN ? ELSE group_key END,
       group_title = CASE WHEN ? THEN ? ELSE group_title END,
       group_icon = CASE WHEN ? THEN ? ELSE group_icon END,
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    title ?? null,
    icon ?? null,
    description ?? null,
    sort_order ?? null,
    groupKey !== undefined ? 1 : 0, groupKey ?? null,
    groupKey !== undefined ? 1 : 0, groupTitle ?? null,
    groupKey !== undefined ? 1 : 0, groupIcon ?? null,
    page.id
  );

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

// نظرة عامة على تقدّم كل الطلاب في الحفظ (للمطور) — ملخص لكل طالب + إحصائيات عامة
router.get('/students-progress', (req, res) => {
  const totalItems = db.prepare('SELECT COUNT(*) AS c FROM memorization_items').get().c || 0;

  const students = db
    .prepare(
      `SELECT id, name, email, created_at, last_login_at, last_active_at FROM users WHERE role != 'admin' ORDER BY name ASC`
    )
    .all();

  const memorizedCountStmt = db.prepare(
    `SELECT COUNT(*) AS c FROM memorization_progress WHERE user_id = ? AND memorized = 1`
  );
  const lastMemorizedStmt = db.prepare(
    `SELECT memorized_at FROM memorization_progress WHERE user_id = ? AND memorized = 1 ORDER BY memorized_at DESC LIMIT 1`
  );

  const rows = students.map((s) => {
    const memorized = totalItems ? memorizedCountStmt.get(s.id).c : 0;
    const percent = totalItems ? Math.round((memorized / totalItems) * 100) : 0;
    const lastMemorized = totalItems ? lastMemorizedStmt.get(s.id) : null;
    return {
      id: s.id,
      name: s.name,
      email: s.email,
      created_at: s.created_at,
      last_login_at: s.last_login_at,
      last_active_at: s.last_active_at,
      memorized,
      total: totalItems,
      percent,
      last_memorized_at: lastMemorized ? lastMemorized.memorized_at : null,
    };
  });

  const summary = {
    totalStudents: rows.length,
    totalItems,
    avgPercent: rows.length ? Math.round(rows.reduce((a, r) => a + r.percent, 0) / rows.length) : 0,
    completedCount: rows.filter((r) => totalItems > 0 && r.memorized === totalItems).length,
    notStartedCount: rows.filter((r) => r.memorized === 0).length,
  };

  res.json({ students: rows, summary });
});

// تفاصيل تقدّم طالب معيّن، بيتًا بيتًا (للمطور)
router.get('/students/:id/progress', (req, res) => {
  const studentId = Number(req.params.id);
  const student = db
    .prepare(`SELECT id, name, email, created_at, last_login_at, last_active_at FROM users WHERE id = ?`)
    .get(studentId);
  if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

  const items = db.prepare('SELECT * FROM memorization_items ORDER BY id ASC').all();
  const progressRows = db.prepare('SELECT * FROM memorization_progress WHERE user_id = ?').all(studentId);
  const progressMap = new Map(progressRows.map((r) => [r.item_id, r]));

  const merged = items.map((item) => {
    const p = progressMap.get(item.id);
    return {
      id: item.id,
      title: item.title,
      scheduled_date: p ? p.scheduled_date : null,
      memorized: p ? !!p.memorized : false,
      memorized_at: p ? p.memorized_at : null,
    };
  });

  const memorizedCount = merged.filter((m) => m.memorized).length;

  res.json({
    student,
    items: merged,
    stats: {
      total: merged.length,
      memorized: memorizedCount,
      percent: merged.length ? Math.round((memorizedCount / merged.length) * 100) : 0,
    },
  });
});

module.exports = router;
