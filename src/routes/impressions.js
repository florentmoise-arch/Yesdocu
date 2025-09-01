const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { PATHS } = require('../config');
const HF = require('../services/hotfolders');
const DOC = require('../services/documents');
const { safeMove } = require('../utils/fsx');
const { buildMinimalJDF } = require('../services/jdf');
const fs = require('fs');
const path = require('path');

router.get('/', requireRole(['admin','responsable','operateur']), (req, res) => {
  res.json(DOC.listImpressions());
});

router.post('/process', requireRole(['admin','responsable','operateur']), (req, res) => {
  const { jobs, defaultHotfolder } = req.body || {};
  if (!Array.isArray(jobs) || jobs.length === 0) return res.status(400).json({ message:'Aucun job' });

  const done = [];
  for (const j of jobs) {
    const row = DOC.getByName(j.name);
    if (!row) continue;
    const hfName = j.hotfolder || defaultHotfolder;
    if (!hfName) continue;
    const hf = HF.getByName(hfName);
    if (!hf) continue;

    const src = path.join(PATHS.INPROGRESS, row.name);
    const dst = path.join(hf.path, row.name);
    if (!fs.existsSync(src)) continue;

    try {
      safeMove(src, dst);
      const jdfPath = dst.replace(/\.pdf$/i, '') + '.jdf';
      fs.writeFileSync(jdfPath, buildMinimalJDF(row.name, { copies:1, sides:'one-sided' }), 'utf8');

      DOC.upsert({
        name: row.name,
        prefix: row.prefix, dpt: row.dpt, spr: row.spr, com: row.com, lvo: row.lvo, bur: row.bur, run: row.run,
        total_pages: row.total_pages, printed_pages: row.printed_pages, size_kb: row.size_kb,
        status: 'en_cours', dest_hotfolder: hf.name, reprint_count: row.reprint_count,
        created_at: row.created_at, updated_at: new Date().toISOString()
      });

      done.push(row.name);
    } catch(e){ console.error('Soumission impression échouée:', row.name, e.message); }
  }
  res.json({ ok:true, submitted: done });
});

module.exports = router;
