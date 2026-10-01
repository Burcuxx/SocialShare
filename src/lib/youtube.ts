import { db, type Connection } from "./db";

const API = "https://www.googleapis.com/youtube/v3";
const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const MAX_VIDEOS = 500;

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

type PlaylistItems = {
  nextPageToken?: string;
  items: {
    snippet: {
      title: string;
      description: string;
      thumbnails: Record<string, { url: string }>;
    };
    contentDetails: { videoId: string; videoPublishedAt?: string };
  }[];
};

type VideoList = { items: { id: string; contentDetails: { duration: string } }[] };

/** "PT1H2M3S" -> 3723 */
function parseDuration(iso: string) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/**
 * Pulls the channel's uploads into the videos table.
 * Quota: 1 unit per 50 videos for playlistItems + 1 per 50 for durations,
 * instead of 100 per call for search.list.
 */
export async function syncVideos(connectionId: number) {
  const conn = db.prepare("SELECT * FROM connections WHERE id = ?").get(connectionId) as
    | Connection
    | undefined;
  if (!conn || conn.platform !== "youtube") throw new Error("YouTube connection not found");
  const token = await accessToken(conn);

  const channels = await get<ChannelList>("channels", token, {
    part: "contentDetails",
    id: conn.external_id,
  });
  const uploads = channels.items?.[0]?.contentDetails.relatedPlaylists.uploads;
  if (!uploads) throw new Error("Uploads playlist not found");

  const upsert = db.prepare(
    `INSERT INTO videos (connection_id, youtube_id, title, description, thumbnail_url, duration_sec, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (youtube_id) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       thumbnail_url = excluded.thumbnail_url,
       duration_sec = excluded.duration_sec,
       published_at = excluded.published_at`,
  );

  let pageToken: string | undefined;
  let count = 0;
  do {
    const page = await get<PlaylistItems>("playlistItems", token, {
      part: "snippet,contentDetails",
      playlistId: uploads,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });

    const ids = page.items.map((i) => i.contentDetails.videoId);
    const durations = new Map<string, number | null>();
    if (ids.length) {
      const details = await get<VideoList>("videos", token, {
        part: "contentDetails",
        id: ids.join(","),
      });
      for (const v of details.items) durations.set(v.id, parseDuration(v.contentDetails.duration));
    }

    db.transaction(() => {
      for (const item of page.items) {
        const id = item.contentDetails.videoId;
        // Private/deleted videos have no details; skip them.
        if (!durations.has(id)) continue;
        const thumbs = item.snippet.thumbnails;
        upsert.run(
          conn.id,
          id,
          item.snippet.title,
          item.snippet.description,
          (thumbs.medium ?? thumbs.high ?? thumbs.default)?.url ?? null,
          durations.get(id),
          item.contentDetails.videoPublishedAt ?? null,
        );
      }
    })();

    count += page.items.length;
    pageToken = page.nextPageToken;
  } while (pageToken && count < MAX_VIDEOS);
}
