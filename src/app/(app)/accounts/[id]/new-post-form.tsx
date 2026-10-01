"use client";

import { useEffect, useState } from "react";
import { sendPost } from "@/app/actions";
import { ArrowRight, Close, Info, Upload } from "@/components/icons";
import { PlatformMark } from "@/components/platform-mark";
import { formatDuration } from "@/i18n";
import { useT } from "@/i18n/client";
import type { Platform } from "@/lib/db";
import { PLATFORM_NAMES, PLATFORMS } from "@/lib/labels";

type Target = { id: number; platform: Platform; name: string };

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 2000;

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
    // Headers must be Latin-1; names like "şarkı 🎵.mp4" would throw. The server only reads the extension.
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status === 200 ? resolve(JSON.parse(xhr.responseText).path) : reject(new Error()));
    xhr.onerror = () => reject(new Error());
    xhr.send(file);
  });
}

function Counter({ value, max }: { value: number; max: number }) {
  const level = value > max ? " over" : value >= max * 0.9 ? " near" : "";
  return (
    <span className={`counter${level}`}>
      {value} / {max}
    </span>
  );
}

export function NewPostForm({ accountId, targets }: { accountId: number; targets: Target[] }) {
  const { t } = useT();
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState(() => new Set(targets.map((x) => x.id)));
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Local preview of the picked file; released when the file changes.
  useEffect(() => {
    if (!file) return setPreviewUrl(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const busy = progress !== null;
  const canSend = !!file && title.trim() !== "" && selected.size > 0 && !busy;
  const missing = PLATFORMS.filter((p) => !targets.some((x) => x.platform === p));

  function pick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setDuration(0);
    readDuration(f).then(setDuration);
  }

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !canSend) return;
    setError(null);
    setProgress(0);
    try {
      const filePath = await upload(file, setProgress);
      const fd = new FormData();
      fd.set("accountId", String(accountId));
      fd.set("filePath", filePath);
      fd.set("durationSec", String(duration));
      fd.set("title", title);
      fd.set("description", description);
      selected.forEach((id) => fd.append("target", String(id)));
      await sendPost(fd);
    } catch {
      setError(t.newPost.uploadFailed);
      setProgress(null);
    }
  }

  const sizeMb = file ? `${(file.size / 1024 / 1024).toFixed(file.size < 10 * 1024 * 1024 ? 1 : 0)} MB` : "";
  const dur = formatDuration(duration ? Math.round(duration) : null);

  return (
    <form className="cols cols-new" onSubmit={submit}>
      <section className="card stack">
        <h2>{t.newPost.title}</h2>

        {file ? (
          <div className="file-row">
            {previewUrl ? (
              <video className="thumb thumb-sm" src={`${previewUrl}#t=0.1`} muted playsInline preload="metadata" aria-hidden="true" />
            ) : (
              <span className="thumb thumb-sm" aria-hidden="true" />
            )}
            <span className="file-meta">
              <span className="file-name">{file.name}</span>
              <span className="num muted">{[dur, sizeMb].filter(Boolean).join(" · ")}</span>
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label={t.newPost.removeFile}
              onClick={() => setFile(null)}
              disabled={busy}
            >
              <Close />
            </button>
          </div>
        ) : (
          <label
            className={`dropzone${dragging ? " dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files[0]);
            }}
          >
            <span className="dropzone-icon"><Upload /></span>
            <strong>{t.newPost.dropTitle}</strong>
            <span className="muted">{t.newPost.dropHint}</span>
            <input
              type="file"
              className="visually-hidden"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>
        )}

        <label className="field">
          <span className="field-label">
            {t.newPost.fieldTitle}
            <Counter value={title.length} max={TITLE_MAX} />
          </span>
          <input
            type="text"
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">
            {t.newPost.fieldDescription}
            <Counter value={description.length} max={DESCRIPTION_MAX} />
          </span>
          <textarea
            rows={5}
            value={description}
            maxLength={DESCRIPTION_MAX}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </section>

      <section className="stack">
        <h2>{t.newPost.where}</h2>

        {targets.length === 0 && (
          <div className="card empty">
            <strong>{t.newPost.emptyTitle}</strong>
            <span className="muted">{t.newPost.emptyText}</span>
            <div className="row">
              <a className="btn" href={`/api/auth/youtube?accountId=${accountId}`}>+ YouTube</a>
              <a className="btn" href={`/api/auth/tiktok?accountId=${accountId}`}>+ TikTok</a>
            </div>
          </div>
        )}

        {targets.map((x) => (
          <label key={x.id} className={`target${selected.has(x.id) ? " selected" : ""}`}>
            <PlatformMark platform={x.platform} />
            <span className="target-body">
              <strong>{PLATFORM_NAMES[x.platform]}</strong>
              <span className="muted ellipsis">{x.name}</span>
              {t.newPost.notes[x.platform] && <span className="warn-note">{t.newPost.notes[x.platform]}</span>}
            </span>
            <input
              type="checkbox"
              checked={selected.has(x.id)}
              onChange={() => toggle(x.id)}
              disabled={busy}
            />
          </label>
        ))}

        {targets.length > 0 &&
          missing.map((p) => (
            <div key={p} className="target target-off">
              <PlatformMark platform={p} muted />
              <span className="target-body">
                <strong>{p === "instagram" ? "Instagram Reels" : PLATFORM_NAMES[p]}</strong>
                <span className="muted">{t.newPost.notConnected}</span>
              </span>
            </div>
          ))}

        <p className="muted info">
          <Info /> {t.newPost.captionNote}
        </p>

        {error && <div className="alert" role="alert">{error}</div>}

        <div className="send-bar">
          {busy && (
            <div className="progress" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </div>
          )}
          <button className="btn btn-primary" disabled={!canSend}>
            {busy
              ? progress! < 100
                ? t.newPost.uploadingPct(progress!)
                : t.newPost.sending
              : t.newPost.send(selected.size)}
            {!busy && <ArrowRight />}
          </button>
        </div>
      </section>
    </form>
  );
}
