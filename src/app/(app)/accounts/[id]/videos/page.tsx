import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountHeader } from "@/components/account-header";
import { ChevronRight, Search } from "@/components/icons";
import { StatusChip } from "@/components/status-chip";
import { VideoThumb } from "@/components/video-thumb";
import { formatDate } from "@/i18n";
import { getT } from "@/i18n/server";
import { ownAccount, requireUser } from "@/lib/auth";
import { db, isScheduled, type JobStatus, type Platform, type Video } from "@/lib/db";
import { PLATFORM_NAMES } from "@/lib/labels";

export const dynamic = "force-dynamic";

const PAGE = 20;
const FILTERS = ["all", "scheduled", "processing", "completed", "failed"] as const;
type Filter = (typeof FILTERS)[number];

type Row = Video & { total: number; done: number; failed: number };

/** Any failed job → failed; waiting for its time → scheduled; every job done → completed; else processing. */
function category(v: Row): Exclude<Filter, "all"> {
  if (v.failed > 0) return "failed";
  if (isScheduled(v)) return "scheduled";
  if (v.done === v.total) return "completed";
  return "processing";
}

export default async function VideosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; q?: string; limit?: string }>;
}) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const { id } = await params;
  const sp = await searchParams;
  const account = ownAccount(user.id, Number(id));
  if (!account) notFound();

  const q = (sp.q ?? "").trim();
  const filter: Filter = FILTERS.includes(sp.status as Filter) ? (sp.status as Filter) : "all";
  const limit = Math.max(PAGE, Number(sp.limit) || PAGE);

  const rows = db
    .prepare(
      `SELECT v.*, COUNT(j.id) AS total,
              COALESCE(SUM(j.status = 'done'), 0) AS done,
              COALESCE(SUM(j.status = 'failed'), 0) AS failed
       FROM videos v LEFT JOIN jobs j ON j.video_id = v.id
       WHERE v.account_id = ? AND v.title LIKE ?
       GROUP BY v.id ORDER BY v.id DESC`,
    )
    .all(account.id, `%${q}%`) as Row[];
  const counts = { all: rows.length, scheduled: 0, processing: 0, completed: 0, failed: 0 };
  for (const r of rows) counts[category(r)]++;
  const filtered = filter === "all" ? rows : rows.filter((r) => category(r) === filter);
  const shown = filtered.slice(0, limit);

  const jobs = db
    .prepare(
      `SELECT j.video_id, j.status, c.platform FROM jobs j
       JOIN connections c ON c.id = j.target_connection_id
       JOIN videos v ON v.id = j.video_id
       WHERE v.account_id = ? ORDER BY c.platform`,
    )
    .all(account.id) as { video_id: number; status: JobStatus; platform: Platform }[];

  const href = (next: { status?: Filter; limit?: number }) => {
    const p = new URLSearchParams();
    const s = next.status ?? filter;
    if (s !== "all") p.set("status", s);
    if (q) p.set("q", q);
    if (next.limit) p.set("limit", String(next.limit));
    const qs = p.toString();
    return `/accounts/${account.id}/videos${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="page">
      <AccountHeader account={account} tab="videos" />

      <div className="toolbar">
        <nav aria-label={t.videos.filterLabel} className="chips">
          {FILTERS.map((f) => (
            <Link key={f} href={href({ status: f })} className="chip" aria-current={f === filter ? "page" : undefined}>
              {t.videos.filters[f]} · <span className="num">{counts[f]}</span>
            </Link>
          ))}
        </nav>
        <form className="search" role="search">
          <Search />
          <label className="visually-hidden" htmlFor="q">{t.videos.searchLabel}</label>
          <input id="q" type="search" name="q" defaultValue={q} placeholder={t.videos.searchPlaceholder} />
          {filter !== "all" && <input type="hidden" name="status" value={filter} />}
        </form>
      </div>

      {rows.length === 0 && !q ? (
        <div className="card empty">
          <strong>{t.videos.empty}</strong>
          <Link className="btn" href={`/accounts/${account.id}`}>{t.videos.emptyCta}</Link>
        </div>
      ) : (
        <div className="card list">
          <div className="list-head" aria-hidden="true">
            <span />
            <span>{t.videos.colVideo}</span>
            <span>{t.videos.colDate}</span>
            <span>{t.videos.colPlatforms}</span>
            <span />
          </div>
          {shown.length === 0 && <p className="muted list-empty">{t.videos.noResults}</p>}
          {shown.map((v) => (
            <Link key={v.id} href={`/posts/${v.id}`} className="list-row">
              <VideoThumb id={v.id} durationSec={v.duration_sec} />
              <span className="list-title">
                <strong className="ellipsis">{v.title}</strong>
                {v.description && <span className="muted ellipsis">{v.description.split("\n")[0]}</span>}
              </span>
              <span className="muted list-wide">{formatDate(v.scheduled_at ?? v.created_at, locale)}</span>
              <span className="badges list-wide">
                {jobs
                  .filter((j) => j.video_id === v.id)
                  .map((j, i) => (
                    <StatusChip key={i} status={j.status}>
                      {j.status === "pending" && isScheduled(v)
                        ? t.scheduledChip(PLATFORM_NAMES[j.platform])
                        : t.chip(j.status, PLATFORM_NAMES[j.platform])}
                    </StatusChip>
                  ))}
              </span>
              <span className="list-chevron muted"><ChevronRight /></span>
            </Link>
          ))}
          {filtered.length > shown.length && (
            <div className="list-more">
              <Link className="btn" href={href({ limit: limit + PAGE })} scroll={false}>{t.videos.more}</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
