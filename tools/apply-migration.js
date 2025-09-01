// tools/apply-migration.js
// Usage: node tools/apply-migration.js tools\db-init.sql
// ou     node tools/apply-migration.js tools\migrate_users_add_password.sql

const fs = require('fs');
const Database = require('better-sqlite3');
const { PATHS } = require('../src/config');

function tableInfo(db, table) {
  try {
    return db.prepare(`PRAGMA table_info(${table})`).all();
  } catch {
    return [];
  }
}
function tableExists(db, table) {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
  return !!row;
}
function columnExists(db, table, col) {
  const cols = tableInfo(db, table);
  return cols.some(c => c.name.toLowerCase() === col.toLowerCase());
}
function shouldWrapInTx(sqlText) {
  return !/\bBEGIN\b/i.test(sqlText) && !/\bCOMMIT\b/i.test(sqlText);
}
function stripAlreadyExistingAddColumns(db, sql) {
  // Supprime les lignes ALTER déjà satisfaites (colonne existante)
  // Gère plusieurs ALTER lignes
  return sql
    .split(/\r?\n/)
    .filter(line => {
      const m = line.match(/^\s*ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)/i);
      if (!m) return true;
      const [, table, col] = m;
      if (!tableExists(db, table)) {
        console.log(`ℹ️ Table '${table}' absente. Cette ligne sera ignorée (exécute db-init d'abord si nécessaire): ${line.trim()}`);
        return false;
      }
      if (columnExists(db, table, col)) {
        console.log(`ℹ️ Colonne '${col}' déjà présente sur '${table}'. Ligne ignorée: ${line.trim()}`);
        return false;
      }
      return true;
    })
    .join('\n');
}

function main() {
  const sqlFile = process.argv[2];
  if (!sqlFile || !fs.existsSync(sqlFile)) {
    console.error("❌ Usage: node tools/apply-migration.js <sql-file>");
    process.exit(1);
  }

  const sqlRaw = fs.readFileSync(sqlFile, 'utf8');
  const db = new Database(PATHS.DB);

  // Nettoyage : retirer les ALTER redondants (colonnes déjà existantes)
  const sql = stripAlreadyExistingAddColumns(db, sqlRaw).trim();
  if (!sql) {
    console.log('ℹ️ Rien à appliquer (toutes les modifications semblent déjà en place).');
    process.exit(0);
  }

  try {
    const wrap = shouldWrapInTx(sql);
    if (wrap) db.exec('BEGIN');
    db.exec(sql);
    if (wrap) db.exec('COMMIT');
    console.log(`✅ Migration appliquée depuis ${sqlFile}`);
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch {}
    console.error('❌ Erreur de migration:', e.message);
    process.exit(1);
  }
}

main();
