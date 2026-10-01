import { db, type Connection, type Job } from "./db";

type NewPost = {
  accountId: number;
  title: string;
  description: string;
  durationSec: number | null;
  filePath: string;
  targetIds: number[];
};

/**
 * Saves the uploaded video and one job per target platform, in one transaction.
 * YouTube gets title + description; TikTok/Instagram have only a caption, so both are joined.
 * Returns the video id.
 */
export function createPost(post: NewPost) {
  const targets = db
    .prepare("SELECT * FROM connections WHERE account_id = ?")
    .all(post.accountId)
    .filter((c) => post.targetIds.includes((c as Connection).id)) as Connection[];
  const caption = [post.title, post.description].filter(Boolean).join("\n\n").slice(0, 2200);

  return db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO videos (account_id, title, description, duration_sec, file_path)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(post.accountId, post.title, post.description, post.durationSec, post.filePath);
    const insertJob = db.prepare(
      "INSERT INTO jobs (video_id, target_connection_id, title, caption) VALUES (?, ?, ?, ?)",
    );
    for (const t of targets) {
      if (t.platform === "youtube") {
        insertJob.run(lastInsertRowid, t.id, post.title, post.description);
      } else {
        insertJob.run(lastInsertRowid, t.id, null, caption);
      }
    }
    return Number(lastInsertRowid);
  })();
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
