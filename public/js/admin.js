// public/js/admin.js
(async function () {
  const loadingScreen = document.getElementById('loadingScreen');
  const adminRoot = document.getElementById('adminRoot');
  const pagesBody = document.getElementById('pagesBody');
  const usersBody = document.getElementById('usersBody');
  const logoutBtn = document.getElementById('logoutBtn');

  const uploadForm = document.getElementById('uploadForm');
  const uploadError = document.getElementById('uploadError');
  const uploadSuccess = document.getElementById('uploadSuccess');
  const uploadBtn = document.getElementById('uploadBtn');

  const studentsSummary = document.getElementById('studentsSummary');
  const studentsBody = document.getElementById('studentsBody');
  const studentsEmpty = document.getElementById('studentsEmpty');
  const studentSearch = document.getElementById('studentSearch');

  const studentModal = document.getElementById('studentModal');
  const closeStudentModal = document.getElementById('closeStudentModal');
  const sdAvatar = document.getElementById('sdAvatar');
  const sdName = document.getElementById('sdName');
  const sdEmail = document.getElementById('sdEmail');
  const sdPercent = document.getElementById('sdPercent');
  const sdCount = document.getElementById('sdCount');
  const sdActive = document.getElementById('sdActive');
  const sdJoined = document.getElementById('sdJoined');
  const sdBar = document.getElementById('sdBar');
  const sdVerses = document.getElementById('sdVerses');

  const editModal = document.getElementById('editModal');
  const editModalTitle = document.getElementById('editModalTitle');
  const editError = document.getElementById('editError');
  const editTitle = document.getElementById('editTitle');
  const editIcon = document.getElementById('editIcon');
  const editDescription = document.getElementById('editDescription');
  const editContentField = document.getElementById('editContentField');
  const editContent = document.getElementById('editContent');
  const replaceFileField = document.getElementById('replaceFileField');
  const replaceFile = document.getElementById('replaceFile');
  const saveEditBtn = document.getElementById('saveEditBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');

  let currentEditId = null;

  // تأكيد إن المستخدم مطور
  let me;
  try {
    const meRes = await fetch('/api/auth/me');
    me = (await meRes.json()).user;
  } catch (e) {
    me = null;
  }
  if (!me) { window.location.href = '/login.html'; return; }
  if (me.role !== 'admin') { window.location.href = '/index.html'; return; }

  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  const EDITABLE_EXT = ['.html', '.htm', '.txt'];
  function isEditableFile(filename) {
    const ext = '.' + filename.split('.').pop().toLowerCase();
    return EDITABLE_EXT.includes(ext);
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '؟';
    return parts.length === 1 ? parts[0][0] : parts[0][0] + parts[1][0];
  }

  function timeAgo(dateStr) {
    if (!dateStr) return 'لا يوجد';
    const then = new Date(dateStr.replace(' ', 'T') + 'Z');
    const diffMs = Date.now() - then.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 2) return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} ساعة`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `منذ ${days} يوم`;
    return then.toLocaleDateString('ar-EG');
  }

  function activityBadge(lastActive) {
    if (!lastActive) return `<span class="badge offline">لم يبدأ بعد</span>`;
    const then = new Date(lastActive.replace(' ', 'T') + 'Z');
    const mins = (Date.now() - then.getTime()) / 60000;
    if (mins < 10) return `<span class="badge online">نشط الآن</span>`;
    if (mins < 60 * 24) return `<span class="badge idle">${timeAgo(lastActive)}</span>`;
    return `<span class="badge offline">${timeAgo(lastActive)}</span>`;
  }

  let allStudents = [];

  async function loadStudentsProgress() {
    const res = await fetch('/api/admin/students-progress');
    const data = await res.json();
    allStudents = data.students || [];

    const s = data.summary || {};
    studentsSummary.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">عدد الطلاب</div>
        <div class="stat-value">${s.totalStudents ?? 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">متوسط نسبة الحفظ</div>
        <div class="stat-value">${s.avgPercent ?? 0}٪</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">أتمّوا المنظومة</div>
        <div class="stat-value">${s.completedCount ?? 0}</div>
        <div class="stat-sub">من أصل ${s.totalStudents ?? 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">لم يبدأوا بعد</div>
        <div class="stat-value">${s.notStartedCount ?? 0}</div>
      </div>
    `;

    renderStudentsTable(allStudents);
  }

  function renderStudentsTable(list) {
    studentsEmpty.style.display = list.length ? 'none' : 'block';
    studentsBody.innerHTML = list
      .map(
        (st) => `
      <tr data-id="${st.id}">
        <td>
          <div class="student-name-cell">
            <span class="avatar sm">${escapeHtml(initials(st.name))}</span>
            <div class="name-block">
              <div class="n">${escapeHtml(st.name)}</div>
              <div class="e">${escapeHtml(st.email)}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="progress-cell">
            <div class="mini-bar"><span style="width:${st.percent}%"></span></div>
            <span class="pcnt">${st.percent}٪</span>
            ${st.percent === 100 ? '<span class="badge complete">مكتمل ✓</span>' : ''}
          </div>
          <div style="font-size:11px; color:var(--sub); margin-top:4px;">${st.memorized} من ${st.total} بيتًا</div>
        </td>
        <td style="font-size:12px; color:var(--sub);">${st.last_memorized_at ? timeAgo(st.last_memorized_at) : 'لا يوجد'}</td>
        <td>${activityBadge(st.last_active_at)}</td>
        <td style="font-size:12px; color:var(--sub);">${st.created_at ? st.created_at.slice(0, 10) : '—'}</td>
        <td class="row-actions"><button data-action="view-student" data-id="${st.id}">التفاصيل</button></td>
      </tr>`
      )
      .join('');
  }

  studentSearch?.addEventListener('input', () => {
    const q = studentSearch.value.trim().toLowerCase();
    if (!q) return renderStudentsTable(allStudents);
    renderStudentsTable(
      allStudents.filter(
        (st) => st.name.toLowerCase().includes(q) || st.email.toLowerCase().includes(q)
      )
    );
  });

  studentsBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action="view-student"]');
    if (!btn) return;
    await openStudentModal(btn.dataset.id);
  });

  async function openStudentModal(id) {
    const res = await fetch(`/api/admin/students/${id}/progress`);
    if (!res.ok) return alert('تعذّر تحميل تفاصيل الطالب');
    const data = await res.json();

    sdAvatar.textContent = initials(data.student.name);
    sdName.textContent = data.student.name;
    sdEmail.textContent = data.student.email;
    sdPercent.textContent = data.stats.percent + '٪';
    sdCount.textContent = `${data.stats.memorized} من ${data.stats.total}`;
    sdActive.textContent = timeAgo(data.student.last_active_at);
    sdJoined.textContent = data.student.created_at ? data.student.created_at.slice(0, 10) : '—';
    sdBar.style.width = data.stats.percent + '%';

    sdVerses.innerHTML = data.items
      .map(
        (it) => `
      <div class="sv-item ${it.memorized ? 'done' : ''}">
        <span class="sv-num">${it.id}</span>
        <span class="sv-title">${escapeHtml(it.title)}</span>
        ${it.memorized ? '✓' : ''}
      </div>`
      )
      .join('');

    studentModal.style.display = 'flex';
  }

  closeStudentModal.addEventListener('click', () => { studentModal.style.display = 'none'; });
  studentModal.addEventListener('click', (e) => { if (e.target === studentModal) studentModal.style.display = 'none'; });

  async function loadPages() {
    const res = await fetch('/api/content/pages');
    const data = await res.json();
    const pages = data.pages || [];
    pagesBody.innerHTML = '';
    pages.forEach((p) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.sort_order}</td>
        <td>${escapeHtml(p.icon)}</td>
        <td>${escapeHtml(p.title)}</td>
        <td style="direction:ltr; text-align:left; color:#7a6f5c; font-size:12px;">${escapeHtml(p.slug)}</td>
        <td style="font-size:12px; color:#7a6f5c;">${escapeHtml(p.updated_at)}</td>
        <td class="row-actions">
          <button data-action="edit" data-id="${p.id}">تعديل</button>
          <button data-action="view" data-slug="${p.slug}">معاينة</button>
          <button data-action="del" data-id="${p.id}" class="del">حذف</button>
        </td>
      `;
      pagesBody.appendChild(tr);
    });
  }

  async function loadUsers() {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    usersBody.innerHTML = '';
    (data.users || []).forEach((u) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.id}</td>
        <td>${escapeHtml(u.name)}</td>
        <td style="direction:ltr; text-align:left;">${escapeHtml(u.email)}</td>
        <td>${u.role === 'admin' ? '🛠️ مطوّر' : 'طالب'}</td>
        <td style="font-size:12px; color:var(--sub);">${escapeHtml(u.created_at)}</td>
      `;
      usersBody.appendChild(tr);
    });
  }

  // رفع ملف جديد
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    uploadError.style.display = 'none';
    uploadSuccess.style.display = 'none';
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'جاري الرفع...';

    try {
      const fd = new FormData();
      fd.append('title', document.getElementById('uTitle').value);
      fd.append('icon', document.getElementById('uIcon').value || '📄');
      fd.append('description', document.getElementById('uDescription').value || '');
      fd.append('file', document.getElementById('uFile').files[0]);

      const res = await fetch('/api/admin/pages', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل رفع الملف');

      uploadSuccess.textContent = 'تم رفع الصفحة بنجاح ✅';
      uploadSuccess.style.display = 'block';
      uploadForm.reset();
      await loadPages();
    } catch (err) {
      uploadError.textContent = err.message;
      uploadError.style.display = 'block';
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'رفع الملف';
    }
  });

  // إجراءات الجدول (تعديل / معاينة / حذف)
  pagesBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'view') {
      window.open(`/api/content/pages/${btn.dataset.slug}`, '_blank');
      return;
    }

    if (action === 'del') {
      if (!confirm('متأكد إنك عايز تحذف الصفحة دي؟ الإجراء ده لا يمكن التراجع عنه.')) return;
      const res = await fetch(`/api/admin/pages/${btn.dataset.id}`, { method: 'DELETE' });
      if (res.ok) await loadPages();
      else alert('تعذر حذف الصفحة');
      return;
    }

    if (action === 'edit') {
      openEditModal(btn.dataset.id);
    }
  });

  async function openEditModal(id) {
    editError.style.display = 'none';
    currentEditId = id;

    const res = await fetch(`/api/admin/pages/${id}/raw`);
    const data = await res.json();

    if (!res.ok) {
      // ملف مش قابل للتعديل كنص (صورة/pdf) - نعرض بس استبدال الملف
      const pageRes = await fetch('/api/content/pages');
      const allPages = (await pageRes.json()).pages || [];
      const page = allPages.find((p) => String(p.id) === String(id));
      editModalTitle.textContent = 'تعديل: ' + (page ? page.title : '');
      editTitle.value = page ? page.title : '';
      editIcon.value = page ? page.icon : '';
      editDescription.value = page ? (page.description || '') : '';
      editContentField.style.display = 'none';
      replaceFileField.style.display = 'block';
    } else {
      editModalTitle.textContent = 'تعديل: ' + data.page.title;
      editTitle.value = data.page.title;
      editIcon.value = data.page.icon;
      editDescription.value = data.page.description || '';
      editContent.value = data.content;
      editContentField.style.display = 'block';
      replaceFileField.style.display = 'block';
    }

    editModal.style.display = 'flex';
  }

  cancelEditBtn.addEventListener('click', () => {
    editModal.style.display = 'none';
    currentEditId = null;
  });

  saveEditBtn.addEventListener('click', async () => {
    editError.style.display = 'none';
    saveEditBtn.disabled = true;
    saveEditBtn.textContent = 'جاري الحفظ...';

    try {
      // لو المطور اختار ملف بديل، نرفعه الأول
      if (replaceFile.files && replaceFile.files[0]) {
        const fd = new FormData();
        fd.append('file', replaceFile.files[0]);
        const r = await fetch(`/api/admin/pages/${currentEditId}/file`, { method: 'PUT', body: fd });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'فشل استبدال الملف');
      }

      const body = {
        title: editTitle.value,
        icon: editIcon.value,
        description: editDescription.value,
      };
      if (editContentField.style.display !== 'none') {
        body.content = editContent.value;
      }

      const res = await fetch(`/api/admin/pages/${currentEditId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حفظ التعديلات');

      editModal.style.display = 'none';
      replaceFile.value = '';
      await loadPages();
    } catch (err) {
      editError.textContent = err.message;
      editError.style.display = 'block';
    } finally {
      saveEditBtn.disabled = false;
      saveEditBtn.textContent = 'حفظ التعديلات';
    }
  });

  await Promise.all([loadPages(), loadUsers(), loadStudentsProgress()]);

  loadingScreen.style.display = 'none';
  adminRoot.style.display = 'block';
})();
