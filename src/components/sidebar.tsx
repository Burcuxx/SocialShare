"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { createAccount, logout } from "@/app/actions";
import { useT } from "@/i18n/client";
import { ChevronDown } from "./icons";
import { LanguageMenu, LanguageSegment } from "./language";
import { Logo } from "./logo";

type Item = { id: number; name: string };

function initial(name: string) {
  return name.trim().charAt(0).toLocaleUpperCase() || "?";
}

function AccountLinks({ accounts, activeId, onNavigate }: {
  accounts: Item[];
  activeId: number;
  onNavigate?: () => void;
}) {
  const { t } = useT();
  return (
    <>
      {accounts.map((a) => {
        const active = a.id === activeId;
        return (
          <Link
            key={a.id}
            href={`/accounts/${a.id}`}
            className="side-item"
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          >
            <span className="side-initial">{initial(a.name)}</span>
            <span className="ellipsis">{a.name}</span>
          </Link>
        );
      })}
      <form action={createAccount} className="side-form">
        <input type="text" name="name" placeholder={t.nav.newAccount} aria-label={t.nav.newAccount} required />
        <button aria-label={t.nav.addAccount}>+</button>
      </form>
    </>
  );
}

function UserBlock({ email }: { email: string }) {
  const { t } = useT();
  return (
    <div className="side-user">
      <span className="ellipsis">{email}</span>
      <form action={logout}>
        <button className="link-button">{t.nav.logout}</button>
      </form>
    </div>
  );
}

/** Dark sidebar on tablet/desktop; a dark top bar with menus on phones. */
export function Sidebar({ accounts, email }: { accounts: Item[]; email: string }) {
  const { t } = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activeId = Number(pathname.match(/^\/accounts\/(\d+)/)?.[1]);
  const active = accounts.find((a) => a.id === activeId);

  return (
    <>
      <header className="topbar">
        <Link href="/" aria-label="Social Share">
          <Logo size={28} />
        </Link>
        <div className="topbar-actions">
          <LanguageMenu />
          <div className="popover-wrap">
            <button
              type="button"
              className="topbar-button topbar-account"
              aria-label={t.nav.accountsMenu}
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              <span className="ellipsis">{active?.name ?? t.nav.accounts}</span>
              <ChevronDown />
            </button>
            {open && (
              <nav className="popover popover-wide" aria-label={t.nav.accounts}>
                <AccountLinks accounts={accounts} activeId={activeId} onNavigate={() => setOpen(false)} />
                <UserBlock email={email} />
              </nav>
            )}
          </div>
        </div>
      </header>

      <aside className="side">
        <Link href="/" className="side-logo" aria-label="Social Share">
          <Logo size={32} />
        </Link>
        <nav aria-label={t.nav.accounts} className="side-nav">
          <span className="side-label">{t.nav.accounts}</span>
          <AccountLinks accounts={accounts} activeId={activeId} />
        </nav>
        <div className="side-bottom">
          <LanguageSegment />
          <UserBlock email={email} />
        </div>
      </aside>
    </>
  );
}
