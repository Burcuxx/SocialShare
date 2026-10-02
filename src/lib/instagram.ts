import fs from "node:fs/promises";
import { db, type Connection } from "./db";

/**
 * Instagram Reels through the Graph API with Facebook Login for Business:
 * only that login type may upload a local file (resumable upload to rupload.facebook.com).
 * The Instagram account must be Professional (Business or Creator) and linked to a Facebook Page.
 */
const VERSION = "v24.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;
const SCOPE = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");
const DAY = 24 * 60 * 60 * 1000;

function redirectUri() {
  return `${process.env.APP_URL}/api/auth/instagram/callback`;
}

export function authUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: redirectUri(),
    state,
    scope: SCOPE,
    response_type: "code",
  });
  return `https://www.facebook.com/${VERSION}/dialog/oauth?${params}`;
}

type GraphError = { error?: { message: string; code: number } };

/** Graph API call; errors keep the numeric code so expired tokens (190) can be recognised. */
async function graph<T>(path: string, init: RequestInit & { params?: Record<string, string> } = {}): Promise<T> {
  const url = `${GRAPH}${path}${init.params ? `?${new URLSearchParams(init.params)}` : ""}`;
  const res = await fetch(url, init);
  const json = (await res.json()) as T & GraphError;
  if (!res.ok || json.error) {
    throw new Error(`Instagram API error (${json.error?.code ?? res.status}): ${json.error?.message ?? res.statusText}`);
  }
  return json;
}

type Token = { access_token: string; expires_in?: number };

/** Short-lived tokens last an hour; long-lived ones about 60 days. */
function longLived(token: string) {
  return graph<Token>("/oauth/access_token", {
    params: {
      grant_type: "fb_exchange_token",
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      fb_exchange_token: token,
    },
  });
}

function expiresAt(token: Token) {
  return new Date(Date.now() + (token.expires_in ?? 60 * 24 * 60 * 60) * 1000).toISOString();
}

type Pages = {
  data: { name: string; instagram_business_account?: { id: string; username: string } }[];
};

/** Saves every Instagram account the user granted (one per Facebook Page) to this app account. */
export async function connect(accountId: number, code: string) {
  const short = await graph<Token>("/oauth/access_token", {
    params: {
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: redirectUri(),
      code,
    },
  });
  const token = await longLived(short.access_token);
  const pages = await graph<Pages>("/me/accounts", {
    params: { fields: "name,instagram_business_account{id,username}", access_token: token.access_token },
  });
  const accounts = pages.data.flatMap((p) => (p.instagram_business_account ? [p.instagram_business_account] : []));
  if (accounts.length === 0) {
    throw new Error(
      "Bu Facebook hesabında Facebook sayfasına bağlı bir Instagram Profesyonel hesap bulunamadı. " +
        "Instagram'ı İşletme ya da İçerik Üreticisi hesabına çevirip bir Facebook sayfasına bağla.",
    );
  }

  const upsert = db.prepare(
    `INSERT INTO connections (account_id, platform, external_id, display_name, access_token, expires_at)
     VALUES (?, 'instagram', ?, ?, ?, ?)
     ON CONFLICT (platform, external_id) DO UPDATE SET
       account_id = excluded.account_id,
       display_name = excluded.display_name,
       access_token = excluded.access_token,
       expires_at = excluded.expires_at`,
  );
  for (const ig of accounts) {
    upsert.run(accountId, ig.id, `@${ig.username}`, token.access_token, expiresAt(token));
  }
}

/** Long-lived tokens can't be refreshed once expired, so renew them a week early. */
async function accessToken(conn: Connection) {
  const expires = conn.expires_at ? Date.parse(conn.expires_at) : Infinity;
  if (expires <= Date.now()) throw new Error("Instagram token expired; reconnect the account");
  if (expires - Date.now() > 7 * DAY) return conn.access_token;
  const token = await longLived(conn.access_token);
  db.prepare("UPDATE connections SET access_token = ?, expires_at = ? WHERE id = ?").run(
    token.access_token,
    expiresAt(token),
    conn.id,
  );
  return token.access_token;
}

/**
 * Publishes the video as a Reel (also shown on the profile grid) and returns its permalink.
 * Steps: create a resumable container → upload the bytes → wait until FINISHED → publish.
 */
export async function publishReel(conn: Connection, filePath: string, caption: string) {
  const token = await accessToken(conn);
  const file = await fs.readFile(filePath);

  const container = await graph<{ id: string; uri?: string }>(`/${conn.external_id}/media`, {
    method: "POST",
    params: {
      media_type: "REELS",
      upload_type: "resumable",
      caption: caption.slice(0, 2200),
      share_to_feed: "true",
      access_token: token,
    },
  });

  const upload = await fetch(
    container.uri ?? `https://rupload.facebook.com/ig-api-upload/${VERSION}/${container.id}`,
    {
      method: "POST",
      headers: {
        Authorization: `OAuth ${token}`,
        offset: "0",
        file_size: String(file.length),
      },
      body: file,
    },
  );
  if (!upload.ok) throw new Error(`Instagram upload failed: ${upload.status} ${await upload.text()}`);

  // Instagram processes the video before it can be published (usually under a minute).
  for (let i = 0; ; i++) {
    const { status_code, status } = await graph<{ status_code: string; status?: string }>(`/${container.id}`, {
      params: { fields: "status_code,status", access_token: token },
    });
    if (status_code === "FINISHED") break;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error(`Instagram rejected the video: ${status ?? status_code}`);
    }
    if (i >= 120) throw new Error("Instagram is still processing the video after 10 minutes");
    await new Promise((r) => setTimeout(r, 5000));
  }

  const media = await graph<{ id: string }>(`/${conn.external_id}/media_publish`, {
    method: "POST",
    params: { creation_id: container.id, access_token: token },
  });
  const { permalink } = await graph<{ permalink?: string }>(`/${media.id}`, {
    params: { fields: "permalink", access_token: token },
  }).catch(() => ({ permalink: undefined }));
  return permalink ?? media.id;
}
