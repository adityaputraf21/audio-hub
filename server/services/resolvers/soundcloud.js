const ytdlp = require("../ytdlp");

async function resolve(url) {
  const info = await ytdlp.getInfoGeneric(url);
  return { ...info, provider: "soundcloud" };
}

module.exports = { resolve };
