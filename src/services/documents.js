// src/services/documents.js
const fs = require('fs');
const path = require('path');
const { PATHS } = require('../config');
const { db, tableExists, colExists } = require('./db');
const { parseName, docRowFromPath } = require('../utils/nomenclature');
const { countPagesFast } = require('../utils/pdf');

function scanDirAsDocs(dir) {
  try {
    const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.pdf'));
    return files.map(f => {
      const row = docRowFromPath(dir, f, parseName(f));
      // Compléter total_pages si possible en FS
      try { row.total_pages = countPagesFast(path.join(dir, f)); } catch {}
      return row;
    });
  } catch { return []; }
}

function listFromDB(whereSql=''){
  if (!db || !tableExists('documents')) return null;
  const hasSource = colExists('documents','source');
  const hasDest   = colExists('documents','dest_hotfolder');
  const cols = [
    'name','prefix','dpt','spr','com','lvo','bur','run','total_pages','size_kb','status',
    hasDest ? 'dest_hotfolder' : `' ' AS dest_hotfolder`,
    'created_at','updated_at'
  ];
  if (hasSource) cols.push('source');
  const sql = `SELECT ${cols.join(',')} FROM documents ${whereSql} ORDER BY updated_at DESC LIMIT 2000`;
  try { return db.prepare(sql).all(); } catch { return []; }
}

async function listImpressions(){
  let rows = listFromDB(colExists('documents','source') ? `WHERE source='InProgress' AND (status IS NULL OR status NOT LIKE 'reprint%')` : '');
  if (!rows || rows.length===0) rows = scanDirAsDocs(PATHS.INPROGRESS);
  return rows;
}

async function listReimpressions(){
  if (db && tableExists('documents')) {
    const hasSource = colExists('documents','source');
    const where = hasSource
      ? `WHERE (status LIKE 'reprint%' OR source='InReprint')`
      : `WHERE status LIKE 'reprint%'`;
    return listFromDB(where);
  }
  // Fallback sans DB : on liste InReprint ET InProgress
  return [
    ...scanDirAsDocs(PATHS.INREPRINT),
    ...scanDirAsDocs(PATHS.INPROGRESS),
  ];
}

async function listSuivi(){
  if (db && tableExists('documents')) return listFromDB('');
  return [
    ...scanDirAsDocs(PATHS.INPRINT),
    ...scanDirAsDocs(PATHS.INREPRINT),
    ...scanDirAsDocs(PATHS.INPROGRESS),
    ...scanDirAsDocs(PATHS.REJETS),
  ];
}

module.exports = { listImpressions, listReimpressions, listSuivi };