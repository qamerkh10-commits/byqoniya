// db/seed.js
// تعبئة قاعدة البيانات ببيانات الصفحات الست الأساسية (تشتغل مرة واحدة بأمان، مش هتكرر لو شغلتها تاني)

const db = require('./init');

const pages = [
  { slug: 'slides', title: 'العرض التفاعلي (بوربوينت)', icon: '🖥️', filename: 'slides.html', sort_order: 1 },
  { slug: 'interactive-book', title: 'الكتاب التفاعلي - شرح ابن عثيمين', icon: '📖', filename: 'interactive-book.html', sort_order: 2 },
  { slug: 'summaries', title: 'التلخيصات القمرية', icon: '🌙', filename: 'summaries.html', sort_order: 3 },
  { slug: 'mindmap', title: 'الخريطة الذهنية', icon: '🧠', filename: 'mindmap.html', sort_order: 4 },
  { slug: 'memorization', title: 'اختبار الحفظ', icon: '📝', filename: 'memorization.html', sort_order: 5 },
  { slug: 'quiz', title: 'اختبارات الشرح', icon: '✅', filename: 'quiz.html', sort_order: 6 },
];

const insert = db.prepare(`
  INSERT INTO pages (slug, title, icon, filename, sort_order)
  VALUES (@slug, @title, @icon, @filename, @sort_order)
  ON CONFLICT(slug) DO UPDATE SET
    title = excluded.title,
    icon = excluded.icon,
    filename = excluded.filename,
    sort_order = excluded.sort_order,
    updated_at = datetime('now')
`);

const tx = db.transaction((rows) => {
  for (const row of rows) insert.run(row);
});

tx(pages);

console.log(`✅ تم تجهيز ${pages.length} صفحة في قاعدة البيانات.`);
console.log('ملاحظة: أول مستخدم يسجّل حساب من خلال صفحة "إنشاء حساب" في الموقع سيصبح "مطورًا" (Admin) تلقائيًا.');
process.exit(0);
