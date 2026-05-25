const express = require('express');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const users = db.prepare('SELECT user_id, username, email, created_at FROM users ORDER BY username').all();
  const data = users.map((user) => {
    const folders = db.prepare('SELECT folder_id, folder_name FROM folders WHERE user_id=? ORDER BY folder_name').all(user.user_id);
    const tags = db.prepare('SELECT tag_id, tag_name FROM tags WHERE user_id=? ORDER BY tag_name').all(user.user_id);
    const notes = db.prepare('SELECT note_id, title, folder_id, created_at, updated_at FROM notes WHERE user_id=? ORDER BY updated_at DESC').all(user.user_id);
    return {
      ...user,
      folder_count: folders.length,
      tag_count: tags.length,
      note_count: notes.length,
      folders,
      tags,
      notes,
    };
  });
  res.json(data);
});

module.exports = router;
