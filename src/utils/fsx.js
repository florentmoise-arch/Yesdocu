const fs = require('fs');
const path = require('path');
const { jdfFor } = require('./jdf');
const { docRowFromPath } = require('./nomenclature');

function ensureDir(p){ fs.mkdirSync(p, { recursive: true }); return p; }
function isPDFFile(filePath){ return /\.pdf$/i.test(filePath); }

function locateSourceFile(name, PATHS){
  const candidates = [
    path.join(PATHS.INPROGRESS, name),
    path.join(PATHS.INPRINT, name),
    path.join(PATHS.INREPRINT, name),
  ];
  for (const p of candidates) { if (fs.existsSync(p)) return p; }
  return null;
}

function moveToInProgressIfNeeded(absPath, PATHS){
  const base = path.basename(absPath);
  const srcDir = path.dirname(absPath);
  if (srcDir === PATHS.INPROGRESS) return absPath;
  ensureDir(PATHS.INPROGRESS);
  const dest = path.join(PATHS.INPROGRESS, base);
  try { fs.renameSync(absPath, dest); }
  catch { fs.copyFileSync(absPath, dest); fs.unlinkSync(absPath); }
  return dest;
}

function copyToHotfolderAndWriteJDF(fullSrc, hotfolderPath){
  ensureDir(hotfolderPath);
  const file = path.basename(fullSrc);
  const destPdf = path.join(hotfolderPath, file);
  const destJdf = path.join(hotfolderPath, file.replace(/\.pdf$/i, '.jdf'));
  fs.copyFileSync(fullSrc, destPdf);
  fs.writeFileSync(destJdf, jdfFor(file), 'utf8');
}

module.exports = {
  ensureDir, isPDFFile, locateSourceFile, moveToInProgressIfNeeded, copyToHotfolderAndWriteJDF
};