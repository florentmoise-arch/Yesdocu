const app = require('./app');
const { APP_VERSION, PORT, SCAN_INTERVAL_MS } = require('./config');
const { PATHS } = require('./config');
const { ensureDataDirs } = require('./utils/fsx');
const scanner = require('./jobs/scanner');

ensureDataDirs();

app.listen(PORT, () => {
  console.log(`${APP_VERSION} — serveur sur http://localhost:${PORT}`);
  console.log('Dossiers:');
  console.log('  InPrint:    ', PATHS.INPRINT);
  console.log('  InReprint:  ', PATHS.INREPRINT);
  console.log('  InProgress: ', PATHS.INPROGRESS);
  console.log('  Rejets:     ', PATHS.REJETS);
});

// Lancement du scanner
scanner.start(SCAN_INTERVAL_MS);