# Notes App — Full Stack (Express + SQLite)

Multi-user note-taking app. Uses Node's **built-in SQLite** (`node:sqlite`) — no native compilation, no `node-gyp`, no build tools required.

## Requirements
- **Node.js 22.5+** (Node 24+ recommended — SQLite is stable there)

## Features
- Register / login with bcrypt-hashed passwords
- Each user can create/edit/delete **only their own** notes & tags
- Any logged-in user can **view** all notes and **comment** on them
- Tags, folders, comments — all per the ER diagram
- Vanilla HTML + CSS frontend, Express backend

## Install & Run

```bash
npm install
npm start
```

Then open http://localhost:3000

> If you are on **Node 22.x**, run `node --experimental-sqlite server.js` instead of `npm start`.
> On Node 24+ it just works.

The `notes.db` file is created automatically on first launch.

## Schema (matches ER diagram)
- **users** (user_id, username, email, password, created_at)
- **folders** (folder_id, user_id fk, folder_name, description, created_at)
- **notes** (note_id, user_id fk, folder_id fk, title, content, created_at, updated_at)
- **tags** (tag_id, user_id fk, tag_name, description, created_at)
- **note_tags** (note_id fk, tag_id fk) — M:N relationship
- **comments** (comment_id, note_id fk, user_id fk, comment_text, created_at)

## Tech
- Backend: Node.js + Express + express-session + bcryptjs
- Database: SQLite via `node:sqlite` (built-in)
- Frontend: plain HTML + vanilla CSS + small vanilla JS (fetch)
