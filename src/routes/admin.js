const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { resetPassword } = require('../services/users');
const HF = require('../services/hotfolders');

router.post('/reset', requireRole(['admin']), (req, res) => {
  const { username, newPassword } = req.body || {};
  if (!username || !newPassword) return res.status(400).json({ message:'username + password requis' });
  const ok = resetPassword(username, newPassword);
  if (!ok) return res.status(404).json({ message:'Utilisateur introuvable' });
  res.json({ ok:true });
});

router.post('/hotfolders', requireRole(['admin']), (req, res) => {
  const { name, path } = req.body || {};
  if (!name || !path) return res.status(400).json({ message:'Nom + Chemin requis' });
  try { HF.add(name, path); res.json({ ok:true }); }
  catch(e){ res.status(400).json({ message:'Ajout impossible (doublon ?)' }); }
});

router.delete('/hotfolders/:name', requireRole(['admin']), (req, res) => {
  HF.remove(req.params.name);
  res.json({ ok:true });
});

module.exports = router;
