import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { ownAccount, requireUser } from "@/lib/auth";
import { db, type Connection, type Video } from "@/lib/db";
import { jobsForVideo } from "@/lib/jobs";
import { PLATFORM_NAMES, STATUS_LABELS } from "@/lib/labels";
import { retry } from "@/app/actions";

export const dynamic = "force-dynamic";

function doneNote(platform: Connection["platform"], remoteId: string | null) {
  if (platform === "youtube") {
    return (
      <>
        YouTube'a yüklendi. Google uygulamayı onaylayana kadar "Özel" olur;{" "}
        <a href="https://studio.youtube.com" target="_blank">
          YouTube Studio
        </a>
        'dan "Herkese açık" yap.
        {remoteId && (
          <>
            {" "}
            <a href={`https://youtu.be/${remoteId}`} target="_blank">
              Videoyu aç
            </a>
          </>
        )}
      </>
    );
  }
  if (platform === "tiktok") {
    return <>TikTok'ta paylaşıldı. "Sadece ben" görünüyorsa TikTok'ta görünürlüğü Herkes yap.</>;
  }
  return <>Gönderildi.</>;
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(Number(id)) as
    | Video
    | undefined;
  if (!video || !ownAccount(user.id, video.account_id)) notFound();

  const jobs = jobsForVideo(video.id);
  const connections = db
    .prepare("SELECT * FROM connections WHERE account_id = ?")
    .all(video.account_id) as Connection[];
  const running = jobs.some((j) => j.status !== "done" && j.status !== "failed");

  return (
    <>
      {running && <AutoRefresh />}
      <Link href={`/accounts/${video.account_id}`}>← Geri</Link>
      <h1 style={{ marginTop: 12 }}>{video.title}</h1>
      {video.description && <p className="muted pre">{video.description}</p>}

      {jobs.map((job) => {
        const conn = connections.find((c) => c.id === job.target_connection_id);
        if (!conn) return null;
        return (
          <section key={job.id} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="row">
                <strong>{PLATFORM_NAMES[conn.platform]}</strong>
                <span className="muted">{conn.display_name}</span>
              </div>
              <span className={`badge ${job.status}`}>{STATUS_LABELS[job.status]}</span>
            </div>
            {job.error && job.status !== "done" && <p className="error">{job.error}</p>}
            {job.status === "done" && <p className="muted">{doneNote(conn.platform, job.remote_id)}</p>}
            {job.status === "failed" && (
              <form action={retry}>
                <input type="hidden" name="jobId" value={job.id} />
                <input type="hidden" name="videoId" value={video.id} />
                <button>Tekrar dene</button>
              </form>
            )}
          </section>
        );
      })}
    </>
  );
}
