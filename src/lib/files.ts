import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const TYPES: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

export function tmpDir() {
  const dir = process.env.TMP_DIR ?? "./tmp";
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** A fresh path in the temp folder, keeping a known video extension. */
export function newUploadPath(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return path.join(tmpDir(), `${randomUUID()}.${ext in TYPES ? ext : "mp4"}`);
}

/** Uploads are named <uuid>.<ext>; only accept those, so a form can't point at any other file. */
export function isUploadPath(filePath: string) {
  return (
    path.resolve(path.dirname(filePath)) === path.resolve(tmpDir()) &&
    /^[0-9a-f-]{36}\.(mp4|mov|webm)$/.test(path.basename(filePath))
  );
}

export function mimeType(filePath: string) {
  return TYPES[path.extname(filePath).slice(1)] ?? "video/mp4";
}
