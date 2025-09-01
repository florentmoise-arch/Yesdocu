// src/utils/pdf.js
// Compte les pages PDF : méthode rapide (regex) + méthode précise (pdf-lib si installée)

const fs = require('fs');

function countPagesFast(filePath) {
  try {
    // Lecture binaire (latin1) pour ne pas altérer les octets
    const buf = fs.readFileSync(filePath);
    const s = buf.toString('latin1');

    // Compte /Type /Page (éviter les /Type /Pages du dictionnaire des pages)
    const mPages = s.match(/\/Type\s*\/Page\b/g) || [];
    const mPagesDict = s.match(/\/Type\s*\/Pages\b/g) || [];
    const rough = mPages.length - mPagesDict.length;

    // Si le différentiel est <= 0, on garde au moins mPages.length
    return rough > 0 ? rough : mPages.length;
  } catch {
    return 0;
  }
}

async function countPages(filePath) {
  try {
    // Si pdf-lib est dispo, on l'utilise (plus fiable)
    const { PDFDocument } = require('pdf-lib');
    const data = fs.readFileSync(filePath);
    const doc = await PDFDocument.load(data, { ignoreEncryption: true });
    if (typeof doc.getPageCount === 'function') return doc.getPageCount();
    // Compat fallback
    return doc.getPages().length;
  } catch {
    // fallback sans dépendance
    return countPagesFast(filePath);
  }
}

module.exports = { countPages, countPagesFast };