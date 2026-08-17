if (!requireLogin()) throw new Error("redirecting");

let currentUserId = null;

async function loadCurrentUser() {
  const res = await fetch("/api/auth/me", { headers: authHeaders() });
  if (res.status === 401) { clearSession(); window.location.href = "login.html"; return; }
  const data = await res.json();
  currentUserId = data.user.id;
  if (data.user.role !== "admin") {
    alert("Khusus admin.");
    window.location.href = "index.html";
  }
}

async function loadStats() {
  const res = await fetch("/api/admin/stats", { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) return showMsg(data.error, true);
  const cards = [
    ["Total User", data.totalUsers], ["User Premium", data.paidUsers], ["User Gratis", data.freeUsers], ["Di-suspend", data.bannedUsers],
    ["Total Revenue", `Rp ${data.totalRevenue.toLocaleString("id-ID")}`], ["Transaksi Sukses", data.totalPayments],
    ["Convert Hari Ini", data.conversionsToday], ["Daftar Hari Ini", data.signupsToday],
  ];
  document.getElementById("statGrid").innerHTML = cards.map(([label, num]) => `<div class="stat-card"><div class="num">${num}</div><div class="label">${label}</div></div>`).join("");
}

async function loadUsers() {
  const res = await fetch("/api/admin/users", { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) return showMsg(data.error, true);

  document.getElementById("userRows").innerHTML = data.users.map((u) => {
    const expiry = u.paidUntil ? new Date(u.paidUntil).toLocaleDateString("id-ID") : (u.tier === "paid" ? "Selamanya" : "-");
    return `
      <tr>
        <td><div style="display:flex;align-items:center;gap:8px"><img src="${u.avatarUrl || ""}" style="width:24px;height:24px;border-radius:50%" /><div><div>${u.username || "-"}</div><div class="muted" style="font-size:11px">${u.handle || ""}</div></div></div></td>
        <td><select onchange="setRole('${u.id}', this.value)" ${u.id === currentUserId ? "disabled" : ""}><option value="user" ${u.role === "user" ? "selected" : ""}>user</option><option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option></select></td>
        <td><select onchange="setTier('${u.id}', this.value)"><option value="free" ${u.tier === "free" ? "selected" : ""}>free</option><option value="paid" ${u.tier === "paid" ? "selected" : ""}>paid</option></select></td>
        <td>${expiry}</td>
        <td>${u.usageToday}</td>
        <td>${u.banned ? "🚫 Suspend" : "✅ Aktif"}</td>
        <td><button onclick="toggleBan('${u.id}', ${!u.banned})" class="${u.banned ? "" : "danger"}">${u.banned ? "Unban" : "Ban"}</button> <button onclick="removeUser('${u.id}')" class="danger" ${u.id === currentUserId ? "disabled" : ""}>Hapus</button></td>
      </tr>`;
  }).join("");
}

async function setTier(id, tier) {
  const days = tier === "paid" ? prompt("Berapa hari? (kosongkan = selamanya)") : null;
  const res = await fetch(`/api/admin/users/${id}/tier`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ tier, days: days ? Number(days) : undefined }) });
  const data = await res.json();
  if (!res.ok) return showMsg(data.error, true);
  showMsg("Tier diupdate", false);
  loadUsers();
}
async function setRole(id, role) {
  const res = await fetch(`/api/admin/users/${id}/role`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ role }) });
  const data = await res.json();
  if (!res.ok) return showMsg(data.error, true);
  showMsg("Role diupdate", false);
  loadUsers();
}
async function toggleBan(id, banned) {
  const res = await fetch(`/api/admin/users/${id}/ban`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ banned }) });
  const data = await res.json();
  if (!res.ok) return showMsg(data.error, true);
  loadUsers();
}
async function removeUser(id) {
  if (!confirm("Yakin hapus user ini?")) return;
  const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE", headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) return showMsg(data.error, true);
  loadUsers();
  loadStats();
}
function showMsg(text, isErr) {
  const el = document.getElementById("msg");
  el.textContent = text;
  el.className = "auth-msg " + (isErr ? "err" : "ok");
}

document.getElementById("logoutBtn").addEventListener("click", () => { clearSession(); window.location.href = "login.html"; });

loadCurrentUser().then(() => { loadStats(); loadUsers(); });
