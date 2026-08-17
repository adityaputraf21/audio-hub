const express = require("express");
const router = express.Router();
const db = require("../services/db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

router.use(requireAuth, requireAdmin);

router.get("/users", (req, res) => {
  const users = db.getUsers().map((u) => {
    const { passwordHash, ...safe } = u;
    return { ...safe, usageToday: db.getUsageToday(u.id) };
  });
  res.json({ users });
});

router.post("/users/:id/tier", async (req, res) => {
  const { tier, days } = req.body;
  if (!["free", "paid"].includes(tier)) return res.status(400).json({ error: "tier harus free/paid" });
  const patch = { tier };
  if (tier === "paid" && days) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + Number(days));
    patch.paidUntil = expiry.toISOString();
  } else {
    patch.paidUntil = null;
  }
  const updated = await db.updateUser(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: "User tidak ditemukan" });
  const { passwordHash, ...safe } = updated;
  res.json({ user: safe });
});

router.post("/users/:id/ban", async (req, res) => {
  const updated = await db.updateUser(req.params.id, { banned: !!req.body.banned });
  if (!updated) return res.status(404).json({ error: "User tidak ditemukan" });
  const { passwordHash, ...safe } = updated;
  res.json({ user: safe });
});

router.post("/users/:id/role", async (req, res) => {
  const { role } = req.body;
  if (!["user", "admin"].includes(role)) return res.status(400).json({ error: "role harus user/admin" });
  const updated = await db.updateUser(req.params.id, { role });
  if (!updated) return res.status(404).json({ error: "User tidak ditemukan" });
  const { passwordHash, ...safe } = updated;
  res.json({ user: safe });
});

router.delete("/users/:id", async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "Gak bisa hapus akun sendiri" });
  await db.deleteUser(req.params.id);
  res.json({ ok: true });
});

router.get("/stats", (req, res) => {
  const users = db.getUsers();
  const payments = db.getPayments().filter((p) => p.status === "paid");
  const revenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const today = db.todayKey();
  res.json({
    totalUsers: users.length,
    paidUsers: users.filter((u) => u.tier === "paid").length,
    freeUsers: users.filter((u) => u.tier !== "paid").length,
    bannedUsers: users.filter((u) => u.banned).length,
    totalRevenue: revenue,
    totalPayments: payments.length,
    conversionsToday: users.reduce((sum, u) => sum + db.getUsageToday(u.id), 0),
    signupsToday: users.filter((u) => (u.createdAt || "").slice(0, 10) === today).length,
  });
});

module.exports = router;
