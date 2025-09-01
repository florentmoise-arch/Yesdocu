const path = require('path');
const Database = require('better-sqlite3');

// Chemin relatif vers la base depuis le dossier tools
const dbPath = path.join(__dirname, '../db/yesdocu.db');
const db = new Database(dbPath);

// Impressions du jour (01 septembre 2025)
const rows = db.prepare(`
  SELECT * FROM impressions
  WHERE date LIKE '2025-09-01%'
`).all();

// Affichage formaté
console.log(`🖨️ Impressions du ${new Date().toLocaleDateString('fr-FR')} :`);
rows.forEach((row, i) => {
  console.log(`\n📄 ${i + 1}. Nom: ${row.nom_fichier}`);
  console.log(`   Type: ${row.type} | Dpt: ${row.dpt}`);
  console.log(`   Pages: ${row.pages} | Taille: ${row.taille} Ko`);
  console.log(`   Date: ${row.date}`);
});
