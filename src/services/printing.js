const fs = require('fs');
const path = require('path');
const { PATHS } = require('../config');
const { db, tableExists, colExists } = require('./db');
const { resolveHFPathByName } = require('./hotfolders');
const { ensureDir, isPDFFile, moveToInProgressIfNeeded, copyToHotfolderAndWriteJDF, locateSourceFile } = require('../utils/fsx');

function updateDocAfterSubmit(name, hotfolderName, status='en_cours') {
  if (!db || !tableExists('documents')) return;
  try {
    const hasDest = colExists('documents','dest_hotfolder');
    const hasSrc  = colExists('documents','source');
    const setBits = [`status=?`,`updated_at=datetime('now')`];
    const args = [status];
    if (hasDest) { setBits.push(`dest_hotfolder=?`); args.push(hotfolderName); }
    if (hasSrc)  { setBits.push(`source='InProgress'`); }
    args.push(name);
    db.prepare(`UPDATE documents SET ${setBits.join(', ')} WHERE name=?`).run(...args);
  } catch (e) { /* noop */ }
}

async function submitCore(jobs, defaultHotfolder, reprint=false){
  const hfPath = resolveHFPathByName(defaultHotfolder);
  if (!hfPath) return { ok:false, message:`Imprimante inconnue: ${defaultHotfolder}` };
  try { ensureDir(hfPath); } catch (e) { return { ok:false, message:`HotFolder inaccessible: ${hfPath} (${e.message})` }; }

  const results=[]; let okCount=0;
  for (const j of jobs) {
    const name = j.name;
    try {
      let located = locateSourceFile(name, PATHS);
      if (!located) { results.push({ name, ok:false, error:'Fichier introuvable' }); continue; }
      if (!isPDFFile(located)) { results.push({ name, ok:false, error:'Pas un PDF' }); continue; }
      const inProg = moveToInProgressIfNeeded(located, PATHS);
      copyToHotfolderAndWriteJDF(inProg, hfPath);
      updateDocAfterSubmit(name, defaultHotfolder, reprint ? 'reprint_en_cours' : 'en_cours');
      okCount++; results.push({ name, ok:true, hotfolder: defaultHotfolder, dest: hfPath });
    } catch (e) {
      results.push({ name, ok:false, error:e.message });
    }
  }
  return { ok: okCount>0, count: okCount, results };
}

async function submitImpressions(jobs, defaultHotfolder){
  return submitCore(jobs, defaultHotfolder, false);
}
async function submitReimpressions(jobs, defaultHotfolder){
  return submitCore(jobs, defaultHotfolder, true);
}

module.exports = { submitImpressions, submitReimpressions };