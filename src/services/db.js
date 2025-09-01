const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { PATHS } = require('../config');

let db = null;
try {
  fs.mkdirSync(path.dirname(PATHS.DB), { recursive: true });
  db = new Database(PATHS.DB, { fileMustExist: false });
} catch (e) {
  console.warn('⚠️ SQLite indisponible:', e.message);
}

function tableExists(name){
  try { return !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name); }
  catch { return false; }
}
function colExists(table, col){
  try { return db.prepare(`PRAGMA table_info(${table})`).all().some(r => r.name === col); }
  catch { return false; }
}
function dbInfo() {
  return {
    db,
    tables: db ? db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(r => r.name) : []
  };
}

module.exports = { db, tableExists, colExists, dbInfo };