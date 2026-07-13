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

  // 2) تحميل قائمة الصفحات
  let pages = [];
  try {
    const res = await fetch('/api/content/pages');
    const data = await res.json();
    pages = data.pages || [];
  } catch (e) {
    pages = [];
  }

  function renderNav(activeSlug) {
    // امسح كل عناصر الأقسام القديمة (بعد label الأقسام)
    navList.querySelectorAll('[data-page-slug]').forEach((el) => el.remove());
    pages.forEach((p) => {
      const li = document.createElement('li');
      li.dataset.pageSlug = p.slug;
      const btn = document.createElement('button');
      btn.className = 'nav-item' + (p.slug === activeSlug ? ' active' : '');
      btn.innerHTML = `<span class="icon">${p.icon || '📄'}</span><span>${escapeHtml(p.title)}</span>`;
      btn.addEventListener('click', () => openPage(p));
      li.appendChild(btn);
      navList.appendChild(li);
    });
    homeNavBtn.classList.toggle('active', activeSlug === null);
  }

  function openPage(p) {
    pageTitle.textContent = p.title;
    mobileTitle.textContent = p.title;
    frameWrap.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = `/api/content/pages/${encodeURIComponent(p.slug)}`;
    frameWrap.appendChild(iframe);
    renderNav(p.slug);
    sidebar.classList.remove('open');
    history.replaceState(null, '', `#${p.slug}`);
  }

  function renderHome() {
    pageTitle.textContent = 'الرئيسية';
    mobileTitle.textContent = 'المنظومة البيقونية';
    renderNav(null);
    sidebar.classList.remove('open');
    history.replaceState(null, '', '#');

    const cardsHtml = pages
      .map(
        (p, i) => `
      <div class="card" data-slug="${escapeHtml(p.slug)}">
        <div class="num">٠${i + 1}</div>
        <h3>${escapeHtml(p.title)}</h3>
        <p class="desc">${escapeHtml(p.description || '')}</p>
        <span class="cta">فتح ←</span>
      </div>`
      )
      .join('');

    frameWrap.innerHTML = `
      <div class="dash-header">
        <div class="eyebrow">أهلاً ${escapeHtml(me.name)}</div>
        <h2>اختر أحد الأقسام للمتابعة</h2>
        <div class="matn-strip"><p>وقَدْ أتَتْ كالَجوهَر الَمكْنُونِ … سَمَّيتُها منظُومة البَيقُونِي</p></div>
      </div>
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
  }

  homeNavBtn.addEventListener('click', renderHome);

  // فتح صفحة من الهاش لو موجود، أو الرئيسية
  const hashSlug = window.location.hash.replace('#', '');
  const initial = pages.find((p) => p.slug === hashSlug);
  if (initial) openPage(initial);
  else renderHome();

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
