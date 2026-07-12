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

  const editModal = document.getElementById('editModal');
  const editModalTitle = document.getElementById('editModalTitle');
  const editError = document.getElementById('editError');
  const editTitle = document.getElementById('editTitle');
  const editIcon = document.getElementById('editIcon');
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
        <td>${escapeHtml(u.username)}</td>
        <td>${u.role === 'admin' ? '🛠️ مطوّر' : 'مستخدم'}</td>
        <td style="font-size:12px; color:#7a6f5c;">${escapeHtml(u.created_at)}</td>
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
      editContentField.style.display = 'none';
      replaceFileField.style.display = 'block';
    } else {
      editModalTitle.textContent = 'تعديل: ' + data.page.title;
      editTitle.value = data.page.title;
      editIcon.value = data.page.icon;
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

  await Promise.all([loadPages(), loadUsers()]);

  loadingScreen.style.display = 'none';
  adminRoot.style.display = 'block';
})();
