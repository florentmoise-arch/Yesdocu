const crypto = require('crypto');
const { db, tableExists, colExists } = require('./db');

const DEFAULT_USERS = {
  admin:       { password: 'admin', role: 'admin' },
  responsable: { password: 'resp',  role: 'responsable' },
  operateur:   { password: 'op',    role: 'operateur' },
  superviseur: { password: 'sup',   role: 'superviseur' },
};

const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');

function findUser(username){
  if (!db || !tableExists('users')) return null;
  const hasHash = colExists('users','password_hash');
  const hasPwd  = colExists('users','password');
  const cols = ['username','role'];
  if (hasHash) cols.push('password_hash');
  if (hasPwd)  cols.push('password');
  try {
    return db.prepare(`SELECT ${cols.join(',')} FROM users WHERE username=? LIMIT 1`).get(username) || null;
  } catch { return null; }
}

function verifyPassword(inputPwd, row){
  if (!row) return false;
  if (row.password_hash) {
    if (row.password_hash.startsWith('sha256:')) return sha256(inputPwd) === row.password_hash.slice(7);
    if (row.password_hash === inputPwd) return true;
    if (row.password_hash.startsWith('$2')) {
      try { const bcrypt = require('bcryptjs'); return bcrypt.compareSync(inputPwd, row.password_hash); }
      catch { return false; }
    }
    return false;
  }
  if (row.password) return String(row.password) === String(inputPwd);
  return false;
}

module.exports = { DEFAULT_USERS, findUser, verifyPassword, sha256 };