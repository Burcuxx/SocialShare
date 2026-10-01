"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { createAccount } from "@/app/actions";

type Item = { id: number; name: string };

export function Sidebar({ accounts }: { accounts: Item[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activeId = Number(pathname.match(/^\/accounts\/(\d+)/)?.[1]);
  const active = accounts.find((a) => a.id === activeId);

  return (
    <aside className={`sidebar${open ? " open" : ""}`}>
      <div className="sidebar-top">
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          Social Share
        </Link>
        <button
          className="menu-button"
          aria-label="Menü"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {active?.name ?? "Hesaplar"} ☰
        </button>
      </div>
      <nav>
        <p className="muted nav-title">Hesaplar</p>
        {accounts.map((a) => (
          <Link
            key={a.id}
            href={`/accounts/${a.id}`}
            className={`nav-item${a.id === activeId ? " active" : ""}`}
            onClick={() => setOpen(false)}
          >
            {a.name}
          </Link>
        ))}
        <form action={createAccount} className="nav-form">
          <input type="text" name="name" placeholder="Yeni hesap" required />
          <button aria-label="Hesap ekle">+</button>
        </form>
      </nav>
    </aside>
  );
}
