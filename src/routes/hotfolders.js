const express = require('express');
const router = express.Router();
const { listHotfolders, addHotfolder, resetPassword } = require('../services/hotfolders');

// GET /api/hotfolders
router.get('/', async (req, res) => {
  const rows = await listHotfolders();
  res.json(rows);
});

// POST /api/admin/hotfolders  {name, path}
router.post('/hotfolders', async (req, res) => {
  const { name, path } = req.body || {};
  if (!name || !path) return res.status(400).json({ message: 'Nom et chemin requis' });
  await addHotfolder(name, path);
  res.json({ ok: true });
});

// POST /api/admin/reset-password {username, newPassword}
router.post('/reset-password', async (req, res) => {
  const { username, newPassword } = req.body || {};
  if (!username || !newPassword) return res.status(400).json({ message: 'Champs requis' });
  const { ok, note } = await resetPassword(username, newPassword);
  res.json({ ok, note });
});

module.exports = router;