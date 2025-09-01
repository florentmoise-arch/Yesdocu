// src/utils/pdf.js
const fs = require('fs');

function countPagesFast(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    const s = buf.toString('latin1');
    const mPage  = s.match(/\/Type\s*\/Page\b/g)  || [];
    const mPages = s.match(/\/Type\s*\/Pages\b/g) || [];
    const rough = mPage.length - mPages.length;
    return rough > 0 ? rough : mPage.length;
  } catch {
    return 0;
  }
}

async function countPages(filePath) {
  try {
    const { PDFDocument } = require('pdf-lib');          // ← utilisera pdf-lib si installé
    const data = fs.readFileSync(filePath);
    const doc = await PDFDocument.load(data, { ignoreEncryption: true });
    return typeof doc.getPageCount === 'function' ? doc.getPageCount() : doc.getPages().length;
  } catch {
    return countPagesFast(filePath);                      // ← fallback regex
  }
}

module.exports = { countPages, countPagesFast };