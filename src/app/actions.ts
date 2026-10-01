"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
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
