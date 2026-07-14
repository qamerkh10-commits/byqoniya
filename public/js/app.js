// public/js/app.js
(async function () {
  const loadingScreen = document.getElementById('loadingScreen');
  const appShell = document.getElementById('appShell');
  const navList = document.getElementById('navList');
  const usernameLabel = document.getElementById('usernameLabel');
  const roleBadge = document.getElementById('roleBadge');
  const adminLink = document.getElementById('adminLink');
  const googleLinkBtn = document.getElementById('googleLinkBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userAvatar = document.getElementById('userAvatar');
  const pageTitle = document.getElementById('pageTitle');
  const mobileTitle = document.getElementById('mobileTitle');
  const frameWrap = document.getElementById('frameWrap');
  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('menuToggle');
  const homeNavBtn = document.getElementById('homeNavBtn');

  // ثيم محفوظ
  const savedTheme = localStorage.getItem('baiq-theme') || 'green';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // 1) تأكيد تسجيل الدخول
  let me;
  try {
    const meRes = await fetch('/api/auth/me');
    me = (await meRes.json()).user;
  } catch (e) {
    me = null;
  }

  if (!me) {
    window.location.href = '/login.html';
    return;
  }

  usernameLabel.textContent = me.name;
  roleBadge.textContent = me.role === 'admin' ? 'مطوّر' : 'طالب';
  if (userAvatar) {
    const parts = String(me.name || '').trim().split(/\s+/).filter(Boolean);
    userAvatar.textContent = parts.length ? (parts.length === 1 ? parts[0][0] : parts[0][0] + parts[1][0]) : '؟';
  }
  if (me.role === 'admin') adminLink.style.display = 'block';

  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  menuToggle?.addEventListener('click', () => sidebar.classList.toggle('open'));

  // زرار ربط حساب جوجل (لو مفعّل على السيرفر ولسه مش مربوط)
  (async function initGoogleLink() {
    if (me.googleLinked) return;
    try {
      const cfgRes = await fetch('/api/auth/config');
      const cfg = await cfgRes.json();
      if (!cfg.googleEnabled) return;

      googleLinkBtn.style.display = 'block';
      googleLinkBtn.addEventListener('click', () => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.onload = () => {
          google.accounts.id.initialize({
            client_id: cfg.googleClientId,
            callback: async (response) => {
              try {
                const r = await fetch('/api/auth/link-google', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ credential: response.credential }),
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error || 'تعذر الربط');
                alert('تم ربط حساب Google بنجاح ✅');
                googleLinkBtn.style.display = 'none';
              } catch (err) {
                alert(err.message);
              }
            },
          });
          google.accounts.id.prompt();
        };
        document.body.appendChild(script);
      });
    } catch (e) { /* تجاهل */ }
  })();

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  // 2) تحميل قائمة الصفحات وتجميعها: صفحات مستقلة + مجموعات (الكتب/التلخيصات...) كل مجموعة جواها تبويبات
  let pages = [];
  try {
    const res = await fetch('/api/content/pages');
    const data = await res.json();
    pages = data.pages || [];
  } catch (e) {
    pages = [];
  }

  function buildStructure(list) {
    const groupsMap = new Map();
    const entries = [];
    list.forEach((p) => {
      if (p.group_key) {
        if (!groupsMap.has(p.group_key)) {
          const g = {
            type: 'group',
            key: p.group_key,
            title: p.group_title || p.group_key,
            icon: p.group_icon || '📚',
            items: [],
            order: p.sort_order,
          };
          groupsMap.set(p.group_key, g);
          entries.push(g);
        }
        const g = groupsMap.get(p.group_key);
        g.items.push(p);
        g.order = Math.min(g.order, p.sort_order);
      } else {
        entries.push({ type: 'page', page: p, order: p.sort_order });
      }
    });
    entries.sort((a, b) => a.order - b.order);
    return entries;
  }

  const structure = buildStructure(pages);
  const allGroups = structure.filter((e) => e.type === 'group');

  function findGroup(key) {
    return allGroups.find((g) => g.key === key);
  }

  function renderNav(activeKey) {
    // امسح كل عناصر الأقسام القديمة (بعد label الأقسام)
    navList.querySelectorAll('[data-nav-entry]').forEach((el) => el.remove());

    structure.forEach((entry) => {
      if (entry.type === 'page') {
        const p = entry.page;
        const li = document.createElement('li');
        li.dataset.navEntry = '1';
        const btn = document.createElement('button');
        btn.className = 'nav-item' + (activeKey === `page:${p.slug}` ? ' active' : '');
        btn.innerHTML = `<span class="icon">${p.icon || '📄'}</span><span>${escapeHtml(p.title)}</span>`;
        btn.addEventListener('click', () => openPage(p));
        li.appendChild(btn);
        navList.appendChild(li);
      } else {
        const g = entry;
        const isActiveGroup = activeKey && activeKey.startsWith(`group:${g.key}:`);
        const li = document.createElement('li');
        li.dataset.navEntry = '1';
        li.className = 'nav-group' + (isActiveGroup ? ' open' : '');

        const header = document.createElement('button');
        header.className = 'nav-item nav-group-header' + (isActiveGroup ? ' active' : '');
        header.innerHTML = `<span class="icon">${g.icon}</span><span>${escapeHtml(g.title)}</span><span class="nav-group-count">${g.items.length}</span><span class="nav-group-chev">›</span>`;
        header.addEventListener('click', () => {
          if (isActiveGroup) {
            li.classList.toggle('open');
          } else {
            openGroup(g);
          }
        });
        li.appendChild(header);

        const subList = document.createElement('ul');
        subList.className = 'nav-sub-list';
        g.items.forEach((it) => {
          const subLi = document.createElement('li');
          const subBtn = document.createElement('button');
          subBtn.className = 'nav-sub-item' + (activeKey === `group:${g.key}:${it.slug}` ? ' active' : '');
          subBtn.innerHTML = `<span>${escapeHtml(it.title)}</span>`;
          subBtn.addEventListener('click', () => openGroup(g, it.slug));
          subLi.appendChild(subBtn);
          subList.appendChild(subLi);
        });
        li.appendChild(subList);
        navList.appendChild(li);
      }
    });
    homeNavBtn.classList.toggle('active', activeKey === null);
  }

  function openPage(p) {
    pageTitle.textContent = p.title;
    mobileTitle.textContent = p.title;
    frameWrap.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = `/api/content/pages/${encodeURIComponent(p.slug)}`;
    frameWrap.appendChild(iframe);
    renderNav(`page:${p.slug}`);
    sidebar.classList.remove('open');
    history.replaceState(null, '', `#${p.slug}`);
  }

  function openGroup(g, activeSlug) {
    const slug = activeSlug && g.items.some((i) => i.slug === activeSlug) ? activeSlug : g.items[0].slug;
    const activeItem = g.items.find((i) => i.slug === slug);

    pageTitle.textContent = `${g.title} — ${activeItem.title}`;
    mobileTitle.textContent = g.title;

    frameWrap.innerHTML = `
      <div class="tab-shelf">
        <div class="tab-shelf-label"><span>${g.icon}</span>${escapeHtml(g.title)}</div>
        <div class="tab-shelf-tabs">
          ${g.items
            .map(
              (it) => `<button class="shelf-tab${it.slug === slug ? ' active' : ''}" data-slug="${escapeHtml(it.slug)}">
                <span class="icon">${it.icon || '📄'}</span><span>${escapeHtml(it.title)}</span>
              </button>`
            )
            .join('')}
        </div>
      </div>
      <div class="tab-shelf-frame"><iframe src="/api/content/pages/${encodeURIComponent(slug)}"></iframe></div>
    `;

    frameWrap.querySelectorAll('.shelf-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.slug === slug) return;
        openGroup(g, btn.dataset.slug);
      });
    });

    renderNav(`group:${g.key}:${slug}`);
    sidebar.classList.remove('open');
    history.replaceState(null, '', `#g:${g.key}:${slug}`);
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '؟';
    return parts.length === 1 ? parts[0][0] : parts[0][0] + parts[1][0];
  }

  function timeGreeting() {
    const h = new Date().getHours();
    if (h < 5) return 'مساء الخير';
    if (h < 12) return 'صباح الخير';
    if (h < 17) return 'مساء الخير';
    if (h < 20) return 'مساء الخير';
    return 'مساء الخير';
  }

  function progressRingSvg(percent) {
    const r = 30, c = 2 * Math.PI * r;
    const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
    return `
      <div class="ring">
        <svg viewBox="0 0 74 74">
          <circle class="track" cx="37" cy="37" r="${r}"></circle>
          <circle class="fill" cx="37" cy="37" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${offset}"></circle>
        </svg>
        <div class="ring-label">${percent}٪</div>
      </div>`;
  }

  async function myProgressWidgetHtml() {
    // بطاقة تقدّمي الشخصية — للطلاب فقط
    if (me.role === 'admin') return '';
    let data;
    try {
      const res = await fetch('/api/memorization/progress');
      data = await res.json();
    } catch (e) {
      return '';
    }
    const { memorized, total, percent } = data.stats;
    const remaining = total - memorized;
    const hint =
      memorized === 0
        ? 'ابدأ رحلتك مع أول بيت من المنظومة اليوم'
        : memorized === total
        ? 'الحمد لله، أتممتَ حفظ المنظومة كاملة 🎉'
        : `باقي لك ${remaining} بيتًا لإتمام الحفظ`;

    return `
    <div class="my-progress-card">
      <div class="my-progress-inner">
        <div class="my-progress-info">
          <div class="avatar lg">${escapeHtml(initials(me.name))}</div>
          <div class="my-progress-text">
            <div class="greet">${timeGreeting()}</div>
            <h3>${escapeHtml(me.name)}</h3>
            <div class="hint">${escapeHtml(hint)}</div>
          </div>
        </div>
        <div class="my-progress-ring-wrap">
          ${progressRingSvg(percent)}
          <div class="my-progress-stats">
            حفظت <strong>${memorized}</strong> من <strong>${total}</strong> بيتًا<br>
            نسبة الإنجاز: <strong>${percent}٪</strong>
          </div>
          <a href="/tracker.html" class="btn">متابعة الحفظ ←</a>
        </div>
      </div>
    </div>`;
  }

  async function adminCockpitHtml() {
    let summary = { totalStudents: 0, avgPercent: 0, completedCount: 0, notStartedCount: 0 };
    try {
      const res = await fetch('/api/admin/students-progress');
      const data = await res.json();
      summary = data.summary || summary;
    } catch (e) { /* تجاهل */ }

    return `
    <div class="cockpit">
      <div class="cockpit-top">
        <div class="cockpit-intro">
          <div class="cockpit-eyebrow">لوحة القيادة</div>
          <h2>أهلاً ${escapeHtml(me.name)}</h2>
          <p>نظرة سريعة على أداء الطلاب ومحتوى المنصة، وكل أدوات الإدارة في مكان واحد.</p>
        </div>
        <a href="/admin.html" class="btn cockpit-cta">لوحة تحكم المطور الكاملة ←</a>
      </div>
      <div class="cockpit-stats">
        <div class="cockpit-stat">
          <div class="cs-label">عدد الطلاب</div>
          <div class="cs-value">${summary.totalStudents}</div>
        </div>
        <div class="cockpit-stat">
          <div class="cs-label">متوسط نسبة الحفظ</div>
          <div class="cs-value">${summary.avgPercent}٪</div>
        </div>
        <div class="cockpit-stat">
          <div class="cs-label">أتمّوا المنظومة</div>
          <div class="cs-value">${summary.completedCount}</div>
        </div>
        <div class="cockpit-stat">
          <div class="cs-label">لم يبدأوا بعد</div>
          <div class="cs-value">${summary.notStartedCount}</div>
        </div>
        <div class="cockpit-stat">
          <div class="cs-label">مجموعات المحتوى</div>
          <div class="cs-value">${allGroups.length}</div>
        </div>
      </div>
    </div>`;
  }

  function entryCardHtml(entry, i) {
    if (entry.type === 'group') {
      const g = entry;
      return `
      <div class="card group-card" data-group-key="${escapeHtml(g.key)}">
        <div class="num">${g.icon}</div>
        <h3>${escapeHtml(g.title)}</h3>
        <p class="desc">${g.items.map((it) => escapeHtml(it.title)).join(' · ')}</p>
        <span class="cta">تصفّح ${g.items.length === 1 ? 'العنصر' : g.items.length + ' عناصر'} ←</span>
        <span class="group-count-chip">${g.items.length === 1 ? 'عنصر واحد' : g.items.length + ' عناصر'}</span>
      </div>`;
    }
    const p = entry.page;
    return `
      <div class="card" data-slug="${escapeHtml(p.slug)}">
        <div class="num">٠${i + 1}</div>
        <h3>${escapeHtml(p.title)}</h3>
        <p class="desc">${escapeHtml(p.description || '')}</p>
        <span class="cta">فتح ←</span>
      </div>`;
  }

  function renderHome() {
    pageTitle.textContent = 'الرئيسية';
    mobileTitle.textContent = 'المنظومة البيقونية';
    renderNav(null);
    sidebar.classList.remove('open');
    history.replaceState(null, '', '#');

    const cardsHtml = structure.map((entry, i) => entryCardHtml(entry, i)).join('');
    const isAdmin = me.role === 'admin';

    frameWrap.innerHTML = `
      <div id="cockpitSlot"></div>
      ${
        isAdmin
          ? `<div class="dash-header library-header"><div class="eyebrow">مكتبة المحتوى</div><h2>كل الأقسام والمجموعات المتاحة للطلاب</h2></div>`
          : `<div class="dash-header">
              <div class="eyebrow">أهلاً ${escapeHtml(me.name)}</div>
              <h2>اختر أحد الأقسام للمتابعة</h2>
              <div class="matn-strip"><p>وقَدْ أتَتْ كالَجوهَر الَمكْنُونِ … سَمَّيتُها منظُومة البَيقُونِي</p></div>
            </div>
            <div id="myProgressSlot"></div>`
      }
      <div class="grid">
        ${cardsHtml}
        <a class="card special" href="/tracker.html">
          <div class="num">📅</div>
          <h3>جدول محفوظاتي</h3>
          <p class="desc">حدّد جدولك الخاص لحفظ أبيات المنظومة، وأشّر كل بيت تحفظه لتتابع تقدّمك بيتًا بيتًا.</p>
          <span class="cta">فتح ←</span>
        </a>
      </div>
    `;

    frameWrap.querySelectorAll('.card[data-slug]').forEach((card) => {
      card.addEventListener('click', () => {
        const p = pages.find((x) => x.slug === card.dataset.slug);
        if (p) openPage(p);
      });
    });
    frameWrap.querySelectorAll('.card[data-group-key]').forEach((card) => {
      card.addEventListener('click', () => {
        const g = findGroup(card.dataset.groupKey);
        if (g) openGroup(g);
      });
    });

    if (isAdmin) {
      adminCockpitHtml().then((html) => {
        const slot = document.getElementById('cockpitSlot');
        if (slot) slot.outerHTML = html;
      });
    } else {
      myProgressWidgetHtml().then((html) => {
        const slot = document.getElementById('myProgressSlot');
        if (slot) slot.outerHTML = html;
      });
    }
  }

  homeNavBtn.addEventListener('click', renderHome);

  // فتح صفحة من الهاش لو موجود، أو الرئيسية
  const rawHash = window.location.hash.replace('#', '');
  if (rawHash.startsWith('g:')) {
    const [, groupKey, slug] = rawHash.split(':');
    const g = findGroup(groupKey);
    if (g) openGroup(g, slug);
    else renderHome();
  } else {
    const initial = pages.find((p) => p.slug === rawHash);
    if (initial) openPage(initial);
    else renderHome();
  }

  // مبدّل الثيم
  document.querySelectorAll('.tsw').forEach((b) => {
    b.classList.toggle('on', b.dataset.theme === savedTheme);
    b.addEventListener('click', () => {
      document.documentElement.setAttribute('data-theme', b.dataset.theme);
      localStorage.setItem('baiq-theme', b.dataset.theme);
      document.querySelectorAll('.tsw').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    });
  });

  loadingScreen.style.display = 'none';
  appShell.style.display = 'flex';
})();
