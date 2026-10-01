import fs from "node:fs";
import { db, type Connection, type Job, type Video } from "./db";
import * as tiktok from "./tiktok";
import * as youtube from "./youtube";

const MAX_ATTEMPTS = 3;
const POLL_MS = 5000;

type Uploader = (conn: Connection, filePath: string, job: Job, video: Video) => Promise<string>;

const uploaders: Partial<Record<Connection["platform"], Uploader>> = {
  youtube: (conn, filePath, job) =>
    youtube.uploadVideo(conn, filePath, job.title ?? "", job.caption ?? ""),
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

/** Oldest pending job whose retry delay (1 min per attempt) and scheduled time have passed. */
function nextJob() {
  return db
    .prepare(
      `SELECT j.* FROM jobs j JOIN videos v ON v.id = j.video_id
       WHERE j.status = 'pending'
         AND j.updated_at <= datetime('now', '-' || (j.attempts * 60) || ' seconds')
         AND (v.scheduled_at IS NULL OR v.scheduled_at <= datetime('now'))
       ORDER BY j.id LIMIT 1`,
    )
    .get() as Job | undefined;
}

/** Deletes the temp file once every job for the video is done (failed ones may be retried). */
function cleanup(videoId: number) {
  const open = db
    .prepare("SELECT COUNT(*) AS n FROM jobs WHERE video_id = ? AND status != 'done'")
    .get(videoId) as { n: number };
  if (open.n > 0) return;
  const video = db.prepare("SELECT file_path FROM videos WHERE id = ?").get(videoId) as
    | Video
    | undefined;
  if (!video) return; // the account was deleted meanwhile
  if (video.file_path) fs.rmSync(video.file_path, { force: true });
  db.prepare("UPDATE videos SET file_path = NULL WHERE id = ?").run(videoId);
}

async function runJob(job: Job) {
  const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(job.video_id) as
    | Video
    | undefined;
  const conn = db
    .prepare("SELECT * FROM connections WHERE id = ?")
    .get(job.target_connection_id) as Connection | undefined;
  if (!video || !conn) return; // the account was deleted meanwhile

  try {
    const upload = uploaders[conn.platform];
    if (!upload) throw new Error(`${conn.platform} gönderimi henüz desteklenmiyor`);

    const filePath = video.file_path;
    if (!filePath || !fs.existsSync(filePath)) throw new Error("Video dosyası bulunamadı");

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
      // One bad job must not stop the worker.
      await runJob(job).catch((e) => console.error("Job failed unexpectedly:", e));
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
