// routes/memorization.js
const express = require('express');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// جدول المحفوظات الخاص بالمستخدم الحالي: كل الأبيات الـ34 + حالة كل بيت لهذا المستخدم
router.get('/progress', (req, res) => {
  const items = db.prepare('SELECT * FROM memorization_items ORDER BY id ASC').all();
  const progressRows = db
    .prepare('SELECT * FROM memorization_progress WHERE user_id = ?')
    .all(req.session.userId);

  const progressMap = new Map(progressRows.map((r) => [r.item_id, r]));

  const merged = items.map((item) => {
    const p = progressMap.get(item.id);
    return {
      id: item.id,
      title: item.title,
      text: item.text,
      scheduled_date: p ? p.scheduled_date : null,
      memorized: p ? !!p.memorized : false,
      memorized_at: p ? p.memorized_at : null,
    };
  });

  const memorizedCount = merged.filter((m) => m.memorized).length;

  res.json({
    items: merged,
    stats: { total: merged.length, memorized: memorizedCount, percent: Math.round((memorizedCount / merged.length) * 100) },
  });
});

// تحديث حالة بيت واحد (تحديد تاريخ مستهدف و/أو تأشيره كمحفوظ)
router.put('/progress/:itemId', (req, res) => {
  const itemId = Number(req.params.itemId);
  const item = db.prepare('SELECT id FROM memorization_items WHERE id = ?').get(itemId);
  if (!item) return res.status(404).json({ error: 'البيت غير موجود' });

  const { scheduled_date, memorized } = req.body || {};

  const existing = db
    .prepare('SELECT * FROM memorization_progress WHERE user_id = ? AND item_id = ?')
    .get(req.session.userId, itemId);

  const memorizedBool = memorized ? 1 : 0;
  const memorizedAt = memorizedBool ? new Date().toISOString().slice(0, 10) : null;

  if (existing) {
    db.prepare(
      `UPDATE memorization_progress SET
         scheduled_date = ?,
         memorized = ?,
         memorized_at = CASE WHEN ? = 1 AND memorized = 0 THEN ? WHEN ? = 0 THEN NULL ELSE memorized_at END,
         updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      scheduled_date ?? existing.scheduled_date,
      memorizedBool,
      memorizedBool,
      memorizedAt,
      memorizedBool,
      existing.id
    );
  } else {
    db.prepare(
      `INSERT INTO memorization_progress (user_id, item_id, scheduled_date, memorized, memorized_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(req.session.userId, itemId, scheduled_date || null, memorizedBool, memorizedAt);
  }

  res.json({ ok: true });
});

module.exports = router;
