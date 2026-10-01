import Link from "next/link";
import { notFound } from "next/navigation";
import { db, type Account, type Connection, type JobStatus, type Video } from "@/lib/db";
import { PLATFORM_NAMES } from "@/lib/labels";
import { NewPostForm } from "./new-post-form";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(Number(id)) as
    | Account
    | undefined;
  if (!account) notFound();

  const connections = db
    .prepare("SELECT * FROM connections WHERE account_id = ? ORDER BY platform, id")
    .all(account.id) as Connection[];
  const videos = db
    .prepare("SELECT * FROM videos WHERE account_id = ? ORDER BY id DESC LIMIT 50")
    .all(account.id) as Video[];
  const jobs = db
    .prepare(
      `SELECT j.video_id, j.status, c.platform FROM jobs j
       JOIN connections c ON c.id = j.target_connection_id
       JOIN videos v ON v.id = j.video_id
       WHERE v.account_id = ?`,
    )
    .all(account.id) as { video_id: number; status: JobStatus; platform: Connection["platform"] }[];

  return (
    <>
      <h1>{account.name}</h1>
      {error && <div className="error">{error}</div>}

      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row">
            {connections.length === 0 && <span className="muted">Bağlı platform yok.</span>}
            {connections.map((c) => (
              <span key={c.id} className="chip">
                {PLATFORM_NAMES[c.platform]}: {c.display_name}
              </span>
            ))}
          </div>
          <div className="row">
            <a className="button" href={`/api/auth/youtube?accountId=${account.id}`}>
              + YouTube
            </a>
            <a className="button" href={`/api/auth/tiktok?accountId=${account.id}`}>
              + TikTok
            </a>
          </div>
        </div>
      </section>

      <NewPostForm
        accountId={account.id}
        targets={connections.map((c) => ({
          id: c.id,
          platform: c.platform,
          label: `${PLATFORM_NAMES[c.platform]} (${c.display_name})`,
        }))}
      />

      {videos.length > 0 && <h2 style={{ marginTop: 24 }}>Gönderilenler</h2>}
      {videos.map((v) => (
        <Link key={v.id} href={`/posts/${v.id}`} className="card post-row">
          <div>
            <strong>{v.title}</strong>
            <div className="muted">{new Date(v.created_at + "Z").toLocaleString("tr-TR")}</div>
          </div>
          <div className="badges">
            {jobs
              .filter((j) => j.video_id === v.id)
              .map((j, i) => (
                <span key={i} className={`badge ${j.status}`}>
                  {PLATFORM_NAMES[j.platform]}
                </span>
              ))}
          </div>
        </Link>
      ))}
    </>
  );
}
