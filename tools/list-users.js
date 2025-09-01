// tools/list-users.js
// Usage:
//   node tools/list-users.js

const Database = require('better-sqlite3');
const { PATHS } = require('../src/config');

const db = new Database(PATHS.DB);
const rows = db.prepare(`SELECT id, username, role, created_at FROM users ORDER BY id`).all();

console.log(`DB: ${PATHS.DB}`);
console.table(rows);
