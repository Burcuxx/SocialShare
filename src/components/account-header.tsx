import Link from "next/link";
import { getT } from "@/i18n/server";
import { db, type Account } from "@/lib/db";

/** Account name + "New video | Videos · N" tabs. */
export async function AccountHeader({ account, tab }: { account: Account; tab: "new" | "videos" }) {
  const { t } = await getT();
  const { n } = db
    .prepare("SELECT COUNT(*) AS n FROM videos WHERE account_id = ?")
    .get(account.id) as { n: number };
  return (
    <div className="page-head">
      <h1 className="ellipsis">{account.name}</h1>
      <nav aria-label={t.tabs.sections} className="segment tabs">
        <Link href={`/accounts/${account.id}`} aria-current={tab === "new" ? "page" : undefined}>
          {t.tabs.newVideo}
        </Link>
        <Link href={`/accounts/${account.id}/videos`} aria-current={tab === "videos" ? "page" : undefined}>
          {t.tabs.videos} <span className="num">{n}</span>
        </Link>
      </nav>
    </div>
  );
}
