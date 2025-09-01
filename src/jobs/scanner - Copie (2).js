// src/jobs/scanner.js
// YesDocu 2.1.0 — Scanner InPrint / InReprint → InProgress (+rejets, +DB upsert)

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { PATHS, SCAN_INTERVAL_MS = 2000 } = config;

let db = null;
try {
  const Database = require('better-sqlite3');
  db = new Database(PATHS.DB, { fileMustExist: false });
} catch (e) {
  console.warn('⚠️ SQLite indisponible pour le scanner:', e.message);
}

/* ------------------------------ DB helpers -------------------------------- */

function tableExists(name) {
  try {
    return !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
  } catch { return false; }
}
function colExists(table, col) {
  try {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all();
    return rows.some(r => r.name === col);
  } catch { return false; }
}
function docExists(name) {
  if (!db || !tableExists('documents')) return false;
  try {
    const row = db.prepare(`SELECT name FROM documents WHERE name=? LIMIT 1`).get(name);
    return !!row;
  } catch { return false; }
}
function upsertDocument(row) {
  if (!db || !tableExists('documents')) return;
  const hasSource = colExists('documents','source');
  const hasDest   = colExists('documents','dest_hotfolder');

  const UPDATE = db.prepare(`
    UPDATE documents
       SET prefix=@prefix, dpt=@dpt, spr=@spr, com=@com, lvo=@lvo, bur=@bur, run=@run,
           total_pages=@total_pages, size_kb=@size_kb, status=@status,
           ${hasDest ? 'dest_hotfolder=@dest_hotfolder,' : '' }
           ${hasSource ? 'source=@source,' : '' }
           updated_at=@updated_at
     WHERE name=@name
  `);
  const INSERT = db.prepare(`
    INSERT INTO documents
      (name, prefix, dpt, spr, com, lvo, bur, run, total_pages, size_kb, status,
       ${hasDest ? 'dest_hotfolder,' : '' }
       ${hasSource ? 'source,' : '' }
       created_at, updated_at)
    VALUES
      (@name, @prefix, @dpt, @spr, @com, @lvo, @bur, @run, @total_pages, @size_kb, @status,
       ${hasDest ? '@dest_hotfolder,' : '' }
       ${hasSource ? '@source,' : '' }
       @created_at, @updated_at)
  `);

  const rv = UPDATE.run(row);
  if (!rv.changes) INSERT.run(row);
}

/* -------------------------------- Utils FS -------------------------------- */

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); return p; }
function isPDFExt(file) { return /\.pdf$/i.test(file); }
function isValidPDF(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(5);
    fs.readSync(fd, buf, 0, 5, 0);
    fs.closeSync(fd);
    return buf.toString() === '%PDF-';
  } catch { return false; }
}
function fileSizeKB(filePath) {
  try { return Math.round(fs.statSync(filePath).size / 1024); } catch { return 0; }
}
function isStable(filePath, minAgeMs = 1500) {
  try {
    const st = fs.statSync(filePath);
    const age = Date.now() - st.mtimeMs;
    return age > minAgeMs;
  } catch { return false; }
}
function parseName(name) {
  const base = name.replace(/\.pdf$/i, '');
  const p = base.split('_');
  return {
    prefix: p[0] || '', dpt: p[1] || '', spr: p[2] || '', com: p[3] || '',
    lvo: p[4] || '', bur: p[5] || '', run: p[6] || '', extra: p[7] || ''
  };
}
function docRowFor(dir, file, status, source) {
  const full = path.join(dir, file);
  const st = fs.statSync(full);
  const nowIso = new Date().toISOString();
  const parsed = parseName(file);
  return {
    name: file,
    ...parsed,
    total_pages: 0,
    size_kb: Math.round(st.size / 1024),
    status,
    dest_hotfolder: null,
    source,
    created_at: st.birthtime?.toISOString?.() || nowIso,
    updated_at: st.mtime?.toISOString?.() || nowIso,
  };
}
function safeMove(src, dest) {
  ensureDir(path.dirname(dest));
  try { fs.renameSync(src, dest); }
  catch { fs.copyFileSync(src, dest); fs.unlinkSync(src); }
}

/* ------------------------------- Core scan -------------------------------- */

function scanInputDir(dir, mode) {
  // mode: 'print' pour InPrint, 'reprint' pour InReprint
  let files = [];
  try {
    files = fs.readdirSync(dir).filter(f => !f.startsWith('~') && isPDFExt(f));
  } catch { return; }
  if (files.length === 0) return;

  for (const file of files) {
    const abs = path.join(dir, file);

    // éviter les copies en cours
    if (!isStable(abs)) continue;

    // validation PDF
    if (!isValidPDF(abs)) {
      console.warn(`⚠️ Rejet (PDF invalide): ${file}`);
      safeMove(abs, path.join(PATHS.REJETS, file));
      continue;
    }

    // doublons DB → rejet
    if (docExists(file)) {
      console.warn(`⚠️ Rejet (doublon DB): ${file}`);
      safeMove(abs, path.join(PATHS.REJETS, file));
      continue;
    }

    if (mode === 'print') {
      // InPrint → InProgress
      const dest = path.join(PATHS.INPROGRESS, file);
      try {
        safeMove(abs, dest);
        const row = docRowFor(PATHS.INPROGRESS, file, 'pending', 'InProgress');
        upsertDocument(row);
        console.log(`✅ Aspiré (print): ${file} → InProgress`);
      } catch (e) {
        console.error(`❌ Move InPrint→InProgress échoué: ${file} (${e.message})`);
      }
    } else {
      // mode === 'reprint'
      if (db && tableExists('documents')) {
        // DB présente → on passe en InProgress avec statut reprint_pending
        const dest = path.join(PATHS.INPROGRESS, file);
        try {
          safeMove(abs, dest);
          const row = docRowFor(PATHS.INPROGRESS, file, 'reprint_pending', 'InProgress');
          upsertDocument(row);
          console.log(`✅ Aspiré (reprint→InProgress): ${file}`);
        } catch (e) {
          console.error(`❌ Move InReprint→InProgress échoué: ${file} (${e.message})`);
        }
      } else {
        // Pas de DB → on laisse en InReprint pour que la page Réimpressions (fallback FS) voie le fichier
        try {
          const row = docRowFor(PATHS.INREPRINT, file, 'reprint_pending', 'InReprint');
          upsertDocument(row); // si jamais table se crée plus tard
          console.log(`ℹ️ DB absente: ${file} reste en InReprint (visible en FS).`);
        } catch (e) {
          console.warn(`⚠️ Note reprint: ${file} (${e.message})`);
        }
      }
    }
  }
}

/* --------------------------------- Start ---------------------------------- */

let timer = null;
function startScanner() {
  // s’assure que les répertoires existent
  [PATHS.INPRINT, PATHS.INREPRINT, PATHS.INPROGRESS, PATHS.REJETS].forEach(ensureDir);

  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    try { scanInputDir(PATHS.INPRINT, 'print'); }
    catch (e) { console.error('Scan InPrint error:', e.message); }
    try { scanInputDir(PATHS.INREPRINT, 'reprint'); }
    catch (e) { console.error('Scan InReprint error:', e.message); }
  }, SCAN_INTERVAL_MS);

  console.log(`🔎 Scanner lancé — toutes ${SCAN_INTERVAL_MS} ms`);
}

function stopScanner() {
  if (timer) clearInterval(timer);
  timer = null;
  console.log('⏹️ Scanner arrêté');
}

module.exports = { startScanner, stopScanner };