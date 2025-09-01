// tools/reset-user.js
// Usage:
//   node tools/reset-user.js <username> <password> [role]
// Exemples:
//   node tools/reset-user.js admin admin
//   node tools/reset-user.js responsable responsable responsable

const path = require('path');
const Database = require('better-sqlite3');

// Récupère la config du projet (chemin DB) + util de hash
const { PATHS } = require('../src/config');
const { hashPassword } = require('../src/utils/password');

const username = process.argv[2] || 'admin';
const password = process.argv[3] || 'admin';
const role     = process.argv[4] || 'admin'; // utilisé uniquement si création

// Rôles autorisés (doit correspondre au backend)
const ALLOWED_ROLES = new Set(['admin','responsable','operateur','superviseur']);
if (!ALLOWED_ROLES.has(role)) {
  console.error(`❌ Rôle invalide "${role}". Rôles valides: admin, responsable, operateur, superviseur`);
  process.exit(1);
}

const db = new Database(PATHS.DB);
db.pragma('journal_mode = WAL');

const nowISO = () => new Date().toISOString();

// Vérifie si l'utilisateur existe déjà
const row = db.prepare(`SELECT id, username, role FROM users WHERE username = ?`).get(username);

if (row) {
  db.prepare(`UPDATE users SET password_hash = ?, created_at = ? WHERE id = ?`)
    .run(hashPassword(password), nowISO(), row.id);
  console.log(`✅ Mot de passe réinitialisé pour "${row.username}" (rôle: ${row.role})`);
} else {
  db.prepare(`INSERT INTO users(username, password_hash, role, created_at) VALUES (?,?,?,?)`)
    .run(username, hashPassword(password), role, nowISO());
  console.log(`✅ Utilisateur créé: ${username} (rôle: ${role})`);
}

console.log(`DB: ${PATHS.DB}`);