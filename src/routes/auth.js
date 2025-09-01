const express = require('express');
const router = express.Router();
const { APP_VERSION, WEB_VERSION } = require('../config');
const { findUser, verifyPassword, DEFAULT_USERS } = require('../services/users');

router.get('/me', (req, res) => {
  let user = null;
  try { if (req.cookies?.yd_user) user = JSON.parse(req.cookies.yd_user); } catch {}
  res.json({ user, versions: { app: APP_VERSION, web: WEB_VERSION } });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'Identifiants requis' });

  const row = findUser(username);
  if (row && verifyPassword(password, row)) {
    const user = { username, role: row.role || 'operateur' };
    res.cookie('yd_user', JSON.stringify(user), { httpOnly: false });
    return res.json({ ok: true, user });
  }
  const def = DEFAULT_USERS[username];
  if (def && def.password === password) {
    const user = { username, role: def.role };
    res.cookie('yd_user', JSON.stringify(user), { httpOnly: false });
    return res.json({ ok: true, user });
  }
  return res.status(401).json({ message: 'Login invalide' });
});

router.post('/logout', (req, res) => { res.clearCookie('yd_user'); res.json({ ok: true }); });

module.exports = router;