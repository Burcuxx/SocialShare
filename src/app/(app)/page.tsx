import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const { t } = await getT();
  const { error } = await searchParams;
  const first = db
    .prepare("SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1")
    .get(user.id) as { id: number } | undefined;
  if (first && !error) redirect(`/accounts/${first.id}`);

  return (
    <div className="page">
      <h1>{t.home.welcome}</h1>
      {error && <div className="alert" role="alert">{error}</div>}
      <p className="muted">{t.home.start}</p>
    </div>
  );
}
