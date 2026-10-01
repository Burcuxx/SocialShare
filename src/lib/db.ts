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

CREATE TABLE IF NOT EXISTS videos (
  id             INTEGER PRIMARY KEY,
  connection_id  INTEGER NOT NULL REFERENCES connections(id),
  youtube_id     TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  description    TEXT,
  thumbnail_url  TEXT,
  duration_sec   INTEGER,
  published_at   TEXT,
  file_path      TEXT
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
  connection_id: number;
  youtube_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  published_at: string | null;
  file_path: string | null;
};

function open() {
  const dbPath = process.env.DATABASE_PATH ?? "./data/social-share.db";
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

// Reuse one connection across hot reloads in dev.
const g = globalThis as unknown as { db?: Database.Database };
export const db = (g.db ??= open());
