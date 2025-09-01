const express = require('express');
const router = express.Router();

router.use('/auth',       require('./auth'));
router.use('/hotfolders', require('./hotfolders'));
router.use('/admin',      require('./hotfolders')); // reset pwd aussi dans ce module
router.use('/',           require('./documents'));  // /impressions /reimpressions /suivi
router.use('/process',    require('./process'));
router.use('/health',     require('./health'));

module.exports = router;