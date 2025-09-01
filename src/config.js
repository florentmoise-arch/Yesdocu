const path = require('path');

const ROOT = path.resolve(__dirname, '..');

module.exports = {
  APP_VERSION: `YesDocu 2.3.0 — ${new Date().toISOString().slice(0,10)}`,
  WEB_VERSION: `WEB 1.0.7 — ${new Date().toISOString().slice(0,10)}`,
  PORT: process.env.PORT || 3000,
  PATHS: {
    ROOT,
    DB: path.join(ROOT, 'db', 'yesdocu.db'),
    PUBLIC: path.join(ROOT, 'public'),
    DATA: path.join(ROOT, 'data'),
    INPRINT: path.join(ROOT, 'data', 'InPrint'),
    INREPRINT: path.join(ROOT, 'data', 'InReprint'),
    INPROGRESS: path.join(ROOT, 'data', 'InProgress'),
    REJETS: path.join(ROOT, 'data', 'Rejets')
  },
  SCAN_INTERVAL_MS: 2000
};
