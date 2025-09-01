-- YesDocu 2.1.0 — Migration: ajout colonne `source` sur `documents`
-- NOTE: Ce script suppose que la table `documents` existe déjà.

-- Tente d'ajouter la colonne (échouera si elle existe déjà).
ALTER TABLE documents ADD COLUMN source TEXT;

-- Renseigne la valeur par défaut sur les lignes existantes.
UPDATE documents
SET source = COALESCE(source, 'legacy');
