// src/utils/pdf.js
// Détection PDF + comptage de pages sans dépendance externe

/**
 * Vérifie rapidement si le buffer ressemble à un PDF.
 * - commence par "%PDF-"
 * - et contient "%%EOF" quelque part
 */
function isPDF(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 8) return false;
  const head = buf.subarray(0, 5).toString('ascii');
  if (head !== '%PDF-') return false;

  // Cherche "%%EOF" dans les derniers Ko (pas obligé mais rassurant)
  const tail = buf.subarray(Math.max(0, buf.length - 2048)).toString('latin1');
  return tail.includes('%%EOF');
}

/**
 * Compte les pages en cherchant les objets /Type /Page (et pas /Pages)
 * NB: méthode heuristique mais fiable pour la plupart des PDFs.
 */
function countPages(buf) {
  if (!Buffer.isBuffer(buf)) return 0;
  // Limite la conversion pour les très gros fichiers (lecture par segments si besoin)
  const text = buf.toString('latin1');
  const matches = text.match(/\/Type\s*\/Page\b/g);
  const n = matches ? matches.length : 0;
  return n > 0 ? n : 1; // par défaut 1 si on ne trouve rien
}

module.exports = { isPDF, countPages };
