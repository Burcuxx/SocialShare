# Social Share

Upload a video once, write the title and description, and send it to YouTube, TikTok and Instagram (Reels) at the same time. Runs locally.

## Stack

Next.js + React + TypeScript, Node.js, SQLite. No separate backend, no Redis, no external queue.

## Requirements

- Node.js 22+

## Setup

```bash
cp .env.example .env   # fill in the API credentials
npm install
npm run dev -- -H 0.0.0.0   # reachable from your phone on the same Wi-Fi
```

Tokens and API keys live only in `.env` (gitignored). The SQLite database (`data/`) and temporary video files (`tmp/`) are not committed.

## Sign in

Open the app and register with an email and password; every page needs a signed-in user and each user only sees their own accounts. Accounts that existed before sign-in was added belong to the first user who registers. Passwords are hashed with scrypt; sessions last 30 days (only a hash of the session token is stored).

## YouTube setup

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable **YouTube Data API v3**.
2. Configure the OAuth consent screen (External, add yourself as a test user).
3. Create an **OAuth client ID** (Web application) with redirect URI
   `http://localhost:3000/api/auth/youtube/callback`.
4. Put the client ID and secret into `.env`.

Google only accepts `localhost` (or a public domain) as a redirect, so connect accounts from the computer at `http://localhost:3000`. After that the app works from your phone too.

Uploads use the `youtube.upload` scope. Until the Google project passes the YouTube API audit, YouTube forces API uploads to private; switch them to public in YouTube Studio. Quota: 100 uploads per day.

## TikTok setup

1. Sign in at [TikTok for Developers](https://developers.tiktok.com/) and create an app.
2. Platform: **Desktop** (only desktop apps may redirect to `localhost`; the app uses PKCE).
3. Add products **Login Kit** and **Content Posting API** (turn on **Direct Post**); scopes `user.info.basic` and `video.publish`.
4. Redirect URI: `http://localhost:3000/api/auth/tiktok/callback`
5. Use **Sandbox** mode and add your TikTok accounts as target users (no app review needed).
6. Put the client key and secret into `.env`.

Videos are posted directly with their caption (Direct Post). Until TikTok audits the app, Direct Post only works for private accounts (as "only me"); for public accounts the app falls back to sending a draft to the TikTok inbox and offers a "copy caption" button. Scopes: `user.info.basic`, `video.publish`, `video.upload`. Once the app is audited, posts go out public automatically.

## Instagram setup

Instagram only accepts a file upload from your computer through **Facebook Login for Business**, so:

1. Your Instagram account must be **Professional** (Business or Creator) and **linked to a Facebook Page**.
2. At [Meta for Developers](https://developers.facebook.com/apps/) create an app (type **Business**) and add **Facebook Login for Business** and **Instagram** (Instagram API with Facebook Login).
3. Keep the app in **Development** mode: you (as the app admin) can use every permission without App Review, and `http://localhost` redirects are allowed. Redirect URI: `http://localhost:3000/api/auth/instagram/callback`
4. Put the app ID and secret into `.env` (`META_APP_ID`, `META_APP_SECRET`).

Permissions: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`. Videos are posted as Reels (also shown on the profile grid); limit 100 posts per 24 hours. Tokens last about 60 days and are renewed automatically in the last week; after that the app asks you to reconnect.

## Scheduling

A video can be sent right away or scheduled for a date and time. The app sends it itself, so the computer and the app must be running then; if they aren't, it's sent as soon as they are.

## How sending works

A background worker starts with the server (`src/instrumentation.ts`) and processes jobs one at a time from the `jobs` table. You upload a video once (title + description) and pick the platforms; each platform gets its own job. Failed attempts are retried up to 3 times; after that the job shows a manual retry button. Jobs interrupted by a shutdown resume on the next start. The uploaded file stays in `tmp/` until every job for it is done.
