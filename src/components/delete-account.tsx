"use client";

import { deleteAccount } from "@/app/actions";
import { useT } from "@/i18n/client";

export function DeleteAccount({ accountId, name }: { accountId: number; name: string }) {
  const { t } = useT();
  return (
    <section className="card danger">
      <div className="stack-tight">
        <h2>{t.account.deleteTitle}</h2>
        <p className="muted">{t.account.deleteHint}</p>
      </div>
      <form
        action={deleteAccount}
        onSubmit={(e) => {
          if (!confirm(t.account.deleteConfirm(name))) e.preventDefault();
        }}
      >
        <input type="hidden" name="accountId" value={accountId} />
        <button className="btn btn-danger">{t.account.deleteButton}</button>
      </form>
    </section>
  );
}
