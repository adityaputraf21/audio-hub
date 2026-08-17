const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const FILES = {
  users: path.join(DATA_DIR, "users.json"),
  usage: path.join(DATA_DIR, "usage.json"),
  payments: path.join(DATA_DIR, "payments.json"),
  uploads: path.join(DATA_DIR, "uploads.json"),
};

function readJson(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf8") || "[]");
  } catch {
    return [];
  }
}

// naive write queue avoids concurrent writes tearing the file — fine for
// hobby-scale traffic, not meant for heavy concurrency
let writeQueue = Promise.resolve();
function writeJson(file, data) {
  writeQueue = writeQueue.then(
    () =>
      new Promise((resolve, reject) => {
        fs.writeFile(file, JSON.stringify(data, null, 2), (err) => (err ? reject(err) : resolve()));
      })
  );
  return writeQueue;
}

// ---------- users ----------
const getUsers = () => readJson(FILES.users);
const saveUsers = (users) => writeJson(FILES.users, users);
const findUserByDiscordId = (id) => getUsers().find((u) => u.discordId === id);
const findUserById = (id) => getUsers().find((u) => u.id === id);
async function insertUser(user) {
  const users = getUsers();
  users.push(user);
  await saveUsers(users);
  return user;
}
async function updateUser(id, patch) {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...patch };
  await saveUsers(users);
  return users[idx];
}
async function deleteUser(id) {
  await saveUsers(getUsers().filter((u) => u.id !== id));
}

// ---------- usage (per-day counters) ----------
const todayKey = () => new Date().toISOString().slice(0, 10);
function getUsageToday(userId) {
  const entry = readJson(FILES.usage).find((u) => u.userId === userId && u.date === todayKey());
  return entry ? entry.count : 0;
}
async function incrementUsage(userId) {
  const usage = readJson(FILES.usage);
  const date = todayKey();
  const idx = usage.findIndex((u) => u.userId === userId && u.date === date);
  if (idx === -1) usage.push({ userId, date, count: 1 });
  else usage[idx].count += 1;
  await writeJson(FILES.usage, usage);
}

// ---------- payments ----------
const getPayments = () => readJson(FILES.payments);
async function insertPayment(payment) {
  const payments = getPayments();
  payments.push(payment);
  await writeJson(FILES.payments, payments);
  return payment;
}
async function updatePaymentByOrderId(orderId, patch) {
  const payments = getPayments();
  const idx = payments.findIndex((p) => p.orderId === orderId);
  if (idx === -1) return null;
  payments[idx] = { ...payments[idx], ...patch };
  await writeJson(FILES.payments, payments);
  return payments[idx];
}

// ---------- upload history ----------
function getUploadHistory(userId, limit = 200) {
  return readJson(FILES.uploads)
    .filter((u) => u.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}
async function insertUploadRecord(record) {
  const all = readJson(FILES.uploads);
  all.push(record);
  await writeJson(FILES.uploads, all);
  return record;
}
async function updateUploadRecord(id, patch) {
  const all = readJson(FILES.uploads);
  const idx = all.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  await writeJson(FILES.uploads, all);
  return all[idx];
}
const findUploadRecordById = (id) => readJson(FILES.uploads).find((u) => u.id === id);

module.exports = {
  getUsers,
  findUserByDiscordId,
  findUserById,
  insertUser,
  updateUser,
  deleteUser,
  getUsageToday,
  incrementUsage,
  getPayments,
  insertPayment,
  updatePaymentByOrderId,
  todayKey,
  getUploadHistory,
  insertUploadRecord,
  updateUploadRecord,
  findUploadRecordById,
};
