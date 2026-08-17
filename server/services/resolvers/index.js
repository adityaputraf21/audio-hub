const youtube = require("./youtube");
const spotify = require("./spotify");
const soundcloud = require("./soundcloud");
const tiktok = require("./tiktok");
const appleMusic = require("./appleMusic");

const RESOLVERS = {
  youtube,
  spotify,
  soundcloud,
  tiktok,
  applemusic: appleMusic,
};

async function resolve(platform, url) {
  const resolver = RESOLVERS[platform];
  if (!resolver) throw new Error(`Platform "${platform}" belum didukung`);
  return resolver.resolve(url);
}

module.exports = { resolve, RESOLVERS };
