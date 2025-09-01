// src/routes/api.js
// YesDocu 2.1.0 — API Router (prefix: /api)

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const config = require('../config');
const { PATHS, APP_VERSION, WEB_VERSION } = config;

const router = express.Router();

/* ------------------------------- DB Helpers ------------------------------- */

let db;
try {
  fs.mkdirSync(path.dirname(PATHS.DB), { recursive: true });
  db = new Database(PATHS.DB, { fileMustExist: false });
} catch (e) {
  console.warn('⚠️ SQLite non disponible :', e.message);
}

function tableExists(name) {
  try {
    return !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
  } catch {
    return false;
  }
}
function colExists(table, col) {
  try {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all();
    return rows.some(r => r.name === col);
  } catch {
    return false;
  }
}

/* ------------------------------ Auth helpers ------------------------------ */

const DEFAULT_USERS = {
  admin:       { password: 'admin',       role: 'admin' },
  responsable: { password: 'resp',        role: 'responsable' },
  operateur:   { password: 'op',          role: 'operateur' },
  superviseur: { password: 'sup',         role: 'superviseur' },
};

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function getUserFromDB(username) {
  if (!db || !tableExists('users')) return null;
  // detect columns
  const hasHash = colExists('users', 'password_hash');
  const hasPwd  = colExists('users', 'password');
  const cols = ['username', 'role'];
  if (hasHash) cols.push('password_hash');
  if (hasPwd) cols.push('password');

  try {
    const row = db.prepare(`SELECT ${cols.join(',')} FROM users WHERE username=? LIMIT 1`).get(username);
    return row || null;
  } catch {
    return null;
  }
}

function verifyPassword(inputPwd, dbRow) {
  if (!dbRow) return false;
  const hash = dbRow.password_hash;
  const pwd  = dbRow.password;

  // 1) password_hash présent
  if (hash) {
    if (hash.startsWith('sha256:')) {
      return sha256(inputPwd) === hash.slice(7);
    }
    // si "plain" dans hash par héritage...
    if (hash === inputPwd) return true;
    // bcrypt éventuel (si lib absente on ne casse pas la connexion)
    if (hash.startsWith('$2')) {
      try {
        const bcrypt = require('bcryptjs');
        return bcrypt.compareSync(inputPwd, hash);
      } catch {
        // fallback: si hash = 'admin' etc. (en dev)
        return false;
      }
    }
    return false;
  }

  // 2) colonne password en clair (legacy)
  if (pwd) return String(pwd) === String(inputPwd);

  return false;
}

/* -------------------------------- Utilities ------------------------------- */

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}
function isPDFFile(filePath) {
  return /\.pdf$/i.test(filePath);
}
function fileSizeKB(filePath) {
  try {
    const s = fs.statSync(filePath);
    return Math.round(s.size / 1024);
  } catch {
    return 0;
  }
}
function parseName(name) {
  // Ex: LDEB_102_009_098_008_01_1_00.pdf
  const base = name.replace(/\.pdf$/i, '');
  const parts = base.split('_');
  const prefix = parts[0] || '';
  const dpt    = parts[1] || '';
  const spr    = parts[2] || '';
  const com    = parts[3] || '';
  const lvo    = parts[4] || '';
  const bur    = parts[5] || '';  // 01
  const run    = parts[6] || '';  // 1
  const extra  = parts[7] || '';  // 00 (non utilisé)
  return { prefix, dpt, spr, com, lvo, bur, run, extra };
}
function docRowFromPath(dir, file) {
  const full = path.join(dir, file);
  const st = fs.statSync(full);
  const size_kb = Math.round(st.size / 1024);
  const parsed = parseName(file);
  return {
    name: file,
    ...parsed,
    total_pages: 0,
    size_kb,
    status: 'pending',
    dest_hotfolder: null,
    source: path.basename(dir), // InProgress / InPrint / InReprint / Rejets
    created_at: st.birthtime?.toISOString?.() || new Date(st.ctimeMs || Date.now()).toISOString(),
    updated_at: st.mtime?.toISOString?.() || new Date(st.mtimeMs || Date.now()).toISOString(),
  };
}
function scanDirAsDocs(dir) {
  try {
    const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.pdf'));
    return files.map(f => docRowFromPath(dir, f));
  } catch {
    return [];
  }
}
function jdfFor(name) {
  const base = name.replace(/\.pdf$/i, '');
  // JDF minimal (Fiery peut accepter JDF simple ou XPIF ; à adapter si besoin)
  return `<?xml version="1.0" encoding="UTF-8"?>
<JDF xmlns="http://www.CIP4.org/JDFSchema_1_1" Type="Product" ID="YesDocu_${base}">
  <ResourcePool>
    <RunList Class="Parameter" ID="RL_${base}">
      <LayoutElement>
        <FileSpec URL="${base}.pdf" />
      </LayoutElement>
    </RunList>
    <RunListLink rRef="RL_${base}" Usage="Input"/>
  </ResourcePool>
  <AuditPool>
    <Created AgentName="YesDocu" />
  </AuditPool>
</JDF>`;
}
function copyToHotfolderAndWriteJDF(fullSrc, hotfolderPath) {
  ensureDir(hotfolderPath);
  const file = path.basename(fullSrc);
  const destPdf = path.join(hotfolderPath, file);
  const destJdf = path.join(hotfolderPath, file.replace(/\.pdf$/i, '.jdf'));
  // copie atomique (overwrite = true)
  fs.copyFileSync(fullSrc, destPdf);
  fs.writeFileSync(destJdf, jdfFor(file), 'utf8');
}

/* ------------------------------- Auth Routes ------------------------------ */

router.get('/auth/me', (req, res) => {
  let user = null;
  try {
    if (req.cookies?.yd_user) user = JSON.parse(req.cookies.yd_user);
  } catch {}
  res.json({ user, versions: { app: APP_VERSION, web: WEB_VERSION } });
});

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'Identifiants requis' });

  // 1) DB
  const row = getUserFromDB(username);
  if (row && verifyPassword(password, row)) {
    const user = { username, role: row.role || 'operateur' };
    res.cookie('yd_user', JSON.stringify(user), { httpOnly: false });
    return res.json({ ok: true, user });
  }
  // 2) Fallback dev
  const def = DEFAULT_USERS[username];
  if (def && def.password === password) {
    const user = { username, role: def.role };
    res.cookie('yd_user', JSON.stringify(user), { httpOnly: false });
    return res.json({ ok: true, user });
  }
  return res.status(401).json({ message: 'Login invalide' });
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('yd_user');
  res.json({ ok: true });
});

/* ----------------------------- Hotfolder Routes --------------------------- */

function listHF_DB() {
  if (!db || !tableExists('hotfolders')) return null;
  try {
    return db.prepare(`SELECT name, path FROM hotfolders ORDER BY name COLLATE NOCASE`).all();
  } catch {
    return [];
  }
}
function insertHF_DB(name, p) {
  if (!db || !tableExists('hotfolders')) return false;
  try {
    db.prepare(`INSERT OR IGNORE INTO hotfolders (name, path) VALUES (?, ?)`).run(name, p);
    return true;
  } catch {
    return false;
  }
}

// fallback mémoire si pas de table
const hotfoldersMem = [];

router.get('/hotfolders', (req, res) => {
  const rows = listHF_DB();
  if (rows) return res.json(rows);
  return res.json(hotfoldersMem);
});

router.post('/admin/hotfolders', (req, res) => {
  const { name, path: p } = req.body || {};
  if (!name || !p) return res.status(400).json({ message: 'Nom et chemin requis' });
  const rows = listHF_DB();
  if (rows) {
    insertHF_DB(name, p);
    return res.json({ ok: true });
  }
  if (!hotfoldersMem.some(h => h.name === name)) hotfoldersMem.push({ name, path: p });
  res.json({ ok: true });
});

router.post('/admin/reset-password', (req, res) => {
  const { username, newPassword } = req.body || {};
  if (!username || !newPassword) return res.status(400).json({ message: 'Champs requis' });
  if (!db || !tableExists('users')) {
    return res.json({ ok: true, note: 'Table users absente (mode démo). Rien mis à jour.' });
  }
  const hasHash = colExists('users', 'password_hash');
  let rv;
  try {
    if (hasHash) {
      const hash = 'sha256:' + sha256(newPassword);
      rv = db.prepare(`UPDATE users SET password_hash=? WHERE username=?`).run(hash, username);
    } else {
      rv = db.prepare(`UPDATE users SET password=? WHERE username=?`).run(newPassword, username);
    }
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
  res.json({ ok: true, changes: rv?.changes || 0 });
});

/* ------------------------------ Documents list ---------------------------- */

function listDocsFromDB(whereSql, whereArgs = []) {
  if (!db || !tableExists('documents')) return null;
  const hasSource = colExists('documents', 'source');
  const cols = [
    'name','prefix','dpt','spr','com','lvo','bur','run',
    'total_pages','size_kb','status',
    colExists('documents','dest_hotfolder') ? 'dest_hotfolder' : `' ' AS dest_hotfolder`,
    'created_at','updated_at',
  ];
  if (hasSource) cols.push('source');

  const sql = `SELECT ${cols.join(',')} FROM documents ${whereSql || ''} ORDER BY updated_at DESC LIMIT 1000`;
  try {
    return db.prepare(sql).all(...whereArgs);
  } catch (e) {
    console.warn('⚠️ listDocsFromDB:', e.message);
    return [];
  }
}

router.get('/impressions', (req, res) => {
  // Priorité DB (source=InProgress si colonne présente), sinon fallback FS
  let rows = listDocsFromDB(colExists('documents','source') ? `WHERE source='InProgress'` : '');
  if (rows === null || rows.length === 0) {
    rows = scanDirAsDocs(PATHS.INPROGRESS);
  }
  res.json(rows);
});

router.get('/reimpressions', (req, res) => {
  let rows;
  if (db && tableExists('documents')) {
    const hasSource = colExists('documents','source');
    const hasStatus = colExists('documents','status');
    const where = hasSource ? `WHERE source='InReprint'` : (hasStatus ? `WHERE status LIKE 'reprint%'` : '');
    rows = listDocsFromDB(where);
  } else {
    rows = scanDirAsDocs(PATHS.INREPRINT);
  }
  res.json(rows || []);
});

router.get('/suivi', (req, res) => {
  let rows;
  if (db && tableExists('documents')) {
    rows = listDocsFromDB('');
  } else {
    rows = [
      ...scanDirAsDocs(PATHS.INPRINT),
      ...scanDirAsDocs(PATHS.INREPRINT),
      ...scanDirAsDocs(PATHS.INPROGRESS),
      ...scanDirAsDocs(PATHS.REJETS),
    ];
  }
  res.json(rows || []);
});

/* ------------------------------- Processing ------------------------------- */

function resolveHFPathByName(name) {
  // DB d'abord
  if (db && tableExists('hotfolders')) {
    const row = db.prepare(`SELECT path FROM hotfolders WHERE name=?`).get(name);
    if (row?.path) return row.path;
  }
  // mémoire
  const hf = hotfoldersMem.find(h => h.name === name);
  return hf?.path || null;
}
function updateDocAfterSubmit(name, hotfolderName, status='en_cours') {
  if (!db || !tableExists('documents')) return;
  try {
    const hasDest = colExists('documents', 'dest_hotfolder');
    const hasSrc  = colExists('documents', 'source');
    const setBits = [`status=?`, `updated_at=datetime('now')`];
    const args = [status];
    if (hasDest) { setBits.push(`dest_hotfolder=?`); args.push(hotfolderName); }
    if (hasSrc)  { setBits.push(`source='InProgress'`); }
    args.push(name);
    db.prepare(`UPDATE documents SET ${setBits.join(', ')} WHERE name=?`).run(...args);
  } catch (e) {
    console.warn('⚠️ updateDocAfterSubmit:', e.message);
  }
}

router.post('/process/impressions', (req, res) => {
  const { jobs = [], defaultHotfolder } = req.body || {};
  if (!Array.isArray(jobs) || jobs.length === 0) return res.status(400).json({ message: 'Aucun job' });
  if (!defaultHotfolder) return res.status(400).json({ message: 'Imprimante (lot) manquante' });

  const targetPath = resolveHFPathByName(defaultHotfolder);
  if (!targetPath) return res.status(400).json({ message: 'Imprimante inconnue' });

  let count = 0;
  for (const j of jobs) {
    const name = j.name;
    const src = path.join(PATHS.INPROGRESS, name);
    if (!fs.existsSync(src) || !isPDFFile(src)) continue;
    try {
      copyToHotfolderAndWriteJDF(src, targetPath);
      updateDocAfterSubmit(name, defaultHotfolder, 'en_cours');
      count++;
    } catch (e) {
      console.warn('⚠️ submit error', name, e.message);
    }
  }
  res.json({ ok: true, count });
});

router.post('/process/reimpressions', (req, res) => {
  const { jobs = [], defaultHotfolder } = req.body || {};
  if (!Array.isArray(jobs) || jobs.length === 0) return res.status(400).json({ message: 'Aucun job' });
  if (!defaultHotfolder) return res.status(400).json({ message: 'Imprimante (lot) manquante' });

  const targetPath = resolveHFPathByName(defaultHotfolder);
  if (!targetPath) return res.status(400).json({ message: 'Imprimante inconnue' });

  let count = 0;
  for (const j of jobs) {
    const name = j.name;
    const src = path.join(PATHS.INREPRINT, name);
    const alt = path.join(PATHS.INPROGRESS, name); // au cas où
    const file = fs.existsSync(src) ? src : (fs.existsSync(alt) ? alt : null);
    if (!file || !isPDFFile(file)) continue;
    try {
      copyToHotfolderAndWriteJDF(file, targetPath);
      updateDocAfterSubmit(name, defaultHotfolder, 'reprint_en_cours');
      count++;
    } catch (e) {
      console.warn('⚠️ reprint submit error', name, e.message);
    }
  }
  res.json({ ok: true, count });
});

/* --------------------------------- Health --------------------------------- */

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    app: APP_VERSION,
    web: WEB_VERSION,
    db: !!db,
    tables: db ? db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all().map(r=>r.name) : [],
  });
});

module.exports = router;