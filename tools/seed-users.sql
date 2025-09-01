-- YesDocu 2.1.0 — Seed/repair users par défaut

-- Crée les comptes s'ils n'existent pas
INSERT OR IGNORE INTO users (username, password, role)
VALUES
  ('admin',       'admin',       'admin'),
  ('responsable', 'responsable', 'responsable'),
  ('operateur',   'operateur',   'operateur'),
  ('superviseur', 'superviseur', 'superviseur');

-- Si la colonne password existe mais est NULL/vides, on remet une valeur
UPDATE users SET password='admin',       updated_at=datetime('now') WHERE username='admin'       AND (password IS NULL OR password='');
UPDATE users SET password='responsable', updated_at=datetime('now') WHERE username='responsable' AND (password IS NULL OR password='');
UPDATE users SET password='operateur',   updated_at=datetime('now') WHERE username='operateur'   AND (password IS NULL OR password='');
UPDATE users SET password='superviseur', updated_at=datetime('now') WHERE username='superviseur' AND (password IS NULL OR password='');