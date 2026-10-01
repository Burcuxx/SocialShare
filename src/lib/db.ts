import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id          INTEGER PRIMARY KEY,
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

export type Account = { id: number; name: string; created_at: string };

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
