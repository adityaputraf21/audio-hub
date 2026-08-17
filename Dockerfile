FROM node:20-bookworm-slim

# ffmpeg (audio processing, includes librubberband for quality time-stretch)
# + python3/pip (backup) + curl (healthcheck) + unzip (needed by Deno installer)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp as a standalone binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Deno — JS runtime yt-dlp needs to decode YouTube's signature obfuscation
RUN curl -fsSL https://deno.land/install.sh | sh -s -- -y \
    && ln -s /root/.deno/bin/deno /usr/local/bin/deno

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

# NOTE: no Docker `VOLUME` instruction here — Railway's builder rejects it.
# Persistent storage on Railway is configured via Railway Volumes in the
# dashboard (mount to these same paths) — see DEPLOY-RAILWAY.md.
RUN mkdir -p /app/data /app/tmp

ENV PORT=3000
ENV DATA_DIR=/app/data
ENV TMP_DIR=/app/tmp

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server/index.js"]
