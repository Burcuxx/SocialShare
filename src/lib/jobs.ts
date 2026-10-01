import { db, type Job } from "./db";

/**
 * One job per (video, target). If a job already exists for that pair,
 * nothing happens: this is what prevents sending the same video twice.
 */
export function createJob(videoId: number, targetConnectionId: number, caption: string) {
  db.prepare(
    `INSERT INTO jobs (video_id, target_connection_id, caption)
     VALUES (?, ?, ?)
     ON CONFLICT (video_id, target_connection_id) DO NOTHING`,
  ).run(videoId, targetConnectionId, caption);
}

/** Manual retry: only failed jobs go back to the queue. */
export function retryJob(jobId: number) {
  db.prepare(
    `UPDATE jobs SET status = 'pending', attempts = 0, error = NULL, updated_at = datetime('now')
     WHERE id = ? AND status = 'failed'`,
  ).run(jobId);
}

export function jobsForVideo(videoId: number) {
  return db.prepare("SELECT * FROM jobs WHERE video_id = ?").all(videoId) as Job[];
}
