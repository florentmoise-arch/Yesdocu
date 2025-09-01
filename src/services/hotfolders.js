const { db, tableExists } = require('./db');
const { sha256 } = require('./users');

async function listHotfolders(){
  if (!db || !tableExists('hotfolders')) return [];
  try {
    return db.prepare(`SELECT name, path FROM hotfolders ORDER BY name COLLATE NOCASE`).all();
  } catch { return []; }
}

async function addHotfolder(name, p){
  if (!db || !tableExists('hotfolders')) throw new Error('Table hotfolders absente');
  db.prepare(`INSERT OR IGNORE INTO hotfolders (name, path) VALUES (?, ?)`).run(name, p);
}

async function resetPassword(username, newPassword){
  if (!db || !tableExists('users')) return { ok:true, note:'Table users absente (mode démo)' };
  const hasHash = db.prepare(`PRAGMA table_info(users)`).all().some(c => c.name==='password_hash');
  if (hasHash) {
    const hash = 'sha256:'+sha256(newPassword);
    db.prepare(`UPDATE users SET password_hash=? WHERE username=?`).run(hash, username);
  } else {
    db.prepare(`UPDATE users SET password=? WHERE username=?`).run(newPassword, username);
  }
  return { ok:true };
}

function resolveHFPathByName(name){
  if (!db || !tableExists('hotfolders')) return null;
  const row = db.prepare(`SELECT path FROM hotfolders WHERE name=?`).get(name);
  return row?.path || null;
}

module.exports = { listHotfolders, addHotfolder, resetPassword, resolveHFPathByName };