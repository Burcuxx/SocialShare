import fs from "node:fs";
import { db, type Connection, type Job, type Video } from "./db";
import { downloadVideo } from "./download";
import * as tiktok from "./tiktok";

const MAX_ATTEMPTS = 3;
const POLL_MS = 5000;

type Uploader = (conn: Connection, filePath: string, job: Job, video: Video) => Promise<string>;

const uploaders: Partial<Record<Connection["platform"], Uploader>> = {
  tiktok: (conn, filePath, job, video) =>
    tiktok.publishVideo(conn, filePath, job.caption ?? "", video.duration_sec),
};

function setStatus(jobId: number, status: Job["status"], extra: Partial<Job> = {}) {
  const fields = { status, ...extra };
  const sets = Object.keys(fields).map((k) => `${k} = @${k}`).join(", ");
  db.prepare(`UPDATE jobs SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run({
    ...fields,
    id: jobId,
  });
}

/** Oldest pending job whose retry delay (1 min per attempt) has passed. */
function nextJob() {
  return db
    .prepare(
      `SELECT * FROM jobs
       WHERE status = 'pending'
         AND updated_at <= datetime('now', '-' || (attempts * 60) || ' seconds')
       ORDER BY id LIMIT 1`,
    )
    .get() as Job | undefined;
}

async function ensureFile(video: Video) {
  if (video.file_path && fs.existsSync(video.file_path)) return video.file_path;
  const filePath = await downloadVideo(video.youtube_id);
  db.prepare("UPDATE videos SET file_path = ? WHERE id = ?").run(filePath, video.id);
  return filePath;
}

/** Deletes the temp file once no job for the video is still in progress. */
function cleanup(videoId: number) {
  const active = db
    .prepare(
      `SELECT COUNT(*) AS n FROM jobs
       WHERE video_id = ? AND status IN ('pending','downloading','processing','uploading')`,
    )
    .get(videoId) as { n: number };
  if (active.n > 0) return;
  const video = db.prepare("SELECT file_path FROM videos WHERE id = ?").get(videoId) as Video;
  if (video.file_path) fs.rmSync(video.file_path, { force: true });
  db.prepare("UPDATE videos SET file_path = NULL WHERE id = ?").run(videoId);
}

async function runJob(job: Job) {
  const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(job.video_id) as Video;
  const conn = db
    .prepare("SELECT * FROM connections WHERE id = ?")
    .get(job.target_connection_id) as Connection;

  try {
    const upload = uploaders[conn.platform];
    if (!upload) throw new Error(`${conn.platform} gönderimi henüz desteklenmiyor`);

    setStatus(job.id, "downloading");
    const filePath = await ensureFile(video);

    setStatus(job.id, "uploading");
    const remoteId = await upload(conn, filePath, job, video);

    setStatus(job.id, "done", { remote_id: remoteId, error: null });
  } catch (e) {
    const attempts = job.attempts + 1;
    setStatus(job.id, attempts >= MAX_ATTEMPTS ? "failed" : "pending", {
      attempts,
      error: (e as Error).message,
    });
  }
  cleanup(job.video_id);
}

async function loop() {
  for (;;) {
    const job = nextJob();
    if (job) {
      await runJob(job);
    } else {
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
}

export function startWorker() {
  // Jobs interrupted by a shutdown go back to the queue.
  db.prepare(
    `UPDATE jobs SET status = 'pending'
     WHERE status IN ('downloading','processing','uploading')`,
  ).run();
  loop().catch((e) => console.error("Worker stopped:", e));
}
