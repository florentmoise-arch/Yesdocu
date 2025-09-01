DELETE FROM documents
WHERE status IN ('pending','reprint_pending','en_cours','rejete');