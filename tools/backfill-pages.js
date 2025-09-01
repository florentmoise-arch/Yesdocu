// tools/backfill-pages.js
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { countPages } = require('../src/utils/pdf');
const config = require('../src/config');
const { PATHS } = config;

(async () => {
  const db = new Database(PATHS.DB, { fileMustExist: true });
  const rows = db.prepare(`SELECT name FROM documents WHERE IFNULL(total_pages,0)=0`).all();
  if (!rows.length) {
    console.log('✔ Rien à corriger (aucun total_pages = 0)');
    process.exit(0);
  }

  let fixed = 0;
  for (const { name } of rows) {
    const candidates = [
      path.join(PATHS.INPROGRESS, name),
      path.join(PATHS.INPRINT, name),
      path.join(PATHS.INREPRINT, name),
    ];
    const file = candidates.find(f => fs.existsSync(f));
    if (!file) { console.log('… introuvable :', name); continue; }

    try {
      const pages = await countPages(file);
      if (pages > 0) {
        db.prepare(`UPDATE documents SET total_pages=?, updated_at=datetime('now') WHERE name=?`).run(pages, name);
        console.log(`✔ ${name} => ${pages} pages`);
        fixed++;
      } else {
        console.log(`… ${name} => 0 page (impossible de lire)`);
      }
    } catch (e) {
      console.log(`✖ ${name} : ${e.message}`);
    }
  }

  console.log(`\nTerminé. ${fixed} document(s) corrigé(s).`);
})();