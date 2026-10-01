"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isUploadPath } from "@/lib/files";
import { createPost, retryJob } from "@/lib/jobs";

export async function createAccount(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { lastInsertRowid } = db.prepare("INSERT INTO accounts (name) VALUES (?)").run(name);
  redirect(`/accounts/${lastInsertRowid}`);
}

export async function sendPost(formData: FormData) {
  const filePath = String(formData.get("filePath") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!isUploadPath(filePath) || !title) throw new Error("Video veya başlık eksik");

  const duration = Number(formData.get("durationSec"));
  const videoId = createPost({
    accountId: Number(formData.get("accountId")),
    title,
    description: String(formData.get("description") ?? "").replace(/\r\n/g, "\n").trim(),
    durationSec: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
    filePath,
    targetIds: formData.getAll("target").map(Number),
  });
  redirect(`/posts/${videoId}`);
}

export async function retry(formData: FormData) {
  retryJob(Number(formData.get("jobId")));
  revalidatePath(`/posts/${formData.get("videoId")}`);
}
