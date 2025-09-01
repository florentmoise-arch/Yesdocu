// tools/check-db.js
const Database = require('better-sqlite3');
const { PATHS } = require('../src/config');

const db = new Database(PATHS.DB);
function q(sql){ try { return db.prepare(sql).all(); } catch(e){ return e.message; } }

console.log('DB path =', PATHS.DB);
console.log('tables =', q("SELECT name FROM sqlite_master WHERE type='table'"));
console.log('users cols =', q("PRAGMA table_info(users)"));
console.log('users rows =', q("SELECT id, username, role, password FROM users"));