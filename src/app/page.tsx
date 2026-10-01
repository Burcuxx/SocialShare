import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const first = db.prepare("SELECT id FROM accounts ORDER BY id LIMIT 1").get() as
    | { id: number }
    | undefined;
  if (first && !error) redirect(`/accounts/${first.id}`);

  return (
    <>
      <h1>Social Share</h1>
      {error && <div className="error">{error}</div>}
      <p className="muted">Başlamak için menüden bir hesap ekle.</p>
    </>
  );
}
