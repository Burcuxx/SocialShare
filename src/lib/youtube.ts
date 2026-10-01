import fs from "node:fs/promises";
import { db, type Connection } from "./db";
import { mimeType } from "./files";

const API = "https://www.googleapis.com/youtube/v3";
// readonly: read the channel name on connect; upload: post videos.
const SCOPE = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
].join(" ");

function redirectUri() {
  return `${process.env.APP_URL}/api/auth/youtube/callback`;
}

export function authUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Google token error: ${await res.text()}`);
  return res.json();
}

function expiresAt(expiresIn: number) {
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

async function get<T>(path: string, token: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${API}/${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`YouTube API error (${path}): ${await res.text()}`);
  return res.json();
}

type ChannelList = {
  items?: {
    id: string;
    snippet: { title: string };
    contentDetails: { relatedPlaylists: { uploads: string } };
  }[];
};

/** Exchanges the OAuth code and saves the channel as a youtube connection of the account. */
export async function connect(accountId: number, code: string) {
  const token = await tokenRequest({
    code,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
  const channels = await get<ChannelList>("channels", token.access_token, {
    part: "snippet,contentDetails",
    mine: "true",
  });
  const channel = channels.items?.[0];
  if (!channel) throw new Error("No YouTube channel on this Google account");

  db.prepare(
    `INSERT INTO connections (account_id, platform, external_id, display_name, access_token, refresh_token, expires_at)
     VALUES (?, 'youtube', ?, ?, ?, ?, ?)
     ON CONFLICT (platform, external_id) DO UPDATE SET
       account_id = excluded.account_id,
       display_name = excluded.display_name,
       access_token = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, connections.refresh_token),
       expires_at = excluded.expires_at`,
  ).run(
    accountId,
    channel.id,
    channel.snippet.title,
    token.access_token,
    token.refresh_token ?? null,
    expiresAt(token.expires_in),
  );
}

async function accessToken(conn: Connection) {
  // Refresh a minute early to avoid using a token that expires mid-request.
  if (conn.expires_at && Date.parse(conn.expires_at) - 60_000 > Date.now()) {
    return conn.access_token;
  }
  if (!conn.refresh_token) throw new Error("YouTube token expired; reconnect the channel");
  const token = await tokenRequest({
    refresh_token: conn.refresh_token,
    grant_type: "refresh_token",
  });
  db.prepare("UPDATE connections SET access_token = ?, expires_at = ? WHERE id = ?").run(
    token.access_token,
    expiresAt(token.expires_in),
    conn.id,
  );
  return token.access_token;
}

/**
 * Uploads the video (resumable upload, single request) and returns the YouTube video id.
 * Until the Google project passes the YouTube API audit, YouTube forces these to private.
 */
export async function uploadVideo(
  conn: Connection,
  filePath: string,
  title: string,
  description: string,
) {
  const token = await accessToken(conn);
  const file = await fs.readFile(filePath);
  const type = mimeType(filePath);

  const init = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(file.length),
        "X-Upload-Content-Type": type,
      },
      body: JSON.stringify({
        snippet: {
          // YouTube: title max 100 chars, no angle brackets; description max 5000.
          title: title.replace(/[<>]/g, "").slice(0, 100) || "Video",
          description: description.replace(/[<>]/g, "").slice(0, 5000),
        },
        status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
      }),
    },
  );
  const location = init.headers.get("location");
  if (!init.ok || !location) throw new Error(`YouTube upload init error: ${await init.text()}`);

  const res = await fetch(location, {
    method: "PUT",
    headers: { "Content-Type": type },
    body: file,
  });
  if (!res.ok) throw new Error(`YouTube upload error: ${await res.text()}`);
  const video = (await res.json()) as { id: string };
  return video.id;
}
