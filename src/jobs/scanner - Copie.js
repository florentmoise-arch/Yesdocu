// Scanner InPrint & InReprint -> InProgress
const fs = require('fs');
const path = require('path');
const { PATHS, SCAN_INTERVAL_MS } = require('../config');
const docs = require('../services/documents');
const { parseNomenclature } = require('../utils/nomenclature');
const { isPDF, countPages } = require('../utils/pdf');
const { ensureDir, moveSafe, fileSizeKB } = require('../utils/fsx');

const DIRS = {
  InPrint: PATHS.INPRINT,
  InReprint: PATHS.INREPRINT,
};

async function scanDir(dir, sourceType, status) {
  await ensureDir(dir);

  const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.pdf'));
  for (const fname of files) {
    const abs = path.join(dir, fname);
    try {
      const buf = fs.readFileSync(abs);

      // 1) PDF valide ?
      if (!isPDF(buf)) {
        console.log(`Reject non-PDF: ${fname}`);
        await docs.moveToRejectRecord(fname, 'non_pdf');
        await ensureDir(PATHS.REJETS);
        moveSafe(abs, path.join(PATHS.REJETS, fname));
        continue;
      }

      // 2) Nomenclature valide ?
      const parts = parseNomenclature(fname);
      if (!parts) {
        console.log(`Reject bad nomenclature: ${fname}`);
        await docs.moveToRejectRecord(fname, 'bad_nomenclature');
        await ensureDir(PATHS.REJETS);
        moveSafe(abs, path.join(PATHS.REJETS, fname));
        continue;
      }

      // 3) Doublon ?
      const existing = docs.getByName(fname);
      if (existing) {
        console.log(`Reject duplicate: ${fname}`);
        await docs.moveToRejectRecord(fname, 'duplicate');
        await ensureDir(PATHS.REJETS);
        moveSafe(abs, path.join(PATHS.REJETS, fname));
        continue;
      }

      // 4) Mesures & déplacement
      const sizeKB = fileSizeKB(abs);
      const totalPages = countPages(buf);

      await ensureDir(PATHS.INPROGRESS);
      const target = path.join(PATHS.INPROGRESS, fname);
      await moveSafe(abs, target);

      // 5) Enregistrement DB
      await docs.upsert({
        name: fname,
        source: sourceType,         // InPrint | InReprint
        status,                     // pending | reprint_pending
        size_kb: sizeKB,
        total_pages: totalPages,
        prefix: parts.prefix,
        dpt: parts.dpt,
        spr: parts.spr,
        com: parts.com,
        lvo: parts.lvo,
        bur: parts.bur,
        run: parts.run,
      });

      console.log(`Scanned ${sourceType}: ${fname} (${totalPages} pages, ${sizeKB} Ko)`);
    } catch (e) {
      console.error(`Scan ${sourceType} error:`, e.message);
      try {
        await ensureDir(PATHS.REJETS);
        await moveSafe(abs, path.join(PATHS.REJETS, fname));
      } catch {}
    }
  }
}

function startScanner() {
  setInterval(async () => {
    try {
      await scanDir(DIRS.InPrint, 'InPrint', 'pending');
      await scanDir(DIRS.InReprint, 'InReprint', 'reprint_pending');
    } catch (e) {
      console.error('Scanner loop error:', e);
    }
  }, SCAN_INTERVAL_MS);
}

module.exports = { startScanner };