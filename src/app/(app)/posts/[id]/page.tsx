import Link from "next/link";
import { notFound } from "next/navigation";
import { retry } from "@/app/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { ChevronLeft, Retry } from "@/components/icons";
import { PlatformMark } from "@/components/platform-mark";
import { StatusChip } from "@/components/status-chip";
import { VideoThumb } from "@/components/video-thumb";
import { formatDate, formatDuration } from "@/i18n";
import { getT } from "@/i18n/server";
import { ownAccount, requireUser } from "@/lib/auth";
import { db, type Connection, type Job, type Video } from "@/lib/db";
import { jobsForVideo } from "@/lib/jobs";
import { PLATFORM_NAMES } from "@/lib/labels";

export const dynamic = "force-dynamic";

/** 0 = queued, 1 = uploading, 2 = sent. */
function stepOf(job: Job) {
  if (job.status === "done") return 2;
  if (job.status === "pending") return 0;
  return 1;
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const { id } = await params;
  const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(Number(id)) as Video | undefined;
  const account = video && ownAccount(user.id, video.account_id);
  if (!video || !account) notFound();

  const jobs = jobsForVideo(video.id);
  const connections = db
    .prepare("SELECT * FROM connections WHERE account_id = ?")
    .all(video.account_id) as Connection[];
  const running = jobs.some((j) => j.status !== "done" && j.status !== "failed");
  const doneCount = jobs.filter((j) => j.status === "done").length;
  const dur = formatDuration(video.duration_sec);
  const steps = [t.post.stepQueued, t.post.stepUploading, t.post.stepSent];

  return (
    <div className="page">
      {running && <AutoRefresh />}
      <Link href={`/accounts/${account.id}/videos`} className="back">
        <ChevronLeft /> {t.post.back}
      </Link>

      <div className="cols cols-post">
        <section className="stack">
          <VideoThumb id={video.id} durationSec={video.duration_sec} large />
          <h1 className="post-title">{video.title}</h1>
          <div className="meta muted">
            <span>{account.name}</span>
            <span>{formatDate(video.created_at, locale)}</span>
            {dur && <span className="num">{dur}</span>}
          </div>
          {video.description && <p className="post-desc">{video.description}</p>}
        </section>

        <section className="stack">
          <div className="section-head">
            <h2>{t.post.platforms}</h2>
            <span className="muted">
              <span className="num">{doneCount} / {jobs.length}</span> {t.post.completed}
            </span>
          </div>

          {jobs.map((job) => {
            const conn = connections.find((c) => c.id === job.target_connection_id);
            if (!conn) return null;
            const active = job.status !== "done" && job.status !== "failed";
            const step = stepOf(job);
            return (
              <article key={job.id} className={`card job${active ? " job-active" : ""}`}>
                <div className="job-head">
                  <PlatformMark platform={conn.platform} />
                  <span className="target-body">
                    <strong>{PLATFORM_NAMES[conn.platform]}</strong>
                    <span className="muted ellipsis">{conn.display_name}</span>
                  </span>
                  <StatusChip status={job.status}>
                    {job.status === "failed"
                      ? t.post.failedAttempts(job.attempts)
                      : job.status === "done"
                        ? `✓ ${t.status.done}`
                        : t.status[job.status]}
                  </StatusChip>
                </div>

                {active && (
                  <>
                    <ol className="steps" aria-label={t.post.steps}>
                      {steps.map((label, i) => (
                        <li
                          key={label}
                          className={i < step ? "step-done" : i === step ? "step-current" : ""}
                          aria-current={i === step ? "step" : undefined}
                        >
                          <span className="step-bar" />
                          {i < step ? `✓ ${label}` : label}
                        </li>
                      ))}
                    </ol>
                    {job.error && <div className="alert">{job.error}</div>}
                    <span className="muted">{t.post.autoRefresh}</span>
                  </>
                )}

                {job.status === "done" && (
                  <>
                    <div className="note">{t.post.done[conn.platform]}</div>
                    {conn.platform === "youtube" && (
                      <div className="row">
                        {job.remote_id && (
                          <a className="btn btn-sm" href={`https://youtu.be/${job.remote_id}`} target="_blank" rel="noreferrer">
                            {t.post.openVideo} ↗
                          </a>
                        )}
                        <a className="btn btn-sm" href="https://studio.youtube.com" target="_blank" rel="noreferrer">
                          {t.post.studio} ↗
                        </a>
                      </div>
                    )}
                  </>
                )}

                {job.status === "failed" && (
                  <>
                    {job.error && <div className="alert">{job.error}</div>}
                    <form action={retry}>
                      <input type="hidden" name="jobId" value={job.id} />
                      <input type="hidden" name="videoId" value={video.id} />
                      <button className="btn">
                        <Retry /> {t.post.retry}
                      </button>
                    </form>
                  </>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
