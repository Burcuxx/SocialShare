import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export const DOWNLOAD_ERROR = "İndirme başarısız";

export function tmpDir() {
  const dir = process.env.TMP_DIR ?? "./tmp";
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function videoPath(youtubeId: string) {
  return path.join(tmpDir(), `${youtubeId}.mp4`);
}

/** Downloads the YouTube video as a single mp4 with yt-dlp. */
export async function downloadVideo(youtubeId: string) {
  const out = videoPath(youtubeId);
  try {
    await run(
      "yt-dlp",
      [
        "-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
        "--merge-output-format", "mp4",
        "--no-playlist",
        "-o", out,
        `https://www.youtube.com/watch?v=${youtubeId}`,
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    const detail = err.stderr?.trim().split("\n").pop() ?? err.message;
    throw new Error(`${DOWNLOAD_ERROR}: ${detail}`);
  }
  return out;
}
