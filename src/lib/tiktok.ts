import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import { db, type Connection } from "./db";
import { mimeType } from "./files";

const API = "https://open.tiktokapis.com/v2";
// video.publish: Direct Post with caption. video.upload: inbox draft fallback (see publishVideo).
const SCOPE = "user.info.basic,video.publish,video.upload";
const MB = 1024 * 1024;

function redirectUri() {
  return `${process.env.APP_URL}/api/auth/tiktok/callback`;
}

/**
 * TikTok only allows localhost redirects for "Desktop" apps, and those require PKCE.
 * Note: TikTok wants the challenge hex-encoded, not base64url.
 */
export function createPkce() {
  const verifier = randomBytes(32).toString("hex");
  const challenge = createHash("sha256").update(verifier).digest("hex");
  return { verifier, challenge };
}

export function authUrl(state: string, codeChallenge: string) {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    response_type: "code",
    scope: SCOPE,
    redirect_uri: redirectUri(),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
}

type TokenResponse = {
  open_id: string;
  access_token: string;
  expires_in: number;
  refresh_token: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    // TikTok rejects the ";charset=UTF-8" that fetch adds for URLSearchParams bodies,
    // so send a string with an explicit content type.
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      ...body,
    }).toString(),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error) {
    throw new Error(`TikTok token error: ${json.error_description ?? json.error ?? res.status}`);
  }
  return json;
}

function expiresAt(expiresIn: number) {
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

/** TikTok wraps every response in { data, error: { code: "ok" | ..., message } }. */
async function call<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
  const json = (await res.json()) as { data: T; error: { code: string; message: string } };
  if (json.error?.code !== "ok") {
    throw new Error(`TikTok API error (${path}): ${json.error?.code} ${json.error?.message}`);
  }
  return json.data;
}

export async function connect(accountId: number, code: string, codeVerifier: string) {
  const token = await tokenRequest({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
    code_verifier: codeVerifier,
  });
  const { user } = await call<{ user: { open_id: string; display_name: string } }>(
    "/user/info/?fields=open_id,display_name",
    token.access_token,
  );

  db.prepare(
    `INSERT INTO connections (account_id, platform, external_id, display_name, access_token, refresh_token, expires_at)
     VALUES (?, 'tiktok', ?, ?, ?, ?, ?)
     ON CONFLICT (platform, external_id) DO UPDATE SET
       account_id = excluded.account_id,
       display_name = excluded.display_name,
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       expires_at = excluded.expires_at`,
  ).run(
    accountId,
    token.open_id,
    user.display_name,
    token.access_token,
    token.refresh_token,
    expiresAt(token.expires_in),
  );
}

async function accessToken(conn: Connection) {
  if (conn.expires_at && Date.parse(conn.expires_at) - 60_000 > Date.now()) {
    return conn.access_token;
  }
  if (!conn.refresh_token) throw new Error("TikTok token expired; reconnect the account");
  const token = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: conn.refresh_token,
  });
  db.prepare(
    "UPDATE connections SET access_token = ?, refresh_token = ?, expires_at = ? WHERE id = ?",
  ).run(token.access_token, token.refresh_token, expiresAt(token.expires_in), conn.id);
  return token.access_token;
}

/** Chunks must be 5–64 MB; the last one absorbs the remainder. Under 5 MB: one chunk. */
function chunking(size: number) {
  const chunkSize = size < 5 * MB ? size : 10 * MB;
  return { chunkSize, count: Math.max(1, Math.floor(size / chunkSize)) };
}

type CreatorInfo = { privacy_level_options: string[]; max_video_post_duration_sec: number };

/** Marks a job's remote_id when the video went to the inbox as a draft instead of being posted. */
export const DRAFT_PREFIX = "draft:";

/**
 * Posts the video directly with its caption (Direct Post).
 * Unaudited apps may only Direct Post SELF_ONLY, and only to private accounts.
 * If TikTok refuses that, the video goes to the creator's inbox as a draft
 * (no caption possible there); the returned id then starts with DRAFT_PREFIX.
 * After the audit, posts go out public automatically.
 */
export async function publishVideo(
  conn: Connection,
  filePath: string,
  title: string,
  durationSec: number | null,
) {
  const token = await accessToken(conn);
  const creator = await call<CreatorInfo>("/post/publish/creator_info/query/", token, {
    method: "POST",
  });
  if (durationSec && durationSec > creator.max_video_post_duration_sec) {
    throw new Error(
      `Video TikTok için çok uzun (${durationSec} sn, en fazla ${creator.max_video_post_duration_sec} sn)`,
    );
  }

  const size = (await fs.stat(filePath)).size;
  const { chunkSize, count } = chunking(size);
  const sourceInfo = {
    source: "FILE_UPLOAD",
    video_size: size,
    chunk_size: chunkSize,
    total_chunk_count: count,
  };
  type Init = { publish_id: string; upload_url: string };
  const direct = (privacy: string) =>
    call<Init>("/post/publish/video/init/", token, {
      method: "POST",
      body: JSON.stringify({
        post_info: { title: title.slice(0, 2200), privacy_level: privacy },
        source_info: sourceInfo,
      }),
    });
  const inbox = () =>
    call<Init>("/post/publish/inbox/video/init/", token, {
      method: "POST",
      body: JSON.stringify({ source_info: sourceInfo }),
    });
  const unaudited = (e: unknown) => (e as Error).message.includes("unaudited_client");

  const attempts = creator.privacy_level_options.includes("PUBLIC_TO_EVERYONE")
    ? [() => direct("PUBLIC_TO_EVERYONE"), () => direct("SELF_ONLY")]
    : [() => direct("SELF_ONLY")];
  for (const attempt of attempts) {
    try {
      const post = await attempt();
      return uploadAndWait(token, post, filePath, size, chunkSize, count);
    } catch (e) {
      if (!unaudited(e)) throw e;
    }
  }
  const draft = await inbox();
  return DRAFT_PREFIX + (await uploadAndWait(token, draft, filePath, size, chunkSize, count));
}

async function uploadAndWait(
  token: string,
  init: { publish_id: string; upload_url: string },
  filePath: string,
  size: number,
  chunkSize: number,
  count: number,
) {
  const file = await fs.open(filePath, "r");
  try {
    for (let i = 0; i < count; i++) {
      const start = i * chunkSize;
      const end = i === count - 1 ? size - 1 : start + chunkSize - 1;
      const chunk = Buffer.alloc(end - start + 1);
      await file.read(chunk, 0, chunk.length, start);
      const res = await fetch(init.upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": mimeType(filePath),
          "Content-Range": `bytes ${start}-${end}/${size}`,
        },
        body: chunk,
      });
      if (res.status !== 201 && res.status !== 206) {
        throw new Error(`TikTok upload failed (chunk ${i + 1}/${count}): ${res.status} ${await res.text()}`);
      }
    }
  } finally {
    await file.close();
  }

  // Wait until TikTok has published the post / delivered the draft (or failed).
  for (let i = 0; i < 60; i++) {
    const status = await call<{ status: string; fail_reason?: string }>(
      "/post/publish/status/fetch/",
      token,
      { method: "POST", body: JSON.stringify({ publish_id: init.publish_id }) },
    );
    if (status.status === "PUBLISH_COMPLETE" || status.status === "SEND_TO_USER_INBOX") {
      return init.publish_id;
    }
    if (status.status === "FAILED") throw new Error(`TikTok rejected the video: ${status.fail_reason}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  // The bytes are uploaded; retrying would post the video twice, so treat it as sent.
  return init.publish_id;
}
