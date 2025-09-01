const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const DOC = require('../services/documents');

router.get('/', requireRole(['admin','responsable','operateur','superviseur']), (req, res) => {
  res.json(DOC.listSuivi());
});

module.exports = router;
