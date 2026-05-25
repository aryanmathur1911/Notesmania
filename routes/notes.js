const express = require('express');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// helper: attach tags + author + comment count
function enrichNote(n) {
  const author = db.prepare('SELECT username FROM users WHERE user_id=?').get(n.user_id);
  const tags = db.prepare(`
    SELECT t.tag_id, t.tag_name FROM tags t
    JOIN note_tags nt ON nt.tag_id=t.tag_id
    WHERE nt.note_id=?`).all(n.note_id);
  const cnt = db.prepare('SELECT COUNT(*) AS c FROM comments WHERE note_id=?').get(n.note_id).c;
  let folder = null;
  if (n.folder_id) {
    folder = db.prepare('SELECT folder_id, folder_name FROM folders WHERE folder_id=?').get(n.folder_id);
  }
  return { ...n, author: author ? author.username : 'unknown', tags, folder, comment_count: cnt };
}

// list all notes (any user can view)
router.get('/', (req, res) => {
  const { folder_id, user_id } = req.query;
  const conditions = [];
  const params = [];
  if (user_id) {
    conditions.push('user_id = ?');
    params.push(user_id);
  }
  if (folder_id) {
    conditions.push('folder_id = ?');
    params.push(folder_id);
  }
  const sql = `SELECT * FROM notes${conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''} ORDER BY updated_at DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(enrichNote));
});

// my notes
router.get('/mine', requireAuth, (req, res) => {
  const { folder_id } = req.query;
  let rows;
  if (folder_id) {
    rows = db.prepare('SELECT * FROM notes WHERE user_id=? AND folder_id=? ORDER BY updated_at DESC')
      .all(req.session.userId, folder_id);
  } else {
    rows = db.prepare('SELECT * FROM notes WHERE user_id=? ORDER BY updated_at DESC')
      .all(req.session.userId);
  }
  res.json(rows.map(enrichNote));
});

// single note + comments
router.get('/:id', (req, res) => {
  const n = db.prepare('SELECT * FROM notes WHERE note_id=?').get(req.params.id);
  if (!n) return res.status(404).json({ error: 'Not found' });
  const comments = db.prepare(`
    SELECT c.*, u.username FROM comments c
    JOIN users u ON u.user_id=c.user_id
    WHERE note_id=? ORDER BY c.created_at ASC`).all(req.params.id);
  res.json({ ...enrichNote(n), comments });
});

// create
router.post('/', requireAuth, (req, res) => {
  const { title, content, folder_id, tag_ids } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });
  const info = db.prepare(
    'INSERT INTO notes (user_id, folder_id, title, content) VALUES (?,?,?,?)'
  ).run(req.session.userId, folder_id || null, title, content || '');
  const noteId = info.lastInsertRowid;
  if (Array.isArray(tag_ids)) {
    const ins = db.prepare('INSERT OR IGNORE INTO note_tags(note_id, tag_id) VALUES (?,?)');
    for (const tid of tag_ids) {
      // only allow user's own tags
      const t = db.prepare('SELECT tag_id FROM tags WHERE tag_id=? AND user_id=?')
        .get(tid, req.session.userId);
      if (t) ins.run(noteId, tid);
    }
  }
  res.json({ note_id: noteId });
});

// update (owner only)
router.put('/:id', requireAuth, (req, res) => {
  const n = db.prepare('SELECT * FROM notes WHERE note_id=?').get(req.params.id);
  if (!n) return res.status(404).json({ error: 'Not found' });
  if (n.user_id !== req.session.userId)
    return res.status(403).json({ error: 'You can only edit your own notes' });
  const { title, content, folder_id, tag_ids } = req.body || {};
  const newFolderId = ('folder_id' in (req.body || {})) ? folder_id : n.folder_id;
  db.prepare(`UPDATE notes SET title=?, content=?, folder_id=?, updated_at=CURRENT_TIMESTAMP
              WHERE note_id=?`)
    .run(title ?? n.title, content ?? n.content, newFolderId, req.params.id);
  if (Array.isArray(tag_ids)) {
    db.prepare('DELETE FROM note_tags WHERE note_id=?').run(req.params.id);
    const ins = db.prepare('INSERT OR IGNORE INTO note_tags(note_id, tag_id) VALUES (?,?)');
    for (const tid of tag_ids) {
      const t = db.prepare('SELECT tag_id FROM tags WHERE tag_id=? AND user_id=?')
        .get(tid, req.session.userId);
      if (t) ins.run(req.params.id, tid);
    }
  }
  res.json({ ok: true });
});

// delete (owner only)
router.delete('/:id', requireAuth, (req, res) => {
  const n = db.prepare('SELECT * FROM notes WHERE note_id=?').get(req.params.id);
  if (!n) return res.status(404).json({ error: 'Not found' });
  if (n.user_id !== req.session.userId)
    return res.status(403).json({ error: 'You can only delete your own notes' });
  db.prepare('DELETE FROM notes WHERE note_id=?').run(req.params.id);
  res.json({ ok: true });
});

// add comment (any logged-in user)
router.post('/:id/comments', requireAuth, (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
  const n = db.prepare('SELECT note_id FROM notes WHERE note_id=?').get(req.params.id);
  if (!n) return res.status(404).json({ error: 'Note not found' });
  db.prepare('INSERT INTO comments(note_id, user_id, comment_text) VALUES (?,?,?)')
    .run(req.params.id, req.session.userId, text.trim());
  res.json({ ok: true });
});

// delete own comment
router.delete('/:noteId/comments/:cid', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM comments WHERE comment_id=?').get(req.params.cid);
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (c.user_id !== req.session.userId)
    return res.status(403).json({ error: 'Not your comment' });
  db.prepare('DELETE FROM comments WHERE comment_id=?').run(req.params.cid);
  res.json({ ok: true });
});

module.exports = router;
