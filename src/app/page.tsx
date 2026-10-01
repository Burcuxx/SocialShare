import { db, type Account, type Connection, type Video } from "@/lib/db";
import { createAccount, refreshVideos } from "./actions";

export const dynamic = "force-dynamic";

function formatDuration(sec: number | null) {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const accounts = db.prepare("SELECT * FROM accounts ORDER BY id").all() as Account[];
  const connections = db.prepare("SELECT * FROM connections ORDER BY id").all() as Connection[];
  const videos = db
    .prepare("SELECT * FROM videos ORDER BY published_at DESC")
    .all() as Video[];

  return (
    <>
      <h1>Social Share</h1>
      {error && <div className="error">{error}</div>}

      {accounts.map((account) => {
        const youtube = connections.filter(
          (c) => c.account_id === account.id && c.platform === "youtube",
        );
        return (
          <section key={account.id} className="account">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>{account.name}</h2>
              <a className="button" href={`/api/auth/youtube?accountId=${account.id}`}>
                + YouTube bağla
              </a>
            </div>
            {youtube.length === 0 && <p className="muted">Bağlı YouTube kanalı yok.</p>}

            {youtube.map((conn) => {
              const list = videos.filter((v) => v.connection_id === conn.id);
              return (
                <div key={conn.id} className="channel">
                  <div className="row">
                    <strong>{conn.display_name}</strong>
                    <span className="muted">{list.length} video</span>
                    <form action={refreshVideos}>
                      <input type="hidden" name="connectionId" value={conn.id} />
                      <button>Yenile</button>
                    </form>
                  </div>
                  <div className="grid">
                    {list.map((v) => (
                      <div key={v.id} className="video">
                        {v.thumbnail_url && <img src={v.thumbnail_url} alt="" loading="lazy" />}
                        <div className="body">
                          <p className="title">{v.title}</p>
                          <span className="muted">
                            {formatDuration(v.duration_sec)}
                            {v.published_at &&
                              ` · ${new Date(v.published_at).toLocaleDateString("tr-TR")}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      <form action={createAccount} className="row account">
        <input type="text" name="name" placeholder="Yeni hesap adı" required />
        <button className="primary">Hesap ekle</button>
      </form>
    </>
  );
}
