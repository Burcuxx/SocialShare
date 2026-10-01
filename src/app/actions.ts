"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createJob, retryJob } from "@/lib/jobs";
import { syncVideos } from "@/lib/youtube";

export async function createAccount(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  db.prepare("INSERT INTO accounts (name) VALUES (?)").run(name);
  revalidatePath("/");
}

export async function refreshVideos(formData: FormData) {
  try {
    await syncVideos(Number(formData.get("connectionId")));
  } catch (e) {
    redirect(`/?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/");
}

export async function sendVideo(formData: FormData) {
  const videoId = Number(formData.get("videoId"));
  for (const target of formData.getAll("target")) {
    const connectionId = Number(target);
    createJob(videoId, connectionId, String(formData.get(`caption-${connectionId}`) ?? "").replace(/\r\n/g, "\n"));
  }
  revalidatePath("/");
  revalidatePath(`/videos/${videoId}`);
}

export async function retry(formData: FormData) {
  retryJob(Number(formData.get("jobId")));
  revalidatePath(`/videos/${formData.get("videoId")}`);
}
