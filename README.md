# Social Share

Lists the videos on my YouTube channels and sends a selected video to TikTok and Instagram (Reels) with one click. Runs locally.

## Stack

Next.js + React + TypeScript, Node.js, SQLite, ffmpeg, yt-dlp. No separate backend, no Redis, no external queue.

## Requirements

- Node.js 22+
- ffmpeg and yt-dlp on `PATH` (macOS: `brew install yt-dlp ffmpeg`)

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

## TikTok setup

1. Sign in at [TikTok for Developers](https://developers.tiktok.com/) and create an app.
2. Platform: **Desktop** (only desktop apps may redirect to `localhost`; the app uses PKCE).
3. Add products **Login Kit** and **Content Posting API**; scopes `user.info.basic` and `video.upload`.
4. Redirect URI: `http://localhost:3000/api/auth/tiktok/callback`
5. Use **Sandbox** mode and add your TikTok accounts as target users (no app review needed).
6. Put the client key and secret into `.env`.

Videos go to the TikTok inbox as drafts. TikTok does not accept a caption for drafts, so copy it from the app and finish the post in TikTok. TikTok allows at most 5 pending drafts per 24 hours.

## How sending works

A background worker starts with the server (`src/instrumentation.ts`) and processes jobs one at a time from the `jobs` table: download with yt-dlp → upload → done. Failed attempts are retried up to 3 times; after that the job shows a manual retry button. Jobs interrupted by a shutdown resume on the next start. If yt-dlp can't download a video, the video page offers a file upload instead. The temp file is deleted once all jobs for the video are finished.
