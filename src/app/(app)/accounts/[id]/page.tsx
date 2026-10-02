import { notFound } from "next/navigation";
import { AccountHeader } from "@/components/account-header";
import { DeleteAccount } from "@/components/delete-account";
import { PlatformMark } from "@/components/platform-mark";
import { getT } from "@/i18n/server";
import { ownAccount, requireUser } from "@/lib/auth";
import { db, type Connection } from "@/lib/db";
import { PLATFORM_NAMES } from "@/lib/labels";
import { needsReconnect } from "@/lib/reconnect";
import { NewPostForm } from "./new-post-form";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { t } = await getT();
  const { id } = await params;
  const { error } = await searchParams;
  const account = ownAccount(user.id, Number(id));
  if (!account) notFound();

  const connections = db
    .prepare("SELECT * FROM connections WHERE account_id = ? ORDER BY platform, id")
    .all(account.id) as Connection[];
  // Connections whose unfinished jobs failed on permissions or an expired login.
  const stale = new Set(
    (
      db
        .prepare(
          `SELECT target_connection_id AS id, error FROM jobs
           WHERE status IN ('pending', 'failed') AND error IS NOT NULL
             AND target_connection_id IN (SELECT id FROM connections WHERE account_id = ?)`,
        )
        .all(account.id) as { id: number; error: string }[]
    )
      .filter((j) => needsReconnect(j.error))
      .map((j) => j.id),
  );
  const message = error && error in t.errors ? t.errors[error as keyof typeof t.errors] : error;

  return (
    <div className="page">
      <AccountHeader account={account} tab="new" />
      {message && <div className="alert" role="alert">{message}</div>}

      <section aria-label={t.account.connections} className="card strip">
        <div className="row">
          <span className="muted">{connections.length ? t.account.connected : t.account.none}</span>
          {connections.map((c) => (
            <span key={c.id} className={`conn-chip${stale.has(c.id) ? " conn-stale" : ""}`}>
              <PlatformMark platform={c.platform} size={22} />
              <span className="ellipsis">{c.display_name ?? PLATFORM_NAMES[c.platform]}</span>
              {stale.has(c.id) && (
                <a href={`/api/auth/${c.platform}?accountId=${account.id}`} className="conn-fix">
                  {t.account.reconnect}
                </a>
              )}
            </span>
          ))}
        </div>
        <div className="row">
          <a className="btn btn-sm" href={`/api/auth/youtube?accountId=${account.id}`}>+ YouTube</a>
          <a className="btn btn-sm" href={`/api/auth/tiktok?accountId=${account.id}`}>+ TikTok</a>
          <a className="btn btn-sm" href={`/api/auth/instagram?accountId=${account.id}`}>+ Instagram</a>
        </div>
      </section>

      <NewPostForm
        accountId={account.id}
        targets={connections.map((c) => ({
          id: c.id,
          platform: c.platform,
          name: c.display_name ?? PLATFORM_NAMES[c.platform],
        }))}
      />

      <DeleteAccount accountId={account.id} name={account.name} />
    </div>
  );
}
