const express = require('express');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  // Everyone can see all tags. Owner info is included so the UI can
  // show edit/delete only to the owner.
  const rows = db.prepare(`
    SELECT t.*, u.username AS owner_username
    FROM tags t
    JOIN users u ON u.user_id = t.user_id
    ORDER BY u.username, t.tag_name`).all();
  res.json(rows);
});

router.post('/', requireAuth, (req, res) => {
  const { tag_name, description } = req.body || {};
  if (!tag_name) return res.status(400).json({ error: 'tag_name required' });
  try {
    const info = db.prepare('INSERT INTO tags(user_id, tag_name, description) VALUES (?,?,?)')
      .run(req.session.userId, tag_name.trim(), description || null);
    res.json({ tag_id: info.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE'))
      return res.status(400).json({ error: 'Tag already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM tags WHERE tag_id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  if (t.user_id !== req.session.userId)
    return res.status(403).json({ error: 'You can only edit your own tags' });
  const { tag_name, description } = req.body || {};
  db.prepare('UPDATE tags SET tag_name=?, description=? WHERE tag_id=?')
    .run(tag_name ?? t.tag_name, description ?? t.description, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM tags WHERE tag_id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  if (t.user_id !== req.session.userId)
    return res.status(403).json({ error: 'You can only delete your own tags' });
  db.prepare('DELETE FROM tags WHERE tag_id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
