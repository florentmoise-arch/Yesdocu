const Database = require('better-sqlite3');
const { PATHS } = require('./config');

const db = new Database(PATHS.DB);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hotfolders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  prefix TEXT,
  dpt TEXT,
  spr TEXT,
  com TEXT,
  lvo TEXT,
  bur TEXT,
  run TEXT,
  total_pages INTEGER DEFAULT 0,
  printed_pages INTEGER DEFAULT 0,
  size_kb INTEGER,
  status TEXT DEFAULT 'pending',
  dest_hotfolder TEXT,
  reprint_count INTEGER DEFAULT 0,
  source_bucket TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

(function migrations() {
  const alter = (sql) => {
    try { db.prepare(sql).run(); } catch(e){
      if (!/duplicate column|exists/i.test(String(e))) console.error('Migration:', e.message);
    }
  };
  alter(`ALTER TABLE documents ADD COLUMN dest_hotfolder TEXT`);
  alter(`ALTER TABLE documents ADD COLUMN size_kb INTEGER`);
  alter(`ALTER TABLE documents ADD COLUMN reprint_count INTEGER DEFAULT 0`);
})();

// Seed users si vide (mdp: username)
const row = db.prepare(`SELECT COUNT(*) AS c FROM users`).get();
if (row.c === 0) {
  const { hashPassword } = require('./utils/password');
  const now = new Date().toISOString();
  const ins = db.prepare(`INSERT INTO users(username, password_hash, role, created_at) VALUES (?,?,?,?)`);
  [
    ['admin','admin','admin'],
    ['responsable','responsable','responsable'],
    ['operateur','operateur','operateur'],
    ['superviseur','superviseur','superviseur']
  ].forEach(([u,p,r]) => ins.run(u, hashPassword(p), r, now));
  console.log('Seed users created.');
}

module.exports = db;
