const fetch = require("node-fetch");
const ytdlp = require("../ytdlp");

const RETRYABLE_STATUSES = new Set([502, 503, 504]);
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

async function fetchWithRetry(url, headers, attempt = 1, maxAttempts = 3) {
  let res;
  try {
    res = await fetch(url, { headers, timeout: 15000 });
  } catch (networkErr) {
    throw new Error(`Gak bisa konek ke Spotify: ${networkErr.message}. Cek koneksi internet / firewall / antivirus.`);
  }
  if (RETRYABLE_STATUSES.has(res.status) && attempt < maxAttempts) {
    await new Promise((r) => setTimeout(r, attempt * 800));
    return fetchWithRetry(url, headers, attempt + 1, maxAttempts);
  }
  return res;
}

function extractTrackId(url) {
  // handles both URL format (open.spotify.com/track/ID, incl. locale-prefixed
  // /intl-id/track/ID) and URI format (spotify:track:ID)
  const match = url.match(/track[/:]([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

// ---------- Method 1 (preferred when configured): official Spotify Web API ----------
let cachedToken = null;
let cachedTokenExpiry = 0;

async function getSpotifyApiToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken;
  const basicAuth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basicAuth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    timeout: 15000,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gagal auth ke Spotify API (HTTP ${res.status}): ${body.slice(0, 150)}`);
  }
  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function tryOfficialApi(url) {
  const trackId = extractTrackId(url);
  if (!trackId) throw new Error("URL bukan link track Spotify yang valid");
  const token = await getSpotifyApiToken();
  const res = await fetchWithRetry(`https://api.spotify.com/v1/tracks/${trackId}`, { Authorization: `Bearer ${token}` });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify API HTTP ${res.status}: ${body.slice(0, 150)}`);
  }
  const data = await res.json();
  return {
    title: data.name || "",
    thumbnail: data.album?.images?.[0]?.url || "",
    apiArtist: (data.artists || []).map((a) => a.name).join(", "),
    duration: data.duration_ms ? Math.round(data.duration_ms / 1000) : undefined,
  };
}

// ---------- Fallback 1: public oEmbed endpoint ----------
async function tryOembed(url) {
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
  const res = await fetchWithRetry(oembedUrl, { ...BROWSER_HEADERS, Accept: "application/json" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`oEmbed HTTP ${res.status}: ${body.slice(0, 150)}`);
  }
  const data = await res.json();
  return { title: data.title || "", thumbnail: data.thumbnail_url || "" };
}

// ---------- Fallback 2: scrape track page Open Graph tags ----------
async function tryPageScrape(url) {
  const res = await fetchWithRetry(url, { ...BROWSER_HEADERS, Accept: "text/html" });
  if (!res.ok) throw new Error(`Halaman track HTTP ${res.status}`);
  const html = await res.text();
  const titleMatch = html.match(/<meta property="og:title" content="([^"]*)"/);
  const imageMatch = html.match(/<meta property="og:image" content="([^"]*)"/);
  if (!titleMatch) throw new Error("Gak nemu judul lagu di halaman track");
  return { title: decodeHtmlEntities(titleMatch[1]), thumbnail: imageMatch ? imageMatch[1] : "" };
}

function decodeHtmlEntities(str) {
  return str.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

// Spotify streams are DRM'd — we only ever get metadata here, then pull the
// actual audio from a matching YouTube result.
async function resolve(url) {
  let meta;
  const errors = [];

  if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    try {
      meta = await tryOfficialApi(url);
    } catch (e) {
      errors.push(`API resmi: ${e.message}`);
    }
  }
  if (!meta) {
    try {
      meta = await tryOembed(url);
    } catch (e) {
      errors.push(`oEmbed: ${e.message}`);
      try {
        meta = await tryPageScrape(url);
      } catch (e2) {
        errors.push(`Scrape halaman: ${e2.message}`);
      }
    }
  }
  if (!meta) throw new Error(`Gagal ambil metadata dari Spotify. ${errors.join(" | ")}`);

  const rawTitle = meta.title || "";
  const match = await ytdlp.searchFirst(`${rawTitle} audio`);

  return {
    title: rawTitle || match.title,
    artist: meta.apiArtist || match.artist,
    thumbnail: meta.thumbnail || match.thumbnail,
    duration: meta.duration || match.duration,
    sourceUrl: match.sourceUrl,
    originUrl: url,
    provider: "spotify",
  };
}

module.exports = { resolve };
