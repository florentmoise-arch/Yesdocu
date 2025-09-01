-- Affiche toutes les tables de la base
SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';
