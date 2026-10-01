"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UploadForm({ videoId }: { videoId: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "uploading" | "error">("idle");

  async function upload(file: File) {
    setState("uploading");
    const res = await fetch(`/api/videos/${videoId}/file`, { method: "PUT", body: file });
    if (!res.ok) return setState("error");
    setState("idle");
    router.refresh();
  }

  return (
    <section className="account">
      <strong>Video indirilemedi</strong>
      <p className="muted">
        YouTube Studio'dan videoyu indirip buraya yükle, gönderim kaldığı yerden devam eder.
      </p>
      <input
        type="file"
        accept="video/mp4,video/*"
        disabled={state === "uploading"}
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      {state === "uploading" && <p className="muted">Yükleniyor…</p>}
      {state === "error" && <p className="error">Yükleme başarısız, tekrar dene.</p>}
    </section>
  );
}
