import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const { error } = await searchParams;
  const first = db
    .prepare("SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1")
    .get(user.id) as { id: number } | undefined;
  if (first && !error) redirect(`/accounts/${first.id}`);

  return (
    <>
      <h1>Hoş geldin</h1>
      {error && <div className="error">{error}</div>}
      <p className="muted">Başlamak için menüden bir hesap ekle.</p>
    </>
  );
}
