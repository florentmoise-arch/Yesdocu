-- YesDocu 2.1.0 — Migration : ajouter la colonne `password` à la table `users`

-- ⚠️ Cette migration suppose que la table `users` existe déjà.
-- L'ALTER échouera si la colonne existe déjà ; notre script JS détecte ce cas et saute l'ALTER.

ALTER TABLE users ADD COLUMN password TEXT;

-- Optionnel : si la colonne vient d'être créée, on s'assure d'une valeur non NULL
UPDATE users SET password = COALESCE(password, '');
