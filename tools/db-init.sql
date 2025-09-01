-- YesDocu 2.1.0 — Initialisation base

PRAGMA foreign_keys=ON;

-- =========================
-- Utilisateurs
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT,                 -- en clair par défaut ; tu peux ensuite réinitialiser via l’IHM
  role TEXT NOT NULL,            -- admin | responsable | operateur | superviseur
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Ajout d'utilisateurs par défaut si absents
INSERT OR IGNORE INTO users (username, password, role)
VALUES
  ('admin',       'admin',       'admin'),
  ('responsable', 'responsable', 'responsable'),
  ('operateur',   'operateur',   'operateur'),
  ('superviseur', 'superviseur', 'superviseur');

-- =========================
-- Hotfolders
-- =========================
CREATE TABLE IF NOT EXISTS hotfolders (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- =========================
-- Documents
-- =========================
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,                 -- nom de fichier
  source TEXT NOT NULL DEFAULT 'legacy',     -- InPrint | InReprint | scanner | legacy
  status TEXT NOT NULL DEFAULT 'pending',    -- pending|en_cours|imprime|rejete|reprint_pending|reprint_en_cours
  size_kb INTEGER,
  total_pages INTEGER,
  prefix TEXT,
  dpt TEXT,
  spr TEXT,
  com TEXT,
  lvo TEXT,
  bur TEXT,
  run TEXT,
  dest_hotfolder TEXT,                       -- nom du hotfolder choisi
  reprint_count INTEGER DEFAULT 0,
  printed_pages INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- =========================
-- Index utiles
-- =========================
CREATE INDEX IF NOT EXISTS idx_documents_name          ON documents(name);
CREATE INDEX IF NOT EXISTS idx_documents_status        ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at    ON documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_prefix_fields ON documents(prefix, dpt, spr, com, lvo, bur, run);

-- =========================
-- Vues (optionnelles)
-- =========================
CREATE VIEW IF NOT EXISTS v_impressions AS
  SELECT * FROM documents WHERE status='pending' ORDER BY updated_at DESC;

CREATE VIEW IF NOT EXISTS v_reimpressions AS
  SELECT * FROM documents WHERE status='reprint_pending' ORDER BY updated_at DESC;

CREATE VIEW IF NOT EXISTS v_suivi AS
  SELECT * FROM documents ORDER BY updated_at DESC;
