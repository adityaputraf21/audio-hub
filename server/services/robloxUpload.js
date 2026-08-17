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
      if (body.error) throw new Error(`Roblox menolak asset: ${JSON.stringify(body.error)}`);
      return { assetId: body.response?.assetId, pending: false, raw: body };
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return { assetId: null, pending: true, raw: null };
}

async function checkOperation(operationId, apiKey) {
  const url = `https://apis.roblox.com/assets/v1/operations/${operationId}`;
  const res = await fetch(url, { headers: { "x-api-key": apiKey } });
  const body = await res.json().catch(() => ({}));
  if (!body.done) return { assetId: null, pending: true, raw: body };
  if (body.error) throw new Error(`Roblox menolak asset: ${JSON.stringify(body.error)}`);
  return { assetId: body.response?.assetId, pending: false, raw: body };
}

module.exports = { uploadAudio, checkOperation };
