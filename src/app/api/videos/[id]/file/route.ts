import fs from "node:fs";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { currentUser, ownAccount } from "@/lib/auth";
import { db, type Video } from "@/lib/db";
import { mimeType } from "@/lib/files";

// GET /api/videos/:id/file -> the uploaded video, for the preview player.
// Supports Range requests: Safari won't play a <video> without them.
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { id } = await ctx.params;
  const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(Number(id)) as Video | undefined;
  if (!video?.file_path || !ownAccount(user.id, video.account_id) || !fs.existsSync(video.file_path)) {
    return new NextResponse(null, { status: 404 });
  }

  const size = fs.statSync(video.file_path).size;
  const headers: Record<string, string> = {
    "Content-Type": mimeType(video.file_path),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  const range = request.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (!range) {
    const body = Readable.toWeb(fs.createReadStream(video.file_path)) as ReadableStream;
    return new NextResponse(body, { headers: { ...headers, "Content-Length": String(size) } });
  }

  // "bytes=start-end", "bytes=start-" or "bytes=-suffixLength"
  let start = range[1] ? Number(range[1]) : size - Number(range[2]);
  let end = range[1] && range[2] ? Number(range[2]) : size - 1;
  start = Math.max(0, start);
  end = Math.min(end, size - 1);
  if (start > end) {
    return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  const body = Readable.toWeb(fs.createReadStream(video.file_path, { start, end })) as ReadableStream;
  return new NextResponse(body, {
    status: 206,
    headers: {
      ...headers,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
    },
  });
}
