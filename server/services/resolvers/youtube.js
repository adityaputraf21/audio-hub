const ytdlp = require("../ytdlp");

async function resolve(url) {
  const info = await ytdlp.getInfo(url);
  return { ...info, provider: "youtube" };
}

module.exports = { resolve };
