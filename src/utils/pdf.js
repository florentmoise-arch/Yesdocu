// src/utils/pdf.js
// Ordre : pdf-parse ➜ pdf-lib ➜ regex (aucune exception ne remonte)

const fs = require('fs');

function countPagesFast(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    const s = buf.toString('latin1');
    const pageObjs  = s.match(/\/Type\s*\/Page\b/g)  || [];
    const pagesObjs = s.match(/\/Type\s*\/Pages\b/g) || [];
    const rough = pageObjs.length - pagesObjs.length;
    return rough > 0 ? rough : pageObjs.length;
  } catch {
    return 0;
  }
}

async function tryPdfParse(filePath) {
  try {
    const pdfParse = require('pdf-parse');
    const data = fs.readFileSync(filePath);
    // max:1 limite le parsing, réduit les risques d’erreurs profondes
    const res = await pdfParse(data, { max: 1 }).catch(() => null);
    if (!res) return 0;
    let pages =
      res.numpages ??
      res.numPages ??
      res?.info?.Pages ??
      (Array.isArray(res?.formImage?.Pages) ? res.formImage.Pages.length : 0);
    pages = Number(pages) || 0;
    return pages;
  } catch {
    return 0;
  }
}

async function tryPdfLib(filePath) {
  try {
    const { PDFDocument } = require('pdf-lib');
    const data = fs.readFileSync(filePath);
    const doc = await PDFDocument.load(data, { ignoreEncryption: true }).catch(() => null);
    if (!doc) return 0;
    return typeof doc.getPageCount === 'function' ? doc.getPageCount() : doc.getPages().length;
  } catch {
    return 0;
  }
}

async function countPages(filePath) {
  let n = await tryPdfParse(filePath);
  if (n > 0) return n;
  n = await tryPdfLib(filePath);
  if (n > 0) return n;
  return countPagesFast(filePath);
}

module.exports = { countPages, countPagesFast };