import Link from "next/link";
import { notFound } from "next/navigation";
import { db, type Connection, type JobStatus, type Video } from "@/lib/db";
import { DOWNLOAD_ERROR } from "@/lib/download";
import { jobsForVideo } from "@/lib/jobs";
import { retry, sendVideo } from "../../actions";
import { AutoRefresh } from "./auto-refresh";
import { CopyButton } from "./copy-button";
import { UploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

// Both TikTok and Instagram cap captions at 2200 characters.
const MAX_CAPTION = 2200;

const PLATFORM_NAMES = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram" };

const STATUS_LABELS: Record<JobStatus, string> = {
  pending: "Sırada",
  downloading: "İndiriliyor",
  processing: "Hazırlanıyor",
  uploading: "Yükleniyor",
  done: "Gönderildi",
  failed: "Hata",
};

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(Number(id)) as
    | Video
    | undefined;
  if (!video) notFound();

  const targets = db
    .prepare(
      `SELECT t.* FROM connections t
       JOIN connections yt ON yt.account_id = t.account_id
       WHERE yt.id = ? AND t.platform IN ('tiktok', 'instagram')
       ORDER BY t.platform, t.id`,
    )
    .all(video.connection_id) as Connection[];
  const jobs = jobsForVideo(video.id);

  const defaultCaption = [video.title, video.description]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_CAPTION);
  const newTargets = targets.filter((t) => !jobs.some((j) => j.target_connection_id === t.id));
  const running = jobs.some((j) => j.status !== "done" && j.status !== "failed");
  const downloadFailed = jobs.some(
    (j) => j.status !== "done" && j.error?.startsWith(DOWNLOAD_ERROR),
  );

  return (
    <>
      {running && <AutoRefresh />}
      <Link href="/">← Videolar</Link>
      <div className="video-header">
        {video.thumbnail_url && <img src={video.thumbnail_url} alt="" />}
        <h1>{video.title}</h1>
      </div>

      {downloadFailed && <UploadForm videoId={video.id} />}

      {targets.length === 0 && (
        <p className="muted">Bu hesaba bağlı TikTok veya Instagram yok.</p>
      )}

      {targets.map((t) => {
        const job = jobs.find((j) => j.target_connection_id === t.id);
        return (
          <section key={t.id} className="account">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <label className="row">
                {!job && (
                  <input type="checkbox" name="target" value={t.id} form="send" defaultChecked />
                )}
                <strong>{PLATFORM_NAMES[t.platform]}</strong>
                <span className="muted">{t.display_name}</span>
              </label>
              {job && <span className={`badge ${job.status}`}>{STATUS_LABELS[job.status]}</span>}
            </div>

            {!job && (
              <>
                <textarea
                  name={`caption-${t.id}`}
                  form="send"
                  defaultValue={defaultCaption}
                  maxLength={MAX_CAPTION}
                  rows={5}
                />
                {t.platform === "tiktok" && (
                  <p className="muted">
                    TikTok'a taslak olarak gider. TikTok bu metni otomatik eklemiyor; gönderdikten
                    sonra buradan kopyalayıp TikTok uygulamasında yapıştırırsın.
                  </p>
                )}
              </>
            )}

            {job?.error && job.status !== "done" && <p className="error">{job.error}</p>}
            {job?.status === "done" && t.platform === "tiktok" && (
              <p className="muted">
                Taslak TikTok'ta hazır. TikTok uygulamasındaki bildirime dokunup metni yapıştır ve
                paylaş.
              </p>
            )}
            {job && (
              <div className="row" style={{ marginTop: 10 }}>
                {job.status === "failed" && (
                  <form action={retry}>
                    <input type="hidden" name="jobId" value={job.id} />
                    <input type="hidden" name="videoId" value={video.id} />
                    <button>Tekrar dene</button>
                  </form>
                )}
                {t.platform === "tiktok" && job.caption && <CopyButton text={job.caption} />}
              </div>
            )}
          </section>
        );
      })}

      {newTargets.length > 0 && (
        <form id="send" action={sendVideo}>
          <input type="hidden" name="videoId" value={video.id} />
          <button className="primary">Gönder</button>
        </form>
      )}
    </>
  );
}
