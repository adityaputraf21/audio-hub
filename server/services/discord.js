const fetch = require("node-fetch");

const DISCORD_API = "https://discord.com/api";

function getAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify email",
    state,
    prompt: "consent",
  });
  return `${DISCORD_API}/oauth2/authorize?${params.toString()}`;
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
  });
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "Gagal tukar kode Discord OAuth");
  return data.access_token;
}

async function fetchDiscordUser(accessToken) {
  const res = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error("Gagal ambil profil Discord");

  const avatarUrl = data.avatar
    ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${Number(data.discriminator || 0) % 5}.png`;

  return {
    discordId: data.id,
    username: data.global_name || data.username,
    handle: data.discriminator && data.discriminator !== "0" ? `${data.username}#${data.discriminator}` : `@${data.username}`,
    email: data.email || null,
    avatarUrl,
  };
}

module.exports = { getAuthorizeUrl, exchangeCode, fetchDiscordUser };
