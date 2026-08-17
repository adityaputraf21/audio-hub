if (!requireLogin()) throw new Error("redirecting");

const state = { all: [], activeStatus: "all", query: "" };
const AUTO_POLL_INTERVAL_MS = 15000;

const els = {
  grid: document.getElementById("historyGrid"),
  searchInput: document.getElementById("searchInput"),
  refreshBtn: document.getElementById("refreshBtn"),
  exportBtn: document.getElementById("exportBtn"),
  tabs: document.querySelectorAll(".status-tab"),
  countAll: document.getElementById("countAll"),
  countActive: document.getElementById("countActive"),
  countPending: document.getElementById("countPending"),
  countRemoved: document.getElementById("countRemoved"),
  whoName: document.getElementById("whoName"),
  whoAvatar: document.getElementById("whoAvatar"),
  adminNavLink: document.getElementById("adminNavLink"),
  logoutBtn: document.getElementById("logoutBtn"),
  autoPollNote: document.getElementById("autoPollNote"),
};

function getStoredRobloxApiKey() {
  try {
    const saved = JSON.parse(localStorage.getItem("robloxAudioCreds") || "{}");
    return saved.apiKey || null;
  } catch {
    return null;
  }
}

async function loadWho() {
  try {
    const res = await fetch("/api/auth/me", { headers: authHeaders() });
    if (res.status === 401) { clearSession(); window.location.href = "login.html"; return; }
    const data = await res.json();
    els.whoName.textContent = data.user.username;
    if (data.user.avatarUrl) { els.whoAvatar.src = data.user.avatarUrl; els.whoAvatar.style.display = ""; }
    if (data.user.role === "admin") els.adminNavLink.style.display = "";
  } catch {}
}
els.logoutBtn.addEventListener("click", () => { clearSession(); window.location.href = "login.html"; });

async function loadHistory(silent) {
  if (!silent) els.grid.innerHTML = `<div class="empty-state"><p>Loading...</p></div>`;
  try {
    const res = await fetch("/api/history", { headers: authHeaders() });
    if (res.status === 401) { clearSession(); window.location.href = "login.html"; return; }
    const data = await res.json();
    state.all = data.history || [];
    render();
  } catch {
    if (!silent) els.grid.innerHTML = `<div class="empty-state"><p>GAGAL MEMUAT DATA</p></div>`;
  }
}

function updateCounts() {
  const counts = { all: state.all.length, active: 0, pending: 0, removed: 0 };
  state.all.forEach((h) => { const s = h.status || "active"; if (counts[s] !== undefined) counts[s]++; });
  els.countAll.textContent = counts.all;
  els.countActive.textContent = counts.active;
  els.countPending.textContent = counts.pending;
  els.countRemoved.textContent = counts.removed;
}

function render() {
  updateCounts();
  let filtered = state.all;
  if (state.activeStatus !== "all") filtered = filtered.filter((h) => (h.status || "active") === state.activeStatus);
  if (state.query) {
    const q = state.query.toLowerCase();
    filtered = filtered.filter((h) => (h.title || "").toLowerCase().includes(q) || (h.artist || "").toLowerCase().includes(q) || (h.assetId || "").toLowerCase().includes(q));
  }
  if (!filtered.length) {
    els.grid.innerHTML = `<div class="empty-state"><div class="empty-icon">◎</div><p>NO ASSETS FOUND</p></div>`;
    return;
  }
  els.grid.innerHTML = "";
  filtered.forEach((entry) => els.grid.appendChild(buildRow(entry)));
}

const STATUS_LABELS = { active: "active", pending: "pending", removed: "rejected/removed" };

function buildRow(entry) {
  const row = document.createElement("div");
  row.className = "asset-row";
  const status = entry.status || "active";
  const when = new Date(entry.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const assetLabel = entry.assetId ? `rbxassetid://${entry.assetId}` : "—";
  const reasonLine = status === "removed" && entry.rejectReason ? `<div class="reject-reason">${escapeHtml(entry.rejectReason.slice(0, 150))}</div>` : "";

  row.innerHTML = `
    <div class="asset-info">
      <span class="asset-title">${escapeHtml(entry.title)}</span>
      <span class="asset-meta">${entry.artist ? escapeHtml(entry.artist) + " · " : ""}${entry.format || ""} · ${entry.sizeMb || "?"} MB · ${when}</span>
      ${reasonLine}
    </div>
    <div class="asset-right">
      <span class="status-badge ${status}">${STATUS_LABELS[status] || status}</span>
      <button class="asset-id-btn" data-copy="${assetLabel}">${assetLabel}</button>
      ${status === "pending" ? `<button class="recheck-btn" data-recheck="${entry.id}">Recheck</button>` : ""}
    </div>`;

  row.querySelector(".asset-id-btn").addEventListener("click", (e) => {
    if (!entry.assetId) return;
    navigator.clipboard.writeText(assetLabel).catch(() => {});
    const btn = e.currentTarget;
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = original), 1200);
  });
  const recheckBtn = row.querySelector("[data-recheck]");
  if (recheckBtn) recheckBtn.addEventListener("click", () => recheckEntry(entry.id, recheckBtn));
  return row;
}

async function recheckEntry(id, btnEl) {
  btnEl.disabled = true;
  btnEl.textContent = "Checking...";
  try {
    let apiKey = getStoredRobloxApiKey();
    if (!apiKey) apiKey = prompt("Masukin Open Cloud API Key Roblox buat re-check status (simpan di halaman Audio Converter biar gak ditanya lagi):");
    if (!apiKey) { btnEl.disabled = false; btnEl.textContent = "Recheck"; return; }
    const res = await fetch(`/api/history/${id}/recheck`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ apiKey }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await loadHistory();
  } catch (err) {
    alert(`Gagal recheck: ${err.message}`);
    btnEl.disabled = false;
    btnEl.textContent = "Recheck";
  }
}

// ---------- auto-poll pending items using the saved API key ----------
// LIMITATION: this reflects Roblox's initial moderation outcome. There is
// no official Roblox API to detect an asset being taken down later (e.g.
// from a user report days after upload) — so "active" here means "passed
// Roblox's automated review", not "guaranteed to stay up forever".
let pollTimer = null;
async function autoPollPending() {
  const hasPending = state.all.some((h) => h.status === "pending");
  const apiKey = getStoredRobloxApiKey();

  if (els.autoPollNote) {
    if (!apiKey) {
      els.autoPollNote.textContent = "💡 Simpan Open Cloud API Key di halaman Audio Converter biar status pending di-cek otomatis di sini.";
      els.autoPollNote.classList.remove("hidden");
    } else if (hasPending) {
      els.autoPollNote.textContent = "🔄 Auto-refresh aktif — status pending dicek ulang tiap 15 detik.";
      els.autoPollNote.classList.remove("hidden");
    } else {
      els.autoPollNote.classList.add("hidden");
    }
  }

  if (!apiKey || !hasPending) return;

  try {
    const res = await fetch("/api/history/recheck-all", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ apiKey }),
    });
    if (res.ok) {
      const data = await res.json();
      state.all = data.history || state.all;
      render();
    }
  } catch {
    // silent — will just retry on the next interval tick
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    state.activeStatus = tab.dataset.status;
    render();
  });
});

let searchTimeout;
els.searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => { state.query = els.searchInput.value.trim(); render(); }, 200);
});
els.refreshBtn.addEventListener("click", () => loadHistory());

els.exportBtn.addEventListener("click", async () => {
  els.exportBtn.disabled = true;
  els.exportBtn.textContent = "⏳ Menyiapkan...";
  try {
    const res = await fetch("/api/history/export.csv", { headers: authHeaders() });
    if (!res.ok) throw new Error("Gagal export CSV");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audio-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message);
  } finally {
    els.exportBtn.disabled = false;
    els.exportBtn.textContent = "⬇ Export CSV";
  }
});

loadWho();
loadHistory().then(() => {
  autoPollPending();
  pollTimer = setInterval(autoPollPending, AUTO_POLL_INTERVAL_MS);
});
