const express = require('express');
const router = express.Router();
const { listImpressions, listReimpressions, listSuivi } = require('../services/documents');

// /api/impressions
router.get('/impressions', async (req, res) => {
  res.json(await listImpressions());
});

// /api/reimpressions
router.get('/reimpressions', async (req, res) => {
  res.json(await listReimpressions());
});

// /api/suivi
router.get('/suivi', async (req, res) => {
  res.json(await listSuivi());
});

module.exports = router;