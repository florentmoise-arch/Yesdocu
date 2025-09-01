function requireAuth(req, res, next){
  if (!req.session.user) return res.status(401).json({ message:'Non authentifié' });
  next();
}
function requireRole(roles){
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ message:'Non authentifié' });
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ message:'Accès refusé' });
    next();
  };
}
module.exports = { requireAuth, requireRole };
