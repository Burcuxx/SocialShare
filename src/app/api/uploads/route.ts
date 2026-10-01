import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { newUploadPath } from "@/lib/files";

// PUT /api/uploads  (body = raw video file, X-File-Name header) -> { path }
export async function PUT(request: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!request.body) return NextResponse.json({ error: "File missing" }, { status: 400 });
  const filePath = newUploadPath(request.headers.get("x-file-name") ?? "");
  // Stream to disk instead of buffering: videos can be hundreds of MB.
  await pipeline(
    Readable.fromWeb(request.body as WebReadableStream),
    fs.createWriteStream(filePath),
  );
  return NextResponse.json({ path: filePath });
}
