const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const FormData = require("form-data");

const ASSETS_URL = "https://apis.roblox.com/assets/v1/assets";
const mimeFor = (filePath) => (filePath.endsWith(".ogg") ? "audio/ogg" : "audio/mpeg");

async function uploadAudio({ filePath, displayName, description = "", apiKey, creator }) {
  if (!apiKey) throw new Error("ROBLOX_API_KEY belum diset (butuh Open Cloud API key).");
  if (!creator || (!creator.userId && !creator.groupId)) throw new Error("Creator belum dipilih (butuh userId atau groupId).");

  const requestJson = {
    assetType: "Audio",
    displayName: displayName.slice(0, 50),
    description: description.slice(0, 1000),
    creationContext: {
      creator: creator.groupId ? { groupId: String(creator.groupId) } : { userId: String(creator.userId) },
    },
  };

  const form = new FormData();
  form.append("request", JSON.stringify(requestJson));
  form.append("fileContent", fs.createReadStream(filePath), { filename: path.basename(filePath), contentType: mimeFor(filePath) });

  const createRes = await fetch(ASSETS_URL, { method: "POST", headers: { "x-api-key": apiKey, ...form.getHeaders() }, body: form });
  const createBody = await createRes.json().catch(() => ({}));
  if (!createRes.ok) throw new Error(`Upload ditolak Roblox (${createRes.status}): ${createBody.message || JSON.stringify(createBody)}`);

  const operationId = createBody.path?.split("/").pop();
  if (!operationId) throw new Error(`Roblox gak balikin operation ID yang valid. Respons mentah: ${JSON.stringify(createBody)}`);

  const asset = await pollOperation(operationId, apiKey);
  return { ...asset, operationId };
}

async function pollOperation(operationId, apiKey, { attempts = 15, delayMs = 2000 } = {}) {
  const url = `https://apis.roblox.com/assets/v1/operations/${operationId}`;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { headers: { "x-api-key": apiKey } });
    const body = await res.json().catch(() => ({}));
    if (body.done) {
      // Operation finished — either the asset was created (assetId present)
      // or Roblox rejected it outright (body.error present). Neither case
      // throws: both are legitimate outcomes we want to record in history,
      // not treat as our own request failing.
      if (body.error) return { assetId: null, pending: false, rejected: true, rejectReason: JSON.stringify(body.error), raw: body };
      return { assetId: body.response?.assetId, pending: false, rejected: false, raw: body };
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  // Still moderating after ~30s — not a failure, just needs more time.
  return { assetId: null, pending: true, rejected: false, raw: null };
}

// Re-check a pending operation later (called from the history recheck route)
async function checkOperation(operationId, apiKey) {
  const url = `https://apis.roblox.com/assets/v1/operations/${operationId}`;
  const res = await fetch(url, { headers: { "x-api-key": apiKey } });
  const body = await res.json().catch(() => ({}));
  if (!body.done) return { assetId: null, pending: true, rejected: false, raw: body };
  if (body.error) return { assetId: null, pending: false, rejected: true, rejectReason: JSON.stringify(body.error), raw: body };
  return { assetId: body.response?.assetId, pending: false, rejected: false, raw: body };
}

// Checks the CURRENT moderation state of an already-created asset — this is
// the closest thing Roblox's Open Cloud API offers to a "was this taken
// down" check. IMPORTANT LIMITATION: as of writing, Roblox has no fully
// reliable public API for detecting post-hoc moderation actions (e.g. an
// asset removed days later after a user report) — this reflects the
// asset's moderation state at the time of the call, which is usually
// accurate shortly after upload but isn't guaranteed to update in real time
// for actions taken much later. See:
// https://devforum.roblox.com/t/api-to-get-moderation-status-of-an-item/4251659
async function getAssetModerationState(assetId, apiKey) {
  const url = `https://apis.roblox.com/assets/v1/assets/${assetId}?readMask=moderationResult`;
  const res = await fetch(url, { headers: { "x-api-key": apiKey } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gagal cek status asset (HTTP ${res.status}): ${body.message || JSON.stringify(body)}`);

  const state = body.moderationResult?.moderationState || null;
  // Observed/likely values: "Reviewing", "Approved", "Rejected" — treat
  // anything unrecognized as "active" rather than incorrectly flag it removed.
  if (state === "Rejected") return { status: "removed", raw: body };
  if (state === "Reviewing") return { status: "pending", raw: body };
  return { status: "active", raw: body };
}

module.exports = { uploadAudio, checkOperation, getAssetModerationState };
