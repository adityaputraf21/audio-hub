# Audio Hub

Convert audio dari YouTube, Spotify, SoundCloud, TikTok, Apple Music, atau upload MP3 sendiri — lalu upload langsung ke Roblox sebagai Audio asset lewat Open Cloud API.

## Fitur

- 🎵 **5 platform + upload manual**: YouTube, Spotify, SoundCloud, TikTok, Apple Music, atau upload file MP3/WAV kamu sendiri
- 🎚️ Atur speed (0.5x–3x, pakai rubberband buat kualitas time-stretch yang bersih) & amplify volume sebelum convert
- ☁️ Auto-upload ke Roblox via Open Cloud Assets API
- 🔐 Login Discord OAuth — gak ada password, user pertama login otomatis jadi admin
- 🆓 Free tier: 2x convert/hari (berlaku sama buat link maupun upload manual)
- 💎 Premium: unlimited convert, bayar via Midtrans
- 🛠️ Admin panel: kelola user, upgrade/downgrade manual, ban, statistik
- 📋 Audio History: filter status (Active/Pending/Removed), search, export CSV
- 🐳 Siap deploy 24/7 ke Railway (lihat `DEPLOY-RAILWAY.md`)

## Cara kerja per platform

| Platform | Metode |
|---|---|
| YouTube | Download langsung via yt-dlp |
| SoundCloud | Download langsung via yt-dlp (native support) |
| TikTok | Download langsung via yt-dlp (ekstrak audio dari video) |
| Spotify | DRM-protected — ambil metadata via API resmi Spotify (atau fallback oEmbed/scrape), lalu cari & download dari YouTube |
| Apple Music | DRM-protected — scrape metadata dari halaman track, lalu cari & download dari YouTube |
| Upload MP3 | Convert file yang diupload langsung, skip semua langkah di atas |

## Yang perlu diinstall (buat run lokal)

1. **Node.js** 18+
2. **yt-dlp** — `pip install -U yt-dlp`
3. **ffmpeg** — pastikan versi **full build** (bukan essentials) biar dapet filter `rubberband` (kualitas audio lebih baik). Windows: https://www.gyan.dev/ffmpeg/builds/ (`ffmpeg-release-full`)
4. **Deno** — `irm https://deno.land/install.ps1 | iex` (PowerShell) — dibutuhkan yt-dlp buat decode proteksi anti-bot YouTube

> Kalau mau langsung jalan di server tanpa install manual, pakai Docker — semua dependency di atas udah di-bundle di `Dockerfile`.

## Setup lokal

```bash
npm install
cp .env.example .env
```

Isi `.env` minimal:
```
JWT_SECRET=ganti-dengan-string-acak-panjang
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
ROBLOX_API_KEY=
SPOTIFY_CLIENT_ID=          # opsional tapi disarankan, biar Spotify lebih reliable
SPOTIFY_CLIENT_SECRET=
```

Jalankan:
```bash
npm start
```

Buka `http://localhost:3000`.

## Setup Discord OAuth

1. https://discord.com/developers/applications → **New Application**
2. **OAuth2** → catat Client ID, generate Client Secret
3. **Redirects** → Add: `http://localhost:3000/api/auth/discord/callback`
4. Isi ke `.env`

## Setup Spotify Web API (opsional, disarankan)

1. https://developer.spotify.com/dashboard → **Create app**
2. Redirect URI: isi apa aja (misal `https://localhost:3000`, wajib `https://`)
3. Centang **Web API**
4. Settings → copy **Client ID** dan **Client Secret**
5. Isi ke `.env` sebagai `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`

Tanpa ini, Spotify tetap jalan pakai fallback (oEmbed/scrape), tapi kurang reliable terutama kalau di-deploy ke server.

## Cara dapat Roblox Open Cloud API Key

1. https://create.roblox.com/dashboard/credentials → **Create API Key**
2. Permission **Assets API** → `asset:write` + `asset:read`
3. Copy key-nya

## Struktur folder

```
server/
  index.js
  routes/           auth, resolve, convert, upload, history, payment, admin
  services/
    db.js            JSON-file database
    auth.js            JWT
    discord.js           Discord OAuth2
    payment.js             Midtrans
    ffmpeg.js                rubberband-aware audio processing
    ytdlp.js                   yt-dlp wrapper + auto client-fallback
    robloxUpload.js              Roblox Open Cloud uploader
    resolvers/
      index.js                    dispatcher
      youtube.js, soundcloud.js, tiktok.js    direct via yt-dlp
      spotify.js                                official API + fallback
      appleMusic.js                              page-scrape + YouTube search
  middleware/       auth, usage limit
public/
  index.html, app.js, style.css, converter.css     halaman converter (sidebar layout)
  history.html, history.js, history.css              Audio History
  admin.html, admin.js, admin.css                       Admin Panel
  login.html, auth-callback.html, auth-common.js          Discord login
Dockerfile, railway.json                                    deploy config
```

## Deploy 24/7

Lihat **`DEPLOY-RAILWAY.md`** — panduan lengkap deploy ke Railway (connect GitHub, auto-detect Dockerfile, semua fix yang udah teruji: Deno, unzip, tanpa Docker VOLUME, cookies base64 buat YouTube di server).

## Catatan penting

- **Hak cipta**: tool ini buat konten yang kamu punya hak pakai / lisensi jelas, atau testing pribadi.
- **Cookies YouTube** di server (headless, gak ada browser) butuh setup manual — lihat `DEPLOY-RAILWAY.md` bagian `YTDLP_COOKIES_B64`. Cookies ini akan expired dari waktu ke waktu dan perlu di-refresh.
- Ganti `JWT_SECRET` sebelum deploy ke publik.
- Database pakai file JSON sederhana (`data/*.json`) — cukup buat skala hobby/kecil.
