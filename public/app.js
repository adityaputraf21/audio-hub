if (!requireLogin()) throw new Error("redirecting to login");

const state = {
  platform: "youtube",
  track: null,
  fileId: null,
  convertedMeta: null,
  selectedFile: null,
};

const PLATFORM_META = {
  youtube: { icon: "▶", placeholder: "Paste link YouTube" },
  spotify: { icon: "◉", placeholder: "Paste link Spotify" },
  soundcloud: { icon: "☁", placeholder: "Paste link SoundCloud" },
  tiktok: { icon: "♪", placeholder: "Paste link TikTok" },
  applemusic: { icon: "🎵", placeholder: "Paste link Apple Music" },
};

const els = {
  tabs: document.querySelectorAll(".ptab"),
  linkInputRow: document.getElementById("linkInputRow"),
  fileInputRow: document.getElementById("fileInputRow"),
  fileInput: document.getElementById("fileInput"),
  fileDropLabel: document.getElementById("fileDropLabel"),
  inputIcon: document.getElementById("inputIcon"),
  urlInput: document.getElementById("urlInput"),
  searchBtn: document.getElementById("searchBtn"),
  status: document.getElementById("status"),
  trackCard: document.getElementById("trackCard"),
  trackThumb: document.getElementById("trackThumb"),
  trackTitle: document.getElementById("trackTitle"),
  trackArtist: document.getElementById("trackArtist"),
  trackMeta: document.getElementById("trackMeta"),
  advToggle: document.getElementById("advToggle"),
  advArrow: document.getElementById("advArrow"),
  speedSlider: document.getElementById("speedSlider"),
  speedVal: document.getElementById("speedVal"),
  ampSlider: document.getElementById("ampSlider"),
  ampVal: document.getElementById("ampVal"),
  formatSelect: document.getElementById("formatSelect"),
  formatDetailLabel: document.getElementById("formatDetailLabel"),
  formatDetailValue: document.getElementById("formatDetailValue"),
  creatorSelect: document.getElementById("creatorSelect"),
  playbackNormalVal: document.getElementById("playbackNormalVal"),
  resetDefaultBtn: document.getElementById("resetDefaultBtn"),
  convertBtn: document.getElementById("convertBtn"),
  convertResult: document.getElementById("convertResult"),
  resultTitle: document.getElementById("resultTitle"),
  resultMeta: document.getElementById("resultMeta"),
  downloadBtn: document.getElementById("downloadBtn"),
  uploadBtn: document.getElementById("uploadBtn"),
  log: document.getElementById("log"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  userIdInput: document.getElementById("userIdInput"),
  groupIdInput: document.getElementById("groupIdInput"),
  saveCredsBtn: document.getElementById("saveCredsBtn"),
  whoName: document.getElementById("whoName"),
  whoAvatar: document.getElementById("whoAvatar"),
  tierBadge: document.getElementById("tierBadge"),
  adminNavLink: document.getElementById("adminNavLink"),
  upgradeCard: document.getElementById("upgradeCard"),
  upgradeBtn: document.getElementById("upgradeBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  usageBar: document.getElementById("usageBar"),
  upgradeModal: document.getElementById("upgradeModal"),
  planOptions: document.getElementById("planOptions"),
  closeModalBtn: document.getElementById("closeModalBtn"),
};

// ---------- session / topbar ----------
async function loadMe() {
  try {
    const res = await fetch("/api/auth/me", { headers: authHeaders() });
    if (res.status === 401) { clearSession(); window.location.href = "login.html"; return; }
    const data = await res.json();
    saveUser(data.user);
    els.whoName.textContent = data.user.username || "User";
    if (data.user.avatarUrl) { els.whoAvatar.src = data.user.avatarUrl; els.whoAvatar.style.display = ""; }
    if (data.user.role === "admin") els.adminNavLink.style.display = "";

    if (data.usage.tier === "paid") {
      els.tierBadge.textContent = "PREMIUM";
      els.tierBadge.className = "badge paid";
      els.usageBar.innerHTML = `<span>✨ Kamu Premium — convert unlimited</span>`;
      els.usageBar.classList.remove("warn");
      els.upgradeCard.style.display = "none";
    } else {
      els.tierBadge.textContent = "FREE";
      els.tierBadge.className = "badge free";
      const { used, limit, remaining } = data.usage;
      els.usageBar.innerHTML = `<span>Jatah gratis hari ini: <strong>${used}/${limit}</strong></span><span>${remaining} tersisa</span>`;
      els.usageBar.classList.toggle("warn", remaining === 0);
      els.upgradeCard.style.display = "";
    }
  } catch {}
}
els.logoutBtn.addEventListener("click", () => { clearSession(); window.location.href = "login.html"; });

// ---------- Roblox creds (local) ----------
function loadCreds() {
  try {
    const saved = JSON.parse(localStorage.getItem("robloxAudioCreds") || "{}");
    if (saved.apiKey) els.apiKeyInput.value = saved.apiKey;
    if (saved.userId) els.userIdInput.value = saved.userId;
    if (saved.groupId) els.groupIdInput.value = saved.groupId;
  } catch {}
  refreshCreatorOptions();
}
els.saveCredsBtn.addEventListener("click", () => {
  const creds = { apiKey: els.apiKeyInput.value.trim(), userId: els.userIdInput.value.trim(), groupId: els.groupIdInput.value.trim() };
  localStorage.setItem("robloxAudioCreds", JSON.stringify(creds));
  refreshCreatorOptions();
  logLine("Kredensial disimpan di browser lokal kamu.", "ok");
});
function refreshCreatorOptions() {
  const userId = els.userIdInput.value.trim();
  const groupId = els.groupIdInput.value.trim();
  els.creatorSelect.innerHTML = "";
  if (userId) {
    const opt = document.createElement("option");
    opt.value = JSON.stringify({ userId });
    opt.textContent = `Akun Pribadi (User ${userId})`;
    els.creatorSelect.appendChild(opt);
  }
  if (groupId) {
    const opt = document.createElement("option");
    opt.value = JSON.stringify({ groupId });
    opt.textContent = `Group (${groupId})`;
    els.creatorSelect.appendChild(opt);
  }
  if (!userId && !groupId) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Isi User ID / Group ID di panel kanan dulu";
    els.creatorSelect.appendChild(opt);
  }
}
els.userIdInput.addEventListener("input", refreshCreatorOptions);
els.groupIdInput.addEventListener("input", refreshCreatorOptions);

// ---------- platform tabs ----------
els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    state.platform = tab.dataset.platform;
    resetTrack();

    if (state.platform === "upload") {
      els.linkInputRow.classList.add("hidden");
      els.fileInputRow.classList.remove("hidden");
    } else {
      els.linkInputRow.classList.remove("hidden");
      els.fileInputRow.classList.add("hidden");
      const meta = PLATFORM_META[state.platform];
      els.inputIcon.textContent = meta.icon;
      els.urlInput.placeholder = meta.placeholder;
    }
  });
});

els.fileInput.addEventListener("change", () => {
  const file = els.fileInput.files[0];
  if (!file) return;
  state.selectedFile = file;
  els.fileDropLabel.textContent = `✅ ${file.name}`;
  state.track = { title: file.name.replace(/\.[^.]+$/, ""), artist: "" };
  setStatus("File siap di-convert", "ok");
});

// ---------- resolve (search) for link-based platforms ----------
els.searchBtn.addEventListener("click", resolveTrack);
els.urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") resolveTrack(); });

async function resolveTrack() {
  const url = els.urlInput.value.trim();
  if (!url) return setStatus("Masukin link dulu", "err");
  setStatus("Mencari...", "loading");
  resetTrack(true);

  try {
    const res = await fetch("/api/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ url, platform: state.platform }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    state.track = data.track;
    els.trackThumb.src = data.track.thumbnail || "";
    els.trackTitle.textContent = data.track.title;
    els.trackArtist.textContent = data.track.artist || "";
    els.trackMeta.textContent = data.track.duration ? `${Math.floor(data.track.duration / 60)}:${String(data.track.duration % 60).padStart(2, "0")}` : "";
    els.trackCard.classList.remove("hidden");
    setStatus("Loaded", "ok");
  } catch (err) {
    setStatus(err.message || "Gagal ambil data", "err");
  }
}

function resetTrack(keepFile) {
  state.track = null;
  state.fileId = null;
  state.convertedMeta = null;
  if (!keepFile) state.selectedFile = null;
  els.trackCard.classList.add("hidden");
  els.convertResult.classList.add("hidden");
  setStatus("");
}
function setStatus(text, cls) { els.status.textContent = text; els.status.className = cls || ""; }

// ---------- advanced settings ----------
let advOpen = true;
els.advToggle.addEventListener("click", () => {
  advOpen = !advOpen;
  document.querySelector(".grid2").parentElement.querySelectorAll(".field-box, .convert-btn, .convert-result").forEach(() => {});
  const body = document.querySelectorAll(".grid2, .field-box.full, #convertBtn, #convertResult");
  body.forEach((el) => (el.style.display = advOpen ? "" : "none"));
  els.advArrow.textContent = advOpen ? "▲" : "▼";
});

els.speedSlider.addEventListener("input", () => {
  const speed = Number(els.speedSlider.value);
  els.speedVal.textContent = `${speed.toFixed(2)}x`;
  els.playbackNormalVal.textContent = (1 / speed).toFixed(2);
});
els.ampSlider.addEventListener("input", () => { els.ampVal.textContent = `${els.ampSlider.value}dB`; });

const FORMAT_DETAILS = { mp3: { label: "High quality audio", value: "192 kbps" }, ogg: { label: "Smaller file size", value: "~128 kbps (VBR)" } };
els.formatSelect.addEventListener("change", () => {
  const d = FORMAT_DETAILS[els.formatSelect.value] || FORMAT_DETAILS.mp3;
  els.formatDetailLabel.textContent = d.label;
  els.formatDetailValue.textContent = d.value;
});

els.resetDefaultBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  els.speedSlider.value = 2.3;
  els.ampSlider.value = -4;
  els.formatSelect.value = "mp3";
  els.speedSlider.dispatchEvent(new Event("input"));
  els.ampSlider.dispatchEvent(new Event("input"));
  els.formatSelect.dispatchEvent(new Event("change"));
  logLine("Advanced settings direset ke default.", "");
});

// ---------- convert ----------
els.convertBtn.addEventListener("click", async () => {
  if (!state.track) return logLine("Search / pilih file dulu sebelum convert.", "err");

  els.convertBtn.disabled = true;
  els.convertBtn.textContent = "⏳ Converting...";
  els.convertResult.classList.add("hidden");

  try {
    let convertData;
    if (state.platform === "upload" && state.selectedFile) {
      const form = new FormData();
      form.append("file", state.selectedFile);
      form.append("speed", els.speedSlider.value);
      form.append("amplifyDb", els.ampSlider.value);
      form.append("format", els.formatSelect.value);
      form.append("title", state.track.title);
      form.append("artist", state.track.artist || "");

      const res = await fetch("/api/convert/upload-file", { method: "POST", headers: authHeaders(), body: form });
      convertData = await res.json();
      if (res.status === 429) { logLine(convertData.error, "err"); els.upgradeBtn.click(); return; }
      if (!res.ok) throw new Error(convertData.error);
    } else {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          url: state.track.sourceUrl,
          speed: els.speedSlider.value,
          amplifyDb: els.ampSlider.value,
          format: els.formatSelect.value,
          title: state.track.title,
          artist: state.track.artist,
        }),
      });
      convertData = await res.json();
      if (res.status === 429) { logLine(convertData.error, "err"); els.upgradeBtn.click(); return; }
      if (!res.ok) throw new Error(convertData.error);
    }

    logLine(`Convert selesai: ${convertData.title} (${convertData.sizeMb} MB, ${convertData.format})`, "ok");
    state.fileId = convertData.fileId;
    state.convertedMeta = convertData;
    loadMe();

    els.resultTitle.textContent = convertData.title;
    els.resultMeta.textContent = `${convertData.artist} · ${convertData.sizeMb} MB · ${convertData.format}`;
    els.convertResult.classList.remove("hidden");
  } catch (err) {
    logLine(`Gagal: ${err.message}`, "err");
  } finally {
    els.convertBtn.disabled = false;
    els.convertBtn.textContent = "📄 Convert";
  }
});

// ---------- download ----------
els.downloadBtn.addEventListener("click", async () => {
  if (!state.fileId) return;
  els.downloadBtn.disabled = true;
  els.downloadBtn.textContent = "⏳ Menyiapkan...";
  try {
    const nameParam = encodeURIComponent(state.convertedMeta?.title || "audio");
    const res = await fetch(`/api/convert/file/${state.fileId}?name=${nameParam}`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Gagal download file");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.convertedMeta?.title || "audio"}.${state.convertedMeta?.format || "mp3"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    logLine("File berhasil di-download.", "ok");
  } catch (err) {
    logLine(`Gagal download: ${err.message}`, "err");
  } finally {
    els.downloadBtn.disabled = false;
    els.downloadBtn.textContent = "⬇ Download";
  }
});

// ---------- upload to Roblox ----------
els.uploadBtn.addEventListener("click", async () => {
  if (!state.fileId) return logLine("Convert dulu sebelum upload.", "err");
  const creatorRaw = els.creatorSelect.value;
  if (!creatorRaw) return logLine("Pilih Target Creator dulu.", "err");
  const apiKey = els.apiKeyInput.value.trim();
  if (!apiKey) return logLine("Isi Open Cloud API Key dulu.", "err");

  els.uploadBtn.disabled = true;
  els.uploadBtn.textContent = "⏳ Uploading...";
  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        fileId: state.fileId,
        displayName: state.convertedMeta.title,
        artist: state.convertedMeta.artist,
        description: `Uploaded via Audio Hub`,
        creator: JSON.parse(creatorRaw),
        apiKey,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.pending) logLine(`Upload terkirim, masih diproses Roblox (pending). Cek Audio History nanti.`, "ok");
    else logLine(`Upload berhasil! Asset ID: ${data.assetId}`, "ok");
  } catch (err) {
    logLine(`Gagal: ${err.message}`, "err");
  } finally {
    els.uploadBtn.disabled = false;
    els.uploadBtn.textContent = "☁ Upload ke Roblox";
  }
});

function logLine(text, cls) {
  const div = document.createElement("div");
  div.textContent = `> ${text}`;
  if (cls === "ok") div.className = "line-ok";
  if (cls === "err") div.className = "line-err";
  els.log.prepend(div);
}

// ---------- upgrade / payment ----------
let midtransConfigLoaded = false;
async function ensureMidtransScript() {
  if (midtransConfigLoaded) return;
  const res = await fetch("/api/payment/config");
  const cfg = await res.json();
  if (!cfg.clientKey) return;
  const script = document.createElement("script");
  script.src = cfg.isProduction ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";
  script.setAttribute("data-client-key", cfg.clientKey);
  document.head.appendChild(script);
  midtransConfigLoaded = true;
}
els.upgradeBtn.addEventListener("click", async () => {
  els.upgradeModal.classList.remove("hidden");
  await ensureMidtransScript();
  try {
    const res = await fetch("/api/payment/plans");
    const data = await res.json();
    els.planOptions.innerHTML = Object.entries(data.plans)
      .map(([key, plan]) => `<div class="plan-card" data-plan="${key}"><span>${plan.label}</span><span class="price">Rp ${plan.price.toLocaleString("id-ID")}</span></div>`)
      .join("");
    els.planOptions.querySelectorAll(".plan-card").forEach((card) => card.addEventListener("click", () => startCheckout(card.dataset.plan)));
  } catch {
    els.planOptions.innerHTML = `<div class="plan-card muted">Gagal load plan.</div>`;
  }
});
els.closeModalBtn.addEventListener("click", () => els.upgradeModal.classList.add("hidden"));

async function startCheckout(plan) {
  try {
    const res = await fetch("/api/payment/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    els.upgradeModal.classList.add("hidden");
    if (window.snap) {
      window.snap.pay(data.token, {
        onSuccess: () => { logLine("Pembayaran berhasil! Akun kamu jadi Premium.", "ok"); loadMe(); },
        onPending: () => logLine("Pembayaran pending.", ""),
        onError: () => logLine("Pembayaran gagal.", "err"),
        onClose: () => logLine("Kamu menutup jendela pembayaran.", ""),
      });
    } else if (data.redirectUrl) window.location.href = data.redirectUrl;
  } catch (err) {
    logLine(`Gagal mulai checkout: ${err.message}`, "err");
  }
}

// init
loadCreds();
loadMe();
