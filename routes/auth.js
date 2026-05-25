const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/init');
const router = express.Router();

router.post('/register', (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password)
    return res.status(400).json({ error: 'username, email, password required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare(
      'INSERT INTO users (username, email, password) VALUES (?,?,?)'
    ).run(username.trim(), email.trim().toLowerCase(), hash);
    req.session.userId = info.lastInsertRowid;
    req.session.username = username.trim();
    res.json({ user_id: info.lastInsertRowid, username, email });
  } catch (e) {
    if (String(e.message).includes('UNIQUE'))
      return res.status(400).json({ error: 'Username or email already taken' });
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'username and password required' });
  const user = db.prepare(
    'SELECT * FROM users WHERE username = ? OR email = ?'
  ).get(username, username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid credentials' });
  req.session.userId = user.user_id;
  req.session.username = user.username;
  res.json({ user_id: user.user_id, username: user.username, email: user.email });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const u = db.prepare('SELECT user_id, username, email FROM users WHERE user_id=?')
    .get(req.session.userId);
  res.json({ user: u });
});

module.exports = router;
