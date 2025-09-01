const express = require('express');
const router = express.Router();
const { dbInfo } = require('../services/db');
const { APP_VERSION, WEB_VERSION } = require('../config');

router.get('/', (req, res) => {
  const info = dbInfo();
  res.json({
    ok: true,
    app: APP_VERSION,
    web: WEB_VERSION,
    db: !!info.db,
    tables: info.tables,
  });
});

module.exports = router;