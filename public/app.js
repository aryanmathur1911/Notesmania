const api = (path, opts = {}) =>
  fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Error');
    return data;
  });

const $ = (sel) => document.querySelector(sel);
const state = { user: null, tags: [], folders: [], notes: [], users: [], filter: 'all', folderFilter: null, selectedUserId: null };

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Auth ---------- */
async function init() {
  const { user } = await api('/auth/me');
  state.user = user;
  renderNav();
  if (user) showApp(); else showAuth();
}

function renderNav() {
  const n = $('#nav');
  n.innerHTML = state.user
    ? `<div class="inline-flex flex-wrap items-center gap-3 rounded-full border border-slate-700 bg-slate-900/90 px-3 py-2 shadow-lg"><span class="text-sm text-slate-100">Hi, <b>${escapeHtml(state.user.username)}</b></span><button id="logout" class="rounded-full border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700">Logout</button></div>`
    : '';
  if (state.user) $('#logout').onclick = async () => {
    await api('/auth/logout', { method: 'POST' });
    state.user = null; renderNav(); showAuth();
  };
}

function showAuth() {
  $('#auth-view').classList.remove('hidden');
  $('#main-view').classList.add('hidden');
}
function showApp() {
  $('#auth-view').classList.add('hidden');
  $('#main-view').classList.remove('hidden');
  loadTags(); loadFolders(); loadUsers(); loadNotes();
}

document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
  $('#login-form').classList.toggle('hidden', t.dataset.tab !== 'login');
  $('#register-form').classList.toggle('hidden', t.dataset.tab !== 'register');
});

$('#login-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    state.user = await api('/auth/login', { method: 'POST', body: Object.fromEntries(f) });
    $('#login-error').textContent = '';
    renderNav(); showApp();
  } catch (err) { $('#login-error').textContent = err.message; }
};

$('#register-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    state.user = await api('/auth/register', { method: 'POST', body: Object.fromEntries(f) });
    $('#register-error').textContent = '';
    renderNav(); showApp();
  } catch (err) { $('#register-error').textContent = err.message; }
};

/* ---------- Tags ---------- */
async function loadTags() {
  state.tags = await api('/tags');
  const ul = $('#tag-list');
  ul.innerHTML = state.tags.map(t => {
    const own = state.user && t.user_id === state.user.user_id;
    return `<li class="flex items-center justify-between gap-3 rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 shadow-sm transition hover:shadow-lg" title="by ${escapeHtml(t.owner_username)}">
      <span class="text-sm text-slate-100">#${escapeHtml(t.tag_name)}${own ? '' : ` <span class="text-slate-500">· ${escapeHtml(t.owner_username)}</span>`}</span>
      ${own ? `<button class="del text-slate-400 transition hover:text-rose-400" data-id="${t.tag_id}" title="Delete">×</button>` : ''}
    </li>`;
  }).join('') || '<li class="text-slate-500 text-sm">No tags yet</li>';
  ul.querySelectorAll('.del').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this tag?')) return;
    await api('/tags/' + b.dataset.id, { method: 'DELETE' });
    loadTags();
  });
}

$('#tag-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try { await api('/tags', { method: 'POST', body: Object.fromEntries(f) }); }
  catch (err) { alert(err.message); }
  e.target.reset(); loadTags();
};

/* ---------- Folders ---------- */
async function loadFolders() {
  state.folders = await api('/folders');
  const ul = $('#folder-list');
  const allItem = `<li class="folder-item flex items-center justify-between gap-3 rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 shadow-sm transition hover:shadow-lg ${state.folderFilter === null ? 'ring-2 ring-sky-400/30' : ''}" data-id="">
      <span class="name text-sm text-slate-100">📂 All</span></li>`;
  ul.innerHTML = allItem + (state.folders.map(f => {
    const own = state.user && f.user_id === state.user.user_id;
    return `<li class="folder-item flex items-center justify-between gap-3 rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 shadow-sm transition hover:shadow-lg ${state.folderFilter == f.folder_id ? 'ring-2 ring-sky-400/30' : ''}" data-id="${f.folder_id}" title="by ${escapeHtml(f.owner_username)}">
      <span class="name text-sm text-slate-100">📁 ${escapeHtml(f.folder_name)}${own ? '' : ` <span class="text-slate-500">· ${escapeHtml(f.owner_username)}</span>`}</span>
      ${own ? `<button class="del text-slate-400 transition hover:text-rose-400" data-id="${f.folder_id}" title="Delete">×</button>` : ''}
    </li>`;
  }).join(''));
  ul.querySelectorAll('.folder-item').forEach(li => li.onclick = (e) => {
    if (e.target.classList.contains('del')) return;
    const id = li.dataset.id;
    state.folderFilter = id ? parseInt(id) : null;
    loadFolders(); loadNotes();
  });
  ul.querySelectorAll('.del').forEach(b => b.onclick = async (e) => {
    e.stopPropagation();
    if (!confirm('Delete this folder? Notes inside will become unfiled.')) return;
    await api('/folders/' + b.dataset.id, { method: 'DELETE' });
    if (state.folderFilter == b.dataset.id) state.folderFilter = null;
    loadFolders(); loadNotes();
  });
}

$('#folder-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try { await api('/folders', { method: 'POST', body: Object.fromEntries(f) }); }
  catch (err) { alert(err.message); }
  e.target.reset(); loadFolders();
};

async function loadUsers() {
  state.users = await api('/users');
  renderUsers();
}

function selectUser(id) {
  state.selectedUserId = state.selectedUserId === id ? null : id;
  renderUsers();
  loadNotes();
}

function renderUsers() {
  const panel = $('#user-panel');
  if (!panel) return;
  const selected = state.users.find(u => u.user_id === state.selectedUserId);
  panel.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Users</h3>
        <p class="mt-2 text-sm text-slate-500">Browse creators and inspect their notes, folders, and tags.</p>
      </div>
      ${selected ? `<button id="clear-user-filter" class="text-sm font-semibold text-sky-300 transition hover:text-white">Clear</button>` : ''}
    </div>
    <div class="space-y-3">
      ${state.users.map(u => `
        <button type="button" class="user-card w-full rounded-3xl border px-4 py-4 text-left transition ${state.selectedUserId === u.user_id ? 'border-sky-400 bg-slate-800 shadow-xl' : 'border-slate-700/60 bg-slate-950/80 hover:border-slate-500'}" data-id="${u.user_id}">
          <div class="flex items-center justify-between gap-3">
            <span class="font-semibold text-slate-100">${escapeHtml(u.username)}</span>
            <span class="text-xs text-slate-400">${u.note_count} notes</span>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 text-[0.75rem] text-slate-400">
            <span>${u.folder_count} folders</span>
            <span>${u.tag_count} tags</span>
            <span>${new Date(u.created_at).toLocaleDateString()}</span>
          </div>
        </button>
      `).join('')}
    </div>
    ${selected ? `
      <div class="selected-user-details mt-6 rounded-3xl border border-slate-700/60 bg-slate-950/80 p-4">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h4 class="text-lg font-semibold text-slate-100">${escapeHtml(selected.username)}</h4>
            <p class="mt-1 text-sm text-slate-500">${selected.note_count} notes · ${selected.folder_count} folders · ${selected.tag_count} tags</p>
          </div>
          <span class="rounded-full bg-slate-800 px-3 py-1 text-xs text-sky-300">Selected</span>
        </div>
        ${selected.folders.length ? `<div class="mt-4"><h5 class="text-xs uppercase tracking-[0.18em] text-slate-500">Folders</h5><div class="mt-3 flex flex-wrap gap-2">${selected.folders.map(f => `<span class="badge small">📁 ${escapeHtml(f.folder_name)}</span>`).join('')}</div></div>` : ''}
        ${selected.tags.length ? `<div class="mt-4"><h5 class="text-xs uppercase tracking-[0.18em] text-slate-500">Tags</h5><div class="mt-3 flex flex-wrap gap-2">${selected.tags.map(t => `<span class="badge small">#${escapeHtml(t.tag_name)}</span>`).join('')}</div></div>` : ''}
      </div>
    ` : ''}
  `;
  panel.querySelectorAll('.user-card').forEach(btn => btn.onclick = () => selectUser(parseInt(btn.dataset.id)));
  const clear = $('#clear-user-filter');
  if (clear) clear.onclick = () => selectUser(state.selectedUserId);
}

/* ---------- Notes list ---------- */
document.querySelectorAll('.filter').forEach(b => b.onclick = () => {
  document.querySelectorAll('.filter').forEach(x => x.classList.toggle('active', x === b));
  state.filter = b.dataset.filter;
  if (state.filter === 'all') state.folderFilter = null;
  loadFolders(); loadNotes();
});

async function loadNotes() {
  let url = state.filter === 'mine' ? '/notes/mine' : '/notes';
  const query = [];
  if (state.folderFilter !== null) query.push('folder_id=' + state.folderFilter);
  if (state.selectedUserId && state.filter !== 'mine') query.push('user_id=' + state.selectedUserId);
  if (query.length) url += '?' + query.join('&');
  state.notes = await api(url);
  const toolbar = $('#notes-toolbar');
  const selectedUser = state.users.find(u => u.user_id === state.selectedUserId);
  toolbar.innerHTML = `<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm font-semibold text-slate-100">${state.filter === 'mine' ? 'My notes' : selectedUser ? `${escapeHtml(selectedUser.username)}'s notes` : 'All notes'}</p>
        <p class="text-xs text-slate-500">${state.notes.length} items shown${state.folderFilter ? ' · folder filter active' : ''}</p>
      </div>
      <span class="text-xs text-slate-400">${new Date().toLocaleDateString()}</span>
    </div>`;
  const list = $('#notes-list');
  if (!state.notes.length) {
    list.innerHTML = `<div class="rounded-3xl border border-slate-700/70 bg-slate-950/80 p-10 text-center text-slate-500">No notes found. Create one or choose another user.</div>`;
    return;
  }
  list.innerHTML = state.notes.map(n => {
    const own = state.user && n.user_id === state.user.user_id;
    return `<div class="note cursor-pointer p-5" data-id="${n.note_id}">
      <h4 class="text-lg font-semibold text-slate-100">${escapeHtml(n.title)}</h4>
      <p class="snippet mt-3 text-slate-300">${escapeHtml(n.content || '')}</p>
      <div class="badges mt-4 flex flex-wrap gap-2">
        ${own ? '<span class="badge own">yours</span>' : ''}
        ${n.folder ? `<span class="badge">📁 ${escapeHtml(n.folder.folder_name)}</span>` : ''}
        ${n.tags.map(t => `<span class="badge">#${escapeHtml(t.tag_name)}</span>`).join('')}
      </div>
      <div class="meta mt-4 flex items-center justify-between text-sm text-slate-400">
        <span>by ${escapeHtml(n.author)}</span>
        <span>💬 ${n.comment_count}</span>
      </div>
    </div>`;
  }).join('');
  list.querySelectorAll('.note').forEach(el =>
    el.onclick = () => openNote(parseInt(el.dataset.id)));
}

/* ---------- Modal: view / edit / create note ---------- */
$('#modal-close').onclick = () => $('#modal').classList.add('hidden');
$('#new-note-btn').onclick = () => openEditor(null);

async function openNote(id) {
  const note = await api('/notes/' + id);
  const own = state.user && note.user_id === state.user.user_id;
  $('#modal-body').innerHTML = `
    <div class="note-view space-y-5 text-slate-100">
      <div class="space-y-2">
        <h2 class="text-2xl font-semibold text-white">${escapeHtml(note.title)}</h2>
        <div class="author text-sm text-slate-400">by ${escapeHtml(note.author)} · ${new Date(note.created_at).toLocaleString()}</div>
      </div>
      <div class="badges flex flex-wrap gap-2">${note.tags.map(t => `<span class="badge">#${escapeHtml(t.tag_name)}</span>`).join('')}</div>
      <div class="content rounded-3xl bg-white p-5 text-slate-900">${escapeHtml(note.content || '')}</div>
      ${own ? `<div class="actions flex flex-wrap gap-3"><button id="edit-btn" class="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800">Edit</button><button id="del-btn" class="danger rounded-full border border-rose-500 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20">Delete</button></div>` : ''}
      <div class="comments border-t border-slate-700/60 pt-5">
        <h3 class="text-sm uppercase tracking-[0.16em] text-slate-500">Comments (${note.comments.length})</h3>
        <div id="comments-list" class="space-y-3 mt-4">
          ${note.comments.map(c => `
            <div class="comment relative rounded-3xl bg-slate-950/90 p-4 shadow-lg border border-slate-700/60">
              ${state.user && c.user_id === state.user.user_id ? `<button class="del-c absolute right-4 top-4 text-slate-400 transition hover:text-rose-500" data-cid="${c.comment_id}">×</button>` : ''}
              <div class="flex flex-wrap items-center gap-3">
                <span class="who font-semibold text-slate-100">${escapeHtml(c.username)}</span>
                <span class="when text-xs text-slate-500">${new Date(c.created_at).toLocaleString()}</span>
              </div>
              <div class="mt-3 text-slate-300">${escapeHtml(c.comment_text)}</div>
            </div>`).join('') || '<p class="text-slate-500 text-sm">No comments yet.</p>'}
        </div>
        ${state.user ? `<form id="comment-form" class="mt-4 space-y-3"><textarea name="text" placeholder="Add a comment…" required class="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100"></textarea><button class="primary rounded-full px-5 py-3" type="submit">Post</button></form>` : ''}
      </div>
    </div>`;
  $('#modal').classList.remove('hidden');

  if (own) {
    $('#edit-btn').onclick = () => openEditor(note);
    $('#del-btn').onclick = async () => {
      if (!confirm('Delete this note?')) return;
      await api('/notes/' + id, { method: 'DELETE' });
      $('#modal').classList.add('hidden'); loadNotes();
    };
  }
  document.querySelectorAll('.del-c').forEach(b => b.onclick = async () => {
    await api(`/notes/${id}/comments/${b.dataset.cid}`, { method: 'DELETE' });
    openNote(id);
  });
  const cf = $('#comment-form');
  if (cf) cf.onsubmit = async (e) => {
    e.preventDefault();
    const text = new FormData(e.target).get('text');
    await api(`/notes/${id}/comments`, { method: 'POST', body: { text } });
    openNote(id); loadNotes();
  };
}

function openEditor(note) {
  const selectedIds = new Set((note?.tags || []).map(t => t.tag_id));
  const currentFolder = note?.folder_id || note?.folder?.folder_id || '';
  const myFolders = state.folders.filter(f => f.user_id === state.user.user_id);
  const myTags = state.tags.filter(t => t.user_id === state.user.user_id);
  $('#modal-body').innerHTML = `
    <div class="space-y-5">
      <h2 class="text-2xl font-semibold text-white">${note ? 'Edit note' : 'New note'}</h2>
      <form id="note-form" class="note-form space-y-4">
        <input name="title" placeholder="Title" required value="${escapeHtml(note?.title || '')}" class="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm" />
        <textarea name="content" placeholder="Write your note…" class="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">${escapeHtml(note?.content || '')}</textarea>
        <div class="space-y-2">
          <label class="text-sm font-semibold text-slate-400">Folder</label>
          <select name="folder_id" class="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
            <option value="">— No folder —</option>
            ${myFolders.map(f => `<option value="${f.folder_id}" ${currentFolder == f.folder_id ? 'selected' : ''}>📁 ${escapeHtml(f.folder_name)}</option>`).join('')}
          </select>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-semibold text-slate-400">Tags</label>
          <div class="tag-pick">
            ${myTags.length ? myTags.map(t => `
              <label class="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-white px-4 py-2 text-sm transition hover:border-slate-500">
  <input type="checkbox" class="h-4 w-4 accent-sky-500" value="${t.tag_id}" ${selectedIds.has(t.tag_id) ? 'checked' : ''} />
  <span class="text-black">#${escapeHtml(t.tag_name)}</span>
</label>
            `).join('') : '<span class="text-slate-500 text-sm">No tags. Create some in the sidebar.</span>'}
          </div>
        </div>
        <button class="primary rounded-full px-6 py-3" type="submit">${note ? 'Save changes' : 'Create note'}</button>
      </form>
    </div>`;
  $('#modal').classList.remove('hidden');
  $('#note-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const tag_ids = [...e.target.querySelectorAll('input[type=checkbox]:checked')].map(x => +x.value);
    const folderVal = f.get('folder_id');
    const body = {
      title: f.get('title'),
      content: f.get('content'),
      folder_id: folderVal ? parseInt(folderVal) : null,
      tag_ids,
    };
    try {
      if (note) await api('/notes/' + note.note_id, { method: 'PUT', body });
      else await api('/notes', { method: 'POST', body });
      $('#modal').classList.add('hidden'); loadNotes();
    } catch (err) { alert(err.message); }
  };
}

init();
