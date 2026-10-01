# Social Share

Lists the videos on my YouTube channels and sends a selected video to TikTok and Instagram (Reels) with one click. Runs locally.

## Stack

Next.js + React + TypeScript, Node.js, SQLite, ffmpeg, yt-dlp. No separate backend, no Redis, no external queue.

## Requirements

- Node.js 22+
- ffmpeg and yt-dlp on `PATH`

## Setup

```bash
cp .env.example .env   # fill in the API credentials
npm install
npm run dev -- -H 0.0.0.0   # reachable from your phone on the same Wi-Fi
```

Tokens and API keys live only in `.env` (gitignored). The SQLite database (`data/`) and temporary video files (`tmp/`) are not committed.

## YouTube setup

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable **YouTube Data API v3**.
2. Configure the OAuth consent screen (External, add yourself as a test user).
3. Create an **OAuth client ID** (Web application) with redirect URI
   `http://localhost:3000/api/auth/youtube/callback`.
4. Put the client ID and secret into `.env`.

Google only accepts `localhost` (or a public domain) as a redirect, so connect accounts from the computer at `http://localhost:3000`. After that the app works from your phone too.

Video lists are cached in SQLite and only re-fetched when you press **Yenile** (about 2 quota units per 50 videos).
