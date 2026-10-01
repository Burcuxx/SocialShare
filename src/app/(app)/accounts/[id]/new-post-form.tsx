"use client";

import { useState } from "react";
import { sendPost } from "@/app/actions";

type Target = { id: number; platform: string; label: string };

/** Reads the video length in the browser, so the server doesn't need ffprobe. */
function readDuration(file: File) {
  return new Promise<number>((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve(video.duration);
    video.onerror = () => resolve(0);
    video.src = URL.createObjectURL(file);
  });
}

/** XHR instead of fetch: it reports upload progress. */
function upload(file: File, onProgress: (pct: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", "/api/uploads");
    xhr.setRequestHeader("X-File-Name", file.name);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () =>
      xhr.status === 200 ? resolve(JSON.parse(xhr.responseText).path) : reject(new Error(xhr.responseText));
    xhr.onerror = () => reject(new Error("Yükleme başarısız"));
    xhr.send(file);
  });
}

export function NewPostForm({ accountId, targets }: { accountId: number; targets: Target[] }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    const file = formData.get("file") as File;
    setError(null);
    try {
      setProgress(0);
      const [filePath, duration] = await Promise.all([upload(file, setProgress), readDuration(file)]);
      formData.delete("file");
      formData.set("filePath", filePath);
      formData.set("durationSec", String(duration));
      formData.set("accountId", String(accountId));
      await sendPost(formData);
    } catch (e) {
      setError((e as Error).message);
      setProgress(null);
    }
  }

  const busy = progress !== null;
  return (
    <form action={submit} className="card stack">
      <h2>Yeni video</h2>
      <input type="file" name="file" accept="video/mp4,video/quicktime,video/webm" required />
      <input type="text" name="title" placeholder="Başlık" maxLength={100} required />
      <textarea name="description" placeholder="Açıklama" rows={5} maxLength={2000} />

      {targets.length === 0 ? (
        <p className="muted">Önce yukarıdan en az bir platform bağla.</p>
      ) : (
        <div className="row">
          {targets.map((t) => (
            <label key={t.id} className="check">
              <input type="checkbox" name="target" value={t.id} defaultChecked /> {t.label}
            </label>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy || targets.length === 0}>
        {busy ? (progress! < 100 ? `Yükleniyor %${progress}` : "Gönderiliyor…") : "Gönder"}
      </button>
    </form>
  );
}
