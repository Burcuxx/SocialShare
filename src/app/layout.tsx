import type { Metadata, Viewport } from "next";
import { Sidebar } from "@/components/sidebar";
import { db, type Account } from "@/lib/db";
import "./globals.css";

export const metadata: Metadata = { title: "Social Share" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const accounts = db.prepare("SELECT id, name FROM accounts ORDER BY id").all() as Pick<
    Account,
    "id" | "name"
  >[];
  return (
    <html lang="tr">
      <body>
        <div className="app">
          <Sidebar accounts={accounts} />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
