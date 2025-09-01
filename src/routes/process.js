const express = require('express');
const router = express.Router();
const { submitImpressions, submitReimpressions } = require('../services/printing');

// POST /api/process/impressions
router.post('/impressions', async (req, res) => {
  const { jobs = [], defaultHotfolder } = req.body || {};
  if (!Array.isArray(jobs) || jobs.length === 0) return res.status(400).json({ message: 'Aucun job' });
  if (!defaultHotfolder) return res.status(400).json({ message: 'Imprimante (lot) manquante' });
  const out = await submitImpressions(jobs, defaultHotfolder);
  res.status(out.ok ? 200 : 400).json(out);
});

// POST /api/process/reimpressions
router.post('/reimpressions', async (req, res) => {
  const { jobs = [], defaultHotfolder } = req.body || {};
  if (!Array.isArray(jobs) || jobs.length === 0) return res.status(400).json({ message: 'Aucun job' });
  if (!defaultHotfolder) return res.status(400).json({ message: 'Imprimante (lot) manquante' });
  const out = await submitReimpressions(jobs, defaultHotfolder);
  res.status(out.ok ? 200 : 400).json(out);
});

module.exports = router;