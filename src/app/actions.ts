"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  endSession,
  hashPassword,
  ownAccount,
  requireUser,
  startSession,
  verifyPassword,
} from "@/lib/auth";
import { db, type User } from "@/lib/db";
import { isUploadPath } from "@/lib/files";
import { createPost, retryJob } from "@/lib/jobs";

const MIN_PASSWORD = 8;

function fail(page: "login" | "register", message: string): never {
  redirect(`/${page}?error=${encodeURIComponent(message)}`);
}

export async function register(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) fail("register", "Geçerli bir e-posta gir.");
  if (password.length < MIN_PASSWORD) fail("register", `Şifre en az ${MIN_PASSWORD} karakter olmalı.`);
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
    fail("register", "Bu e-posta zaten kayıtlı. Giriş yap.");
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
    fail("login", "E-posta veya şifre yanlış.");
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

export async function sendPost(formData: FormData) {
  const user = await requireUser();
  const accountId = Number(formData.get("accountId"));
  const filePath = String(formData.get("filePath") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!ownAccount(user.id, accountId)) throw new Error("Hesap bulunamadı");
  if (!isUploadPath(filePath) || !title) throw new Error("Video veya başlık eksik");

  const duration = Number(formData.get("durationSec"));
  const videoId = createPost({
    accountId,
    title,
    description: String(formData.get("description") ?? "").replace(/\r\n/g, "\n").trim(),
    durationSec: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
    filePath,
    targetIds: formData.getAll("target").map(Number),
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
