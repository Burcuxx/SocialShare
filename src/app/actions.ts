"use server";

import fs from "node:fs";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  endSession,
  hashPassword,
  ownAccount,
  requireUser,
  startSession,
  verifyPassword,
} from "@/lib/auth";
import { db, toDbDate, type User, type Video } from "@/lib/db";
import { isUploadPath } from "@/lib/files";
import { clearSchedule, createPost, retryJob } from "@/lib/jobs";
import { isLocale, type ErrorCode } from "@/i18n";
import { getT } from "@/i18n/server";

const MIN_PASSWORD = 8;

/** Errors travel as codes; the page shows them in the user's language. */
function fail(page: "login" | "register", code: ErrorCode): never {
  redirect(`/${page}?error=${code}`);
}

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set("lang", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function register(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) fail("register", "invalidEmail");
  if (password.length < MIN_PASSWORD) fail("register", "shortPassword");
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
    fail("register", "emailTaken");
  }

  const userId = db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
      .run(email, hashPassword(password));
    // Accounts created before login existed belong to the first user.
    db.prepare("UPDATE accounts SET user_id = ? WHERE user_id IS NULL").run(lastInsertRowid);
    return Number(lastInsertRowid);
  })();
  await startSession(userId);
  redirect("/");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) {
    fail("login", "wrongCredentials");
  }
  await startSession(user.id);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function createAccount(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { lastInsertRowid } = db
    .prepare("INSERT INTO accounts (user_id, name) VALUES (?, ?)")
    .run(user.id, name);
  redirect(`/accounts/${lastInsertRowid}`);
}

/**
 * Deletes the account with its connections, videos, jobs and temp files.
 * Posts already published on the platforms stay there.
 */
export async function deleteAccount(formData: FormData) {
  const user = await requireUser();
  const accountId = Number(formData.get("accountId"));
  if (!ownAccount(user.id, accountId)) redirect("/");
  const busy = db
    .prepare(
      `SELECT 1 FROM jobs j JOIN videos v ON v.id = j.video_id
       WHERE v.account_id = ? AND j.status IN ('downloading', 'processing', 'uploading')`,
    )
    .get(accountId);
  if (busy) redirect(`/accounts/${accountId}?error=accountBusy`);

  const files = db
    .prepare("SELECT file_path FROM videos WHERE account_id = ? AND file_path IS NOT NULL")
    .all(accountId) as Pick<Video, "file_path">[];
  db.transaction(() => {
    db.prepare("DELETE FROM jobs WHERE video_id IN (SELECT id FROM videos WHERE account_id = ?)").run(accountId);
    db.prepare("DELETE FROM videos WHERE account_id = ?").run(accountId);
    db.prepare("DELETE FROM connections WHERE account_id = ?").run(accountId);
    db.prepare("DELETE FROM accounts WHERE id = ?").run(accountId);
  })();
  for (const f of files) if (f.file_path) fs.rmSync(f.file_path, { force: true });
  revalidatePath("/", "layout");
  redirect("/");
}

export async function sendPost(formData: FormData) {
  const user = await requireUser();
  const accountId = Number(formData.get("accountId"));
  const filePath = String(formData.get("filePath") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const { t } = await getT();
  if (!ownAccount(user.id, accountId)) throw new Error(t.errors.accountNotFound);
  if (!isUploadPath(filePath) || !title) throw new Error(t.errors.missingVideo);

  const duration = Number(formData.get("durationSec"));
  // The browser sends the picked local time as UTC ISO; a time in the past means "now".
  const when = new Date(String(formData.get("scheduledAt") ?? ""));
  const scheduledAt = !Number.isNaN(when.getTime()) && when.getTime() > Date.now() ? toDbDate(when) : null;
  const videoId = createPost({
    accountId,
    title,
    description: String(formData.get("description") ?? "").replace(/\r\n/g, "\n").trim(),
    durationSec: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
    filePath,
    targetIds: formData.getAll("target").map(Number),
    scheduledAt,
  });
  redirect(`/posts/${videoId}`);
}

export async function retry(formData: FormData) {
  const user = await requireUser();
  const jobId = Number(formData.get("jobId"));
  const owned = db
    .prepare(
      `SELECT 1 FROM jobs j
       JOIN videos v ON v.id = j.video_id
       JOIN accounts a ON a.id = v.account_id
       WHERE j.id = ? AND a.user_id = ?`,
    )
    .get(jobId, user.id);
  if (owned) retryJob(jobId);
  revalidatePath(`/posts/${formData.get("videoId")}`);
}

export async function sendNow(formData: FormData) {
  const user = await requireUser();
  const videoId = Number(formData.get("videoId"));
  const video = db.prepare("SELECT account_id FROM videos WHERE id = ?").get(videoId) as
    | Pick<Video, "account_id">
    | undefined;
  if (video && ownAccount(user.id, video.account_id)) clearSchedule(videoId);
  revalidatePath(`/posts/${videoId}`);
}
