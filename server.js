const express = require('express');
const session = require('express-session');
const path = require('path');
require('./db/init');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-please',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/folders', require('./routes/folders'));
app.use('/api/users', require('./routes/users'));

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`Notes app on http://localhost:${PORT}`));
