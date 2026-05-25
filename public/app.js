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
const state = { user: null, tags: [], folders: [], notes: [], filter: 'all', folderFilter: null };

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
    ? `<span>Hi, <b>${escapeHtml(state.user.username)}</b></span>
       <button id="logout">Logout</button>`
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
  loadTags(); loadFolders(); loadNotes();
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
    return `<li title="by ${escapeHtml(t.owner_username)}">
      <span>#${escapeHtml(t.tag_name)}${own ? '' : ` <small style="color:var(--muted)">· ${escapeHtml(t.owner_username)}</small>`}</span>
      ${own ? `<button class="del" data-id="${t.tag_id}" title="Delete">×</button>` : ''}
    </li>`;
  }).join('') || '<li style="color:var(--muted);font-size:.85rem">No tags yet</li>';
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
  const allItem = `<li class="folder-item ${state.folderFilter === null ? 'active' : ''}" data-id="">
      <span class="name">📂 All</span></li>`;
  ul.innerHTML = allItem + (state.folders.map(f => {
    const own = state.user && f.user_id === state.user.user_id;
    return `<li class="folder-item ${state.folderFilter == f.folder_id ? 'active' : ''}" data-id="${f.folder_id}" title="by ${escapeHtml(f.owner_username)}">
      <span class="name">📁 ${escapeHtml(f.folder_name)}${own ? '' : ` <small style="color:var(--muted)">· ${escapeHtml(f.owner_username)}</small>`}</span>
      ${own ? `<button class="del" data-id="${f.folder_id}" title="Delete">×</button>` : ''}
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

/* ---------- Notes list ---------- */
document.querySelectorAll('.filter').forEach(b => b.onclick = () => {
  document.querySelectorAll('.filter').forEach(x => x.classList.toggle('active', x === b));
  state.filter = b.dataset.filter;
  if (state.filter === 'all') state.folderFilter = null;
  loadFolders(); loadNotes();
});

async function loadNotes() {
  let url = state.filter === 'mine' ? '/notes/mine' : '/notes';
  if (state.folderFilter !== null) {
    url += '?folder_id=' + state.folderFilter;
  }
  state.notes = await api(url);
  const list = $('#notes-list');
  if (!state.notes.length) {
    list.innerHTML = `<p style="color:var(--muted)">No notes yet. Create one!</p>`;
    return;
  }
  list.innerHTML = state.notes.map(n => {
    const own = state.user && n.user_id === state.user.user_id;
    return `<div class="note" data-id="${n.note_id}">
      <h4>${escapeHtml(n.title)}</h4>
      <p class="snippet">${escapeHtml(n.content || '')}</p>
      <div class="badges">
        ${own ? '<span class="badge own">yours</span>' : ''}
        ${n.folder ? `<span class="badge">📁 ${escapeHtml(n.folder.folder_name)}</span>` : ''}
        ${n.tags.map(t => `<span class="badge">#${escapeHtml(t.tag_name)}</span>`).join('')}
      </div>
      <div class="meta">
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
    <div class="note-view">
      <h2>${escapeHtml(note.title)}</h2>
      <div class="author">by ${escapeHtml(note.author)} · ${new Date(note.created_at).toLocaleString()}</div>
      <div class="badges">
        ${note.tags.map(t => `<span class="badge">#${escapeHtml(t.tag_name)}</span>`).join('')}
      </div>
      <div class="content">${escapeHtml(note.content || '')}</div>
      ${own ? `<div class="actions">
        <button id="edit-btn">Edit</button>
        <button id="del-btn" class="danger">Delete</button>
      </div>` : ''}
      <div class="comments">
        <h3>Comments (${note.comments.length})</h3>
        <div id="comments-list">
          ${note.comments.map(c => `
            <div class="comment">
              ${state.user && c.user_id === state.user.user_id
                ? `<button class="del-c" data-cid="${c.comment_id}">×</button>` : ''}
              <span class="who">${escapeHtml(c.username)}</span>
              <span class="when">${new Date(c.created_at).toLocaleString()}</span>
              <div>${escapeHtml(c.comment_text)}</div>
            </div>`).join('') || '<p style="color:var(--muted);font-size:.85rem">No comments yet.</p>'}
        </div>
        ${state.user ? `<form id="comment-form">
          <textarea name="text" placeholder="Add a comment…" required></textarea>
          <button>Post</button>
        </form>` : ''}
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
    <h2>${note ? 'Edit note' : 'New note'}</h2>
    <form id="note-form" class="note-form" style="margin-top:1rem">
      <input name="title" placeholder="Title" required value="${escapeHtml(note?.title || '')}" />
      <textarea name="content" placeholder="Write your note…">${escapeHtml(note?.content || '')}</textarea>
      <label>Folder</label>
      <select name="folder_id" style="padding:.5rem;border:1px solid var(--line);border-radius:6px;background:#fff">
        <option value="">— No folder —</option>
        ${myFolders.map(f => `<option value="${f.folder_id}" ${currentFolder == f.folder_id ? 'selected' : ''}>📁 ${escapeHtml(f.folder_name)}</option>`).join('')}
      </select>
      <label>Tags</label>
      <div class="tag-pick">
        ${myTags.length ? myTags.map(t => `
          <label><input type="checkbox" value="${t.tag_id}" ${selectedIds.has(t.tag_id) ? 'checked' : ''} />#${escapeHtml(t.tag_name)}</label>
        `).join('') : '<span style="color:var(--muted);font-size:.85rem">No tags. Create some in the sidebar.</span>'}
      </div>
      <button class="primary" type="submit">${note ? 'Save changes' : 'Create note'}</button>
    </form>`;
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
