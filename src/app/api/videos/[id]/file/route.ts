import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { NextResponse, type NextRequest } from "next/server";
import { db, type Video } from "@/lib/db";
import { videoPath } from "@/lib/download";

// PUT /api/videos/:id/file  (body = raw video file)
// Fallback when yt-dlp can't download: the user drops the file from YouTube Studio.
export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(Number(id)) as
    | Video
    | undefined;
  if (!video || !request.body) {
    return NextResponse.json({ error: "Video or file missing" }, { status: 400 });
  }

  // Stream to disk instead of buffering: videos can be hundreds of MB.
  const filePath = videoPath(video.youtube_id);
  await pipeline(
    Readable.fromWeb(request.body as WebReadableStream),
    fs.createWriteStream(filePath),
  );

  db.transaction(() => {
    db.prepare("UPDATE videos SET file_path = ? WHERE id = ?").run(filePath, video.id);
    db.prepare(
      `UPDATE jobs SET status = 'pending', attempts = 0, error = NULL, updated_at = datetime('now')
       WHERE video_id = ? AND status IN ('pending', 'failed')`,
    ).run(video.id);
  })();

  return NextResponse.json({ ok: true });
}
