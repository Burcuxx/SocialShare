# Social Share

Lists the videos on my YouTube channels and sends a selected video to TikTok and Instagram (Reels) with one click. Runs locally.

## Stack

Next.js + React + TypeScript, Node.js, SQLite, ffmpeg, yt-dlp. No separate backend, no Redis, no external queue.

## Requirements

- Node.js 20+
- ffmpeg and yt-dlp on `PATH`

## Setup

```bash
cp .env.example .env   # fill in the API credentials
npm install
npm run dev -- -H 0.0.0.0   # reachable from your phone on the same Wi-Fi
```

Tokens and API keys live only in `.env` (gitignored). The SQLite database (`data/`) and temporary video files (`tmp/`) are not committed.
