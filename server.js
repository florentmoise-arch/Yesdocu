/**
 * YesDocu — server.js (Back-end only)
 * YesDocu 2.1.0 / WEB 1.0.1
 * - Sert l'IHM (public/)
 * - API: listes, hotfolders, impression (lot & ligne)
 * - Délègue le scan à src/jobs/scanner.js (InPrint/InReprint -> InProgress)
 *
 * IMPORTANT : AUCUN code DOM ici (pas de 'document', 'window', ...).
 */

process.on('unhandledRejection', (r) =>
  console.error('⚠️ Unhandled Rejection:', r?.message || r)
);
process.on('uncaughtException', (e) =>
  console.error('⚠️ Uncaught Exception:', e?.message || e)
);

const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();

/* ------------------------------ Config & Paths ----------------------------- */

const config = require('./src/config'); // adapte si besoin
const { PATHS, PORT, APP_VERSION, WEB_VERSION } = config;

// Garantit l'existence des dossiers de travail
[PATHS.PUBLIC, PATHS.DATA, PATHS.INPRINT, PATHS.INREPRINT, PATHS.INPROGRESS, PATHS.REJETS, path.dirname(PATHS.DB)]
  .forEach(p => { try { fs.mkdirSync(p, { recursive: true }); } catch {} });

/* --------------------------------- DB (HF) -------------------------------- */

let db = null;
try {
  const Database = require('better-sqlite3');
  db = new Database(PATHS.DB, { fileMustExist: false });
} catch (e) {
  console.warn('⚠️ SQLite indisponible (hotfolders & updates DB limités) :', e.message);
}
function tableExists(name) {
  if (!db) return false;
  try {
    return !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
  } catch { return false; }
}
function colExists(table, col) {
  if (!db) return false;
  try {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all();
    return rows.some(r => r.name === col);
  } catch { return false; }
}

/* --------------------------- Middlewares serveur --------------------------- */

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Fichiers statiques (IHM)
app.use(express.static(PATHS.PUBLIC));

/* --------------------------------- Helpers -------------------------------- */

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); return p; }
function exists(p) { try { return fs.existsSync(p); } catch { return false; } }
function sendPDF(res, filePath) {
  res.setHeader('Content-Type', 'application/pdf');
  return res.sendFile(filePath);
}
function safeMove(src, dest) {
  ensureDir(path.dirname(dest));
  try { fs.renameSync(src, dest); }
  catch {
    fs.copyFileSync(src, dest);
    fs.unlinkSync(src);
  }
}
function writeJDF(hfPath, pdfName, meta = {}) {
  // JDF minimal (simple ticket d'accompagnement)
  const jobId = meta.jobId || pdfName.replace(/\.pdf$/i, '');
  const copies = meta.copies || 1;
  const when = new Date().toISOString();

  const jdf = `<?xml version="1.0" encoding="UTF-8"?>
<JDF xmlns="http://www.CIP4.org/JDFSchema_1_1" Type="Combined" Version="1.4" ID="${jobId}"
     JobPartID="${jobId}" Status="Waiting" Types="ConventionalPrinting">
  <Comment Name="YesDocu" Value="${APP_VERSION} / ${WEB_VERSION}" />
  <AuditPool>
    <Created TimeStamp="${when}" AgentName="YesDocu" AgentVersion="2.1.0"/>
  </AuditPool>
  <ResourcePool>
    <RunList Class="Parameter" ID="RL_${jobId}" Status="Available">
      <RunList FileSpecURL="${pdfName}" />
    </RunList>
    <Component Class="Quantity" ID="CP_${jobId}" Status="Available"/>
  </ResourcePool>
  <ResourceLinkPool>
    <RunListLink rRef="RL_${jobId}" Usage="Input"/>
    <ComponentLink rRef="CP_${jobId}" Usage="Output" Amount="${copies}"/>
  </ResourceLinkPool>
</JDF>`;

  const jdfPath = path.join(hfPath, `${jobId}.jdf`);
  fs.writeFileSync(jdfPath, jdf, 'utf8');
  return jdfPath;
}

// Résout un hotfolder à partir de son nom (DB) ou d'un chemin absolu
function resolveHotfolder(hfValue) {
  if (!hfValue) return null;

  // si c'est un chemin absolu existant, on l'utilise directement
  if (path.isAbsolute(hfValue) && exists(hfValue)) return hfValue;

  if (db && tableExists('hotfolders')) {
    const row = db.prepare(`SELECT path FROM hotfolders WHERE name=? OR path=? LIMIT 1`).get(hfValue, hfValue);
    if (row && row.path && exists(row.path)) return row.path;
  }
  return null;
}

// Met à jour le statut d'un document dans la DB (si table dispo)
function updateDocStatus(name, fields = {}) {
  if (!db || !tableExists('documents')) return;
  const hasDest   = colExists('documents','dest_hotfolder');
  const hasSource = colExists('documents','source');

  const set = [
    'status = @status',
    hasDest   ? 'dest_hotfolder = @dest_hotfolder' : null,
    hasSource ? 'source = IFNULL(source, @source)' : null,
    'updated_at = @updated_at'
  ].filter(Boolean).join(', ');

  const stmt = db.prepare(`UPDATE documents SET ${set} WHERE name = @name`);
  stmt.run({
    name,
    status: fields.status || null,
    dest_hotfolder: fields.dest_hotfolder || null,
    source: fields.source || null,
    updated_at: new Date().toISOString()
  });
}

/* --------------------------------- Services -------------------------------- */

const docs = require('./src/services/documents'); // { listImpressions, listReimpressions, listSuivi }

/* ----------------------------------- API ---------------------------------- */

// Santé / versions
app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: APP_VERSION, web: WEB_VERSION });
});

// Hotfolders (liste depuis DB, sinon vide)
app.get('/api/hotfolders', (req, res) => {
  if (db && tableExists('hotfolders')) {
    try {
      const rows = db.prepare(`SELECT id, name, path FROM hotfolders ORDER BY name`).all();
      return res.json(rows);
    } catch (e) {
      return res.status(500).json({ ok:false, message: e.message });
    }
  }
  return res.json([]); // pas de DB / de table
});

// Listes
app.get('/api/impressions', async (req, res) => {
  try {
    const rows = await docs.listImpressions();
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ ok:false, message: e.message });
  }
});

app.get('/api/reimpressions', async (req, res) => {
  try {
    const rows = await docs.listReimpressions();
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ ok:false, message: e.message });
  }
});

app.get('/api/suivi', async (req, res) => {
  try {
    const rows = await docs.listSuivi();
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ ok:false, message: e.message });
  }
});

// Impression (lot ou unitaire) — Impressions
app.post('/api/process/impressions', async (req, res) => {
  try {
    const { jobs = [], defaultHotfolder } = req.body || {};
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ ok:false, message: 'Aucun job fourni' });
    }
    const hfPath = resolveHotfolder(defaultHotfolder);
    if (!hfPath) return res.status(400).json({ ok:false, message: 'Imprimante (hotfolder) introuvable' });

    let okCount = 0;
    for (const j of jobs) {
      const name = (j && j.name) ? String(j.name) : null;
      if (!name) continue;

      // On cherche le PDF prioritairement en InProgress
      const candidates = [
        path.join(PATHS.INPROGRESS, name),
        path.join(PATHS.INPRINT, name),
        path.join(PATHS.INREPRINT, name)
      ];
      const src = candidates.find(p => exists(p));
      if (!src) continue;

      // Dépôt vers le hotfolder (Fiery) + JDF
      const dest = path.join(hfPath, name);
      safeMove(src, dest);
      writeJDF(hfPath, path.basename(dest), { jobId: path.basename(name, '.pdf'), copies: (j.copies || 1) });

      // statut DB
      updateDocStatus(name, { status: 'en_cours', dest_hotfolder: defaultHotfolder });

      okCount++;
    }

    res.json({ ok:true, count: okCount });
  } catch (e) {
    res.status(500).json({ ok:false, message: e.message });
  }
});

// Impression (lot ou unitaire) — Réimpressions
app.post('/api/process/reimpressions', async (req, res) => {
  try {
    const { jobs = [], defaultHotfolder } = req.body || {};
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ ok:false, message: 'Aucun job fourni' });
    }
    const hfPath = resolveHotfolder(defaultHotfolder);
    if (!hfPath) return res.status(400).json({ ok:false, message: 'Imprimante (hotfolder) introuvable' });

    let okCount = 0;
    for (const j of jobs) {
      const name = (j && j.name) ? String(j.name) : null;
      if (!name) continue;

      // Les reprints ont été déplacés par le scanner en InProgress (reprint_pending)
      const candidates = [
        path.join(PATHS.INPROGRESS, name),
        path.join(PATHS.INREPRINT, name), // sécurité si scanner n'a pas encore bougé
      ];
      const src = candidates.find(p => exists(p));
      if (!src) continue;

      // Vers hotfolder + JDF
      const dest = path.join(hfPath, name);
      safeMove(src, dest);
      writeJDF(hfPath, path.basename(dest), { jobId: path.basename(name, '.pdf'), copies: (j.copies || 1) });

      // statut DB
      updateDocStatus(name, { status: 'reprint_en_cours', dest_hotfolder: defaultHotfolder });

      okCount++;
    }

    res.json({ ok:true, count: okCount });
  } catch (e) {
    res.status(500).json({ ok:false, message: e.message });
  }
});

// Servir un PDF (vue 👁️)
app.get('/file/:name', (req, res) => {
  const name = req.params.name;
  const places = [
    PATHS.INPROGRESS, PATHS.INPRINT, PATHS.INREPRINT, PATHS.REJETS
  ];
  const hit = places
    .map(dir => path.join(dir, name))
    .find(p => exists(p));
  if (!hit) return res.status(404).send('Fichier introuvable');
  return sendPDF(res, hit);
});

/* ------------------------------- Routes IHM ------------------------------- */

// Ces routes servent l'index.html pour l'app (SPA)
app.get(['/', '/impressions', '/reimpressions', '/suivi', '/admin'], (req, res) => {
  res.sendFile(path.join(PATHS.PUBLIC, 'index.html'));
});

/* --------------------------------- Scanner -------------------------------- */

try {
  const { startScanner } = require('./src/jobs/scanner');
  startScanner();
} catch (e) {
  console.warn('⚠️ Scanner non démarré:', e.message);
}

/* --------------------------------- Launch --------------------------------- */

app.listen(PORT, () => {
  console.log(`✅ YesDocu ${APP_VERSION} / ${WEB_VERSION}`);
  console.log(`🌐 http://localhost:${PORT}`);
});