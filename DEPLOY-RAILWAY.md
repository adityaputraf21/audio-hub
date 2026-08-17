# Deploy ke Railway

## Soal biaya

Trial $5 kredit gratis (~30 hari, gak perlu kartu). Setelahnya $5/bulan (Hobby plan) buat pemakaian rutin. App Node.js ringan kayak ini biasanya cuma habis $0.30–0.50/bulan.

## 1. Push ke GitHub

```bash
git init
git add .
git commit -m "Initial commit"
```
Bikin repo baru di https://github.com/new (Private disarankan), lalu:
```bash
git remote add origin https://github.com/username-kamu/nama-repo.git
git branch -M main
git push -u origin main
```

**Kalau upload lewat browser** (drag & drop): pastikan yang di-drag itu **isi dalam folder project** (package.json, Dockerfile, server/, public/ langsung sejajar), bukan foldernya sendiri yang membungkus semua itu.

## 2. Deploy dari GitHub repo

1. https://railway.app → Login with GitHub
2. **New Project** → **Deploy from GitHub repo** → pilih repo kamu
3. Railway otomatis detect `Dockerfile` dan `railway.json`, mulai build (3-10 menit di percobaan pertama)

## 3. Generate domain

Service kamu → **Settings** → **Networking** → **Generate Domain**. Copy URL-nya.

## 4. Isi Environment Variables

Service → tab **Variables** → **Raw Editor** (paling gampang buat paste banyak sekaligus):

```
JWT_SECRET=ganti-dengan-string-acak-panjang
APP_URL=https://url-domain-kamu.up.railway.app
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=https://url-domain-kamu.up.railway.app/api/auth/discord/callback
ROBLOX_API_KEY=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

(Railway otomatis kasih `PORT`, gak perlu diisi manual — app kita udah baca `process.env.PORT`)

## 5. Update Discord Developer Portal

**OAuth2** → **Add Redirect** → `https://url-domain-kamu.up.railway.app/api/auth/discord/callback` → Save

## 6. Tambahin persistent storage

Railway cuma izinin **1 volume per service**. Klik kanan di canvas project (bukan di atas kotak service) → **Volume** → pilih service kamu → mount path:
```
/app/data
```

(Folder `/app/tmp` gak perlu di-persist, itu cuma file sementara pas proses convert)

## 7. Setup cookies YouTube buat server (headless)

Server gak punya browser beneran, jadi `YTDLP_COOKIES_FROM_BROWSER` gak bisa dipakai. Caranya:

1. Di **komputer kamu**, export cookies YouTube (ekstensi "Get cookies.txt LOCALLY", pastiin login dulu)
2. Convert ke base64:
   ```
   certutil -encode cookies.txt cookies_b64.txt
   ```
3. Buka hasilnya di Notepad, hapus baris `-----BEGIN CERTIFICATE-----` dan `-----END CERTIFICATE-----`, gabung sisanya jadi 1 baris
4. Tambahin variable di Railway:
   ```
   YTDLP_COOKIES_B64=<paste hasil base64>
   ```

Cookies ini bisa expired dari waktu ke waktu — kalau YouTube mulai nolak lagi dengan pesan soal cookies/bot, ulangi langkah ini dengan cookies yang fresh.

## 8. (Opsional) Setup webhook Midtrans

```
https://url-domain-kamu.up.railway.app/api/payment/webhook
```
Isi di dashboard Midtrans → Settings → Configuration.

## 9. Test

Buka domain kamu → **Login with Discord** → coba convert dari salah satu platform.

## Troubleshooting umum

| Masalah | Solusi |
|---|---|
| Build gagal: `docker VOLUME is not supported` | Pastikan `Dockerfile` gak ada baris `VOLUME [...]` — udah dihapus di project ini, cek gak sengaja ke-tambah lagi |
| Build gagal: `unzip or 7z is required` | Pastikan `Dockerfile` install `unzip` via apt sebelum install Deno |
| "Application failed to respond" | Cek Settings → Networking, port yang di-mapping harus sesuai `PORT` yang dipakai app (cek Deploy Logs, biasanya Railway auto-assign, jangan di-override manual ke 3000 kalau lognya nunjukkin port lain) |
| YouTube: "No supported JavaScript runtime" | Deno belum ke-install di image — cek `Dockerfile` ada step install Deno |
| YouTube: "Sign in to confirm you're not a bot" | Perlu `YTDLP_COOKIES_B64` (lihat step 7) |
| Spotify gagal terus | Isi `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` (step 4) — jauh lebih reliable dibanding fallback scraping |
| Variable ke-gabung jadi satu di Railway UI | Selalu pakai **Raw Editor** buat paste banyak variable sekaligus, jangan paste multi-baris di kotak New Variable biasa |

## Update kode

```bash
git add .
git commit -m "update"
git push
```
Railway otomatis redeploy.
