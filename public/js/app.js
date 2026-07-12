// public/js/app.js
(async function () {
  const loadingScreen = document.getElementById('loadingScreen');
  const appShell = document.getElementById('appShell');
  const navList = document.getElementById('navList');
  const usernameLabel = document.getElementById('usernameLabel');
  const roleBadge = document.getElementById('roleBadge');
  const adminLink = document.getElementById('adminLink');
  const logoutBtn = document.getElementById('logoutBtn');
  const pageTitle = document.getElementById('pageTitle');
  const mobileTitle = document.getElementById('mobileTitle');
  const frameWrap = document.getElementById('frameWrap');
  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('menuToggle');

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

  usernameLabel.textContent = me.username;
  roleBadge.textContent = me.role === 'admin' ? 'مطوّر' : 'مستخدم';
  if (me.role === 'admin') adminLink.style.display = 'block';

  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  menuToggle?.addEventListener('click', () => sidebar.classList.toggle('open'));

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
    navList.innerHTML = '';
    pages.forEach((p) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'nav-item' + (p.slug === activeSlug ? ' active' : '');
      btn.innerHTML = `<span class="icon">${p.icon || '📄'}</span><span>${escapeHtml(p.title)}</span>`;
      btn.addEventListener('click', () => openPage(p));
      li.appendChild(btn);
      navList.appendChild(li);
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
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

  renderNav(null);

  // فتح صفحة من الهاش لو موجود، أو أول صفحة تلقائيًا
  const hashSlug = window.location.hash.replace('#', '');
  const initial = pages.find((p) => p.slug === hashSlug) || pages[0];
  if (initial) openPage(initial);

  loadingScreen.style.display = 'none';
  appShell.style.display = 'flex';
})();
