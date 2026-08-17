const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-this-in-production";
const TOKEN_TTL = "30d";

function issueToken(user) {
  return jwt.sign({ sub: user.id, discordId: user.discordId, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { issueToken, verifyToken };
