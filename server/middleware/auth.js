const { verifyToken } = require("../services/auth");
const db = require("../services/db");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : req.cookies?.token;
  if (!token) return res.status(401).json({ error: "Belum login" });
  try {
    const payload = verifyToken(token);
    const user = db.findUserById(payload.sub);
    if (!user) return res.status(401).json({ error: "User tidak ditemukan" });
    if (user.banned) return res.status(403).json({ error: "Akun kamu di-suspend. Hubungi admin." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Sesi habis, silakan login ulang" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "Khusus admin" });
  next();
}

module.exports = { requireAuth, requireAdmin };
