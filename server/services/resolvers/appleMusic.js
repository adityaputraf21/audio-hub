const fetch = require("node-fetch");
const ytdlp = require("../ytdlp");

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

// Apple Music's official metadata API (MusicKit) requires a paid Apple
// Developer Program membership + signed JWT — not practical to require here.
// We scrape the public track page's Open Graph tags instead, same approach
// used as Spotify's fallback.
async function scrapeAppleMusic(url) {
  const res = await fetch(url, { headers: { ...BROWSER_HEADERS, Accept: "text/html" }, timeout: 15000 });
  if (!res.ok) throw new Error(`Halaman Apple Music HTTP ${res.status}`);
  const html = await res.text();

  const titleMatch = html.match(/<meta property="og:title" content="([^"]*)"/);
  const imageMatch = html.match(/<meta property="og:image" content="([^"]*)"/);
  if (!titleMatch) throw new Error("Gak nemu judul lagu di halaman Apple Music (link salah atau bukan halaman track/song?)");

  const rawTitle = decodeHtmlEntities(titleMatch[1]);
  // Apple Music titles are usually "Song Name - Song by Artist Name" or similar
  const byMatch = rawTitle.match(/^(.*?)\s*(?:-\s*Song)?\s*by\s+(.*?)(?:\s+on Apple Music)?$/i);

  return {
    title: byMatch ? byMatch[1].trim() : rawTitle,
    artist: byMatch ? byMatch[2].trim() : null,
    thumbnail: imageMatch ? imageMatch[1] : "",
  };
}

function decodeHtmlEntities(str) {
  return str.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

async function resolve(url) {
  const meta = await scrapeAppleMusic(url);
  const query = `${meta.title}${meta.artist ? " " + meta.artist : ""} audio`;
  const match = await ytdlp.searchFirst(query);

  return {
    title: meta.title || match.title,
    artist: meta.artist || match.artist,
    thumbnail: meta.thumbnail || match.thumbnail,
    duration: match.duration,
    sourceUrl: match.sourceUrl,
    originUrl: url,
    provider: "applemusic",
  };
}

module.exports = { resolve };
