import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash  TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Only a hash of the session token is stored; the token itself lives in the cookie.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS connections (
  id             INTEGER PRIMARY KEY,
  account_id     INTEGER NOT NULL REFERENCES accounts(id),
  platform       TEXT NOT NULL CHECK (platform IN ('youtube','tiktok','instagram')),
  external_id    TEXT NOT NULL,
  display_name   TEXT,
  access_token   TEXT NOT NULL,
  refresh_token  TEXT,
  expires_at     TEXT,
  UNIQUE (platform, external_id)
);

-- A video I upload once and send to several platforms.
CREATE TABLE IF NOT EXISTS videos (
  id             INTEGER PRIMARY KEY,
  account_id     INTEGER NOT NULL REFERENCES accounts(id),
  title          TEXT NOT NULL,
  description    TEXT,
  duration_sec   INTEGER,
  file_path      TEXT,
  scheduled_at   TEXT,  -- UTC "YYYY-MM-DD HH:MM:SS"; NULL = send right away
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id                    INTEGER PRIMARY KEY,
  video_id              INTEGER NOT NULL REFERENCES videos(id),
  target_connection_id  INTEGER NOT NULL REFERENCES connections(id),
  title                 TEXT,
  caption               TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','downloading','processing','uploading','done','failed')),
  attempts              INTEGER NOT NULL DEFAULT 0,
  error                 TEXT,
  remote_id             TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (video_id, target_connection_id)
);
`;

export type Platform = "youtube" | "tiktok" | "instagram";

export type User = { id: number; email: string; password_hash: string; created_at: string };

export type Account = { id: number; user_id: number | null; name: string; created_at: string };

export type Connection = {
  id: number;
  account_id: number;
  platform: Platform;
  external_id: string;
  display_name: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
};

export type Video = {
  id: number;
  account_id: number;
  title: string;
  description: string | null;
  duration_sec: number | null;
  file_path: string | null;
  scheduled_at: string | null;
  created_at: string;
};

/**
 * v1: videos used to be a cache of YouTube uploads (youtube_id column).
 * Now they are files uploaded to this app. The old rows can't be converted,
 * so drop videos and jobs; accounts and connections are kept.
 */
function migrate(db: Database.Database) {
  if (db.pragma("user_version", { simple: true }) !== 0) return;
  const cols = db.prepare("PRAGMA table_info(videos)").all() as { name: string }[];
  if (cols.some((c) => c.name === "youtube_id")) {
    db.exec("DROP TABLE IF EXISTS jobs; DROP TABLE IF EXISTS videos;");
  }
  db.pragma("user_version = 1");
}

function open() {
  const dbPath = process.env.DATABASE_PATH ?? "./data/social-share.db";
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  db.exec(SCHEMA);
  // v2: accounts belong to a user. Existing accounts get user_id NULL and are
  // claimed by the first user who registers.
  const accountCols = db.prepare("PRAGMA table_info(accounts)").all() as { name: string }[];
  if (!accountCols.some((c) => c.name === "user_id")) {
    db.exec("ALTER TABLE accounts ADD COLUMN user_id INTEGER REFERENCES users(id)");
  }
  // v3: scheduled posts.
  const videoCols = db.prepare("PRAGMA table_info(videos)").all() as { name: string }[];
  if (!videoCols.some((c) => c.name === "scheduled_at")) {
    db.exec("ALTER TABLE videos ADD COLUMN scheduled_at TEXT");
  }
  return db;
}

// Reuse one connection across hot reloads in dev.
const g = globalThis as unknown as { db?: Database.Database };
export const db = (g.db ??= open());

export type JobStatus = "pending" | "downloading" | "processing" | "uploading" | "done" | "failed";

export type Job = {
  id: number;
  video_id: number;
  target_connection_id: number;
  title: string | null;
  caption: string | null;
  status: JobStatus;
  attempts: number;
  error: string | null;
  remote_id: string | null;
  created_at: string;
  updated_at: string;
};

/** SQLite datetime format (UTC, no zone) for comparing with datetime('now'). */
export function toDbDate(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/** True while a video waits for its scheduled time. */
export function isScheduled(video: Pick<Video, "scheduled_at">) {
  return !!video.scheduled_at && video.scheduled_at > toDbDate(new Date());
}
