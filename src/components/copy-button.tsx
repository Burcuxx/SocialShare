"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";

export function CopyButton({ text }: { text: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }}
    >
      {copied ? t.post.copied : t.post.copyCaption}
    </button>
  );
}
