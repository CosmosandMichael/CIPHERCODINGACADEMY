const { publicUser } = require("./db");
function requireAuth(req, res, next) {
 if (!req.session.user) return res.status(401).json({ error: "Please sign in first." });
 const user = publicUser(req.session.user.id);
 if (!user || user.status !== "active") {
  req.session.destroy(() => {});
  return res.status(401).json({ error: "This account is not active." });
 }
 req.user = user;
 next();
}
function allow(...roles) {
 return (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "You do not have permission to do that." });
  next();
 };
}
module.exports = { requireAuth, allow };
