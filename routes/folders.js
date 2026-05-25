const express = require('express');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  // Everyone can see all folders. Owner info is included so the UI can
  // show edit/delete only to the owner.
  const rows = db.prepare(`
    SELECT f.*, u.username AS owner_username
    FROM folders f
    JOIN users u ON u.user_id = f.user_id
    ORDER BY u.username, f.folder_name`).all();
  res.json(rows);
});

router.post('/', requireAuth, (req, res) => {
  const { folder_name, description } = req.body || {};
  if (!folder_name) return res.status(400).json({ error: 'folder_name required' });
  const info = db.prepare('INSERT INTO folders(user_id, folder_name, description) VALUES (?,?,?)')
    .run(req.session.userId, folder_name.trim(), description || null);
  res.json({ folder_id: info.lastInsertRowid });
});

router.delete('/:id', requireAuth, (req, res) => {
  const f = db.prepare('SELECT * FROM folders WHERE folder_id=?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Not found' });
  if (f.user_id !== req.session.userId)
    return res.status(403).json({ error: 'You can only delete your own folders' });
  db.prepare('DELETE FROM folders WHERE folder_id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
