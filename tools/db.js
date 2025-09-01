const { PATHS } = require('../src/config');
const Database = require('better-sqlite3');
const db = new Database(PATHS.DB);

const cmd = process.argv[2];
const arg = process.argv[3];

if (cmd === 'list-tables') {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  console.table(tables);
} else if (cmd === 'describe-table' && arg) {
  const info = db.prepare(`PRAGMA table_info(${arg})`).all();
  console.table(info);
} else if (cmd === 'dump-table' && arg) {
  const rows = db.prepare(`SELECT * FROM ${arg}`).all();
  console.table(rows);
} else {
  console.log("❌ Commande inconnue. Utilise : list-tables, describe-table <table>, dump-table <table>");
}