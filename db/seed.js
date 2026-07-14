// db/seed.js
// تعبئة الصفحات الست الأساسية + الأبيات الأربعة والثلاثين لجدول الحفظ

const db = require('./init');

const pages = [
  {
    slug: 'slides', title: 'العرض التفاعلي (بوربوينت)', icon: '🖥️', filename: 'slides.html', sort_order: 1,
    description: 'شرح المنظومة كاملةً بأبياتها الأربعة والثلاثين، شريحةً شريحة، بترتيب كلام الشيخ رحمه الله حرفيًا.',
    group_key: null, group_title: null, group_icon: null,
  },
  {
    slug: 'interactive-book', title: 'شرح ابن عثيمين', icon: '📖', filename: 'interactive-book.html', sort_order: 2,
    description: 'تصفّح كامل الكتاب (المتن والشرح) في نسق تفاعلي مع بطاقات مراجعة ومراجع لكل مسألة.',
    group_key: 'books', group_title: 'الكتب', group_icon: '📚',
  },
  {
    slug: 'summaries', title: 'التلخيصات القمرية', icon: '🌙', filename: 'summaries.html', sort_order: 3,
    description: 'تلخيص مركّز لكل أقسام المنظومة، مناسب للمراجعة السريعة قبل الاختبار.',
    group_key: 'summaries', group_title: 'التلخيصات', group_icon: '🗂️',
  },
  {
    slug: 'mindmap', title: 'الخريطة الذهنية', icon: '🧠', filename: 'mindmap.html', sort_order: 4,
    description: 'خريطة ذهنية تربط بين أقسام الحديث الاثنين والثلاثين وعلاقتها ببعض بصريًا.',
    group_key: null, group_title: null, group_icon: null,
  },
  {
    slug: 'memorization', title: 'اختبار الحفظ', icon: '📝', filename: 'memorization.html', sort_order: 5,
    description: 'اتكلم من حفظك وقارن كلامك بالمتن الأصلي كلمة بكلمة، بيتًا بيتًا أو القصيدة كاملة.',
    group_key: null, group_title: null, group_icon: null,
  },
  {
    slug: 'quiz', title: 'اختبارات الشرح', icon: '✅', filename: 'quiz.html', sort_order: 6,
    description: 'اختبار يغطي فهمك لشرح المنظومة بأسئلة متنوعة وتصحيح فوري.',
    group_key: null, group_title: null, group_icon: null,
  },
];

const insertPage = db.prepare(`
  INSERT INTO pages (slug, title, icon, filename, sort_order, description, group_key, group_title, group_icon)
  VALUES (@slug, @title, @icon, @filename, @sort_order, @description, @group_key, @group_title, @group_icon)
  ON CONFLICT(slug) DO UPDATE SET
    title = excluded.title,
    icon = excluded.icon,
    filename = excluded.filename,
    sort_order = excluded.sort_order,
    description = CASE WHEN pages.description = '' OR pages.description IS NULL THEN excluded.description ELSE pages.description END,
    group_key = CASE WHEN pages.group_key IS NULL THEN excluded.group_key ELSE pages.group_key END,
    group_title = CASE WHEN pages.group_title IS NULL THEN excluded.group_title ELSE pages.group_title END,
    group_icon = CASE WHEN pages.group_icon IS NULL THEN excluded.group_icon ELSE pages.group_icon END,
    updated_at = datetime('now')
`);

const pageTx = db.transaction((rows) => { for (const row of rows) insertPage.run(row); });
pageTx(pages);

// ---- الأبيات الأربعة والثلاثون (نفس نص أداة الحفظ الأصلية) ----
const VERSES = [
"أبدأُ بالحمدِ مُصَلِّياً على مُحمَّدٍ خَيِر نبيْ أُرسلا",
"وذِي مِنَ أقسَامِ الحديث عدَّة وكُلُّ واحدٍ أتى وحدَّه",
"أوَّلُها «الصحيحُ» وهوَ ما اتَّصَلْ إسنادُهُ ولْم يُشَذّ أو يُعلّ",
"يَرْويهِ عَدْلٌ ضَابِطٌ عَنْ مِثْلِهِ مُعْتَمَدٌ في ضَبْطِهِ ونَقْلهِ",
"وَ«الَحسَنُ» الَمعْرُوفُ طُرْقاً وغَدَتْ رِجَالُهُ لا كالصّحيحِ اشْتَهَرَتْ",
"وكُلُّ ما عَنْ رُتبةِ الُحسْنِ قَصْر فَهْوَ «الضعيفُ» وهوَ أقْسَاماً كُثُرْ",
"وما أُضيفَ للنبي «الَمرْفوعُ» وما لتَابِعٍ هُوَ «المقْطوعُ»",
"وَ«الُمسْنَدُ» الُمتَّصِلُ الإسنادِ مِنْ رَاويهِ حتَّى الُمصْطفى ولْم يَبنْ",
"ومَا بِسَمْعِ كُلِّ رَاوٍ يَتَّصِلْ إسْنَادُهُ للمُصْطَفى فَ«الُمتَّصلْ»",
"«مُسَلْسَلٌ» قُلْ مَا عَلَى وَصْفٍ أتَى مِثْلُ أمَا والله أنْبأنِي الفتى",
"كذَاكَ قَدْ حَدَّثَنِيهِ قائِماً أوْ بَعْدَ أنْ حَدَّثَنِي تَبَسَّمَا",
"«عَزيزٌ» مَروِيُّ اثنَيِن أوْ ثَلاثهْ «مَشْهورٌ» مَرْوِيُّ فَوْقَ ما ثَلاثهْ",
"«مَعَنْعَنٌ» كَعَن سَعيدٍ عَنْ كَرَمْ «وَمُبهَمٌ» مَا فيهِ رَاوٍ لْم يُسَمْ",
"وكُلُّ مَا قَلَّت رِجَالُهُ «عَلا» وضِدُّهُ ذَاكَ الذِي قَدْ «نَزَلا»",
"ومَا أضَفْتَهُ إلى الأصْحَابِ مِنْ قَوْلٍ وفعْلٍ فهْوَ «مَوْقُوفٌ» زُكنْ",
"«وَمُرْسلٌ» مِنهُ الصَّحَابُّي سَقَطْ وقُلْ «غَريبٌ» ما رَوَى رَاوٍ فَقطْ",
"وكلُّ مَا لْم يَتَّصِلْ بِحَالٍ إسْنَادُهُ «مُنْقَطِعُ» الأوْصالِ",
"«والُمعْضَلُ» السَّاقِطُ مِنْهُ اثْنَانِ ومَا أتى «مُدَلَّساً» نَوعانِ",
"الأوَّل الإسْقاطُ للشَّيخِ وأنْ يَنْقُلَ مَّمنْ فَوْقَهُ بعنْ وأنْ",
"والثَّانِ لا يُسْقِطُهُ لكنْ يَصِفْ أوْصَافَهُ بما بهِ لا يَنْعرِفْ",
"ومَا يَخالِفُ ثِقةٌ فيهِ الَملا فـ«الشَّاذُّ» و«الَمقْلوبُ» قِسْمَانِ تَلا",
"إبْدَالُ راوٍ ما بِرَاوٍ قِسْمُ وقَلْبُ إسْنَادٍ لمتنٍ قِسمُ",
"وَ«الفَرَدُ» ما قَيَّدْتَهُ بثِقَةِ أوْ جْمعٍ أوْ قَصِر على روايةِ",
"ومَا بعِلَّةٍ غُمُوضٍ أوْ خَفَا «مُعَلَّلٌ» عِنْدَهُمُ قَدْ عُرِفَا",
"وذُو اخْتِلافِ سنَدٍ أو مَتْنٍ «مُضْطربٌ» عِنْدَ أهيْلِ الفَنِّ",
"وَ«الُمدْرَجاتُ» في الحديثِ ما أتَتْ مِنْ بَعْضِ ألفاظِ الرُّوَاةِ اتَّصَلَتْ",
"ومَا رَوى كلُّ قَرِينٍ عنْ أخهْ «مُدَبَّجٌ» فَاعْرِفْهُ حَقًّا وانْتَخهْ",
"مُتَّفِقٌ لَفْظاً وخطاً «مُتَّفقْ» وضِدُّهُ فيما ذَكَرْنَا «الُمفْترقْ»",
"«مُؤْتَلِفٌ» مُتَّفِقُ الخطِّ فَقَطْ وضِدُّهُ «مُختَلِفٌ» فَاخْشَ الغَلَطْ",
"«والُمنْكَرُ» الفَردُ بهِ رَاوٍ غَدَا تَعْدِيلُهُ لا يْحمِلُ التَّفَرُّدَا",
"«مَتُروكُهُ» مَا وَاحِدٌ بهِ انفَردْ وأجَمعُوا لضَعْفِه فَهُوَ كرَدّ",
"والكذِبُ الُمخْتَلَقُ المصنُوعُ علَى النَّبيِّ فذَلِكَ «الموْضوعُ»",
"وقَدْ أتَتْ كالَجوْهَرِ المكْنُونِ سَمَّيْتُهَا: مَنْظُومَةَ البَيْقُوني",
"فَوْقَ الثَّلاثيَن بأرْبَعٍ أتَتْ أقْسامُهَا ثمَّ بخيٍر خُتِمتْ"
];

function extractTitle(verse, index) {
  const matches = verse.match(/«([^»]+)»/g);
  if (matches && matches.length) {
    return matches.map((m) => m.replace(/[«»]/g, '')).join(' / ');
  }
  // أبيات بدون مصطلح بين قوسين (مقدمة/خاتمة)ناخدلها عنوان وصفي
  const fallback = ['المقدمة', 'تمهيد أقسام الحديث'];
  if (index === 0) return 'المقدمة';
  if (index === 1) return 'تمهيد أقسام الحديث';
  if (index === 32) return 'خاتمة المنظومة';
  if (index === 33) return 'خاتمة المنظومة';
  return `البيت ${index + 1}`;
}

const insertVerse = db.prepare(`
  INSERT INTO memorization_items (id, title, text)
  VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET title = excluded.title, text = excluded.text
`);

const verseTx = db.transaction((rows) => {
  rows.forEach((text, i) => {
    insertVerse.run(i + 1, extractTitle(text, i), text);
  });
});
verseTx(VERSES);

console.log(`✅ تم تجهيز ${pages.length} صفحة و ${VERSES.length} بيتًا لجدول الحفظ في قاعدة البيانات.`);
console.log('ملاحظة: أول مستخدم يسجّل حساب من خلال صفحة "إنشاء حساب" في الموقع سيصبح "مطورًا" (Admin) تلقائيًا.');
process.exit(0);
