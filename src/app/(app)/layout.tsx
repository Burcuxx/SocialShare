import { Sidebar } from "@/components/sidebar";
import { requireUser } from "@/lib/auth";
import { db, type Account } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Every page in (app) needs a signed-in user. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const accounts = db
    .prepare("SELECT id, name FROM accounts WHERE user_id = ? ORDER BY id")
    .all(user.id) as Pick<Account, "id" | "name">[];
  return (
    <div className="shell">
      <Sidebar accounts={accounts} email={user.email} />
      <main className="content">{children}</main>
    </div>
  );
}
