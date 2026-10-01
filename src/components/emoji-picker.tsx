"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";

// A short, hand-picked list; the OS picker (Ctrl+Cmd+Space on Mac) has the rest.
const EMOJIS = [
  "😂", "🤣", "😍", "🥰", "😎", "🤩", "😭", "🥹", "😅", "😉", "🤔", "😱",
  "🔥", "✨", "💯", "❤️", "💜", "💙", "🖤", "💔", "👏", "🙌", "🙏", "👀",
  "🎵", "🎶", "🎤", "🎧", "🎬", "📸", "🎉", "🎂", "⭐", "🌟", "🌈", "☀️",
  "👉", "👇", "✅", "❗", "⚡", "💥", "🚀", "🏆", "🇹🇷", "📌", "💬", "😴",
];

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="emoji" ref={ref}>
      <button
        type="button"
        className="emoji-button"
        aria-label={t.newPost.addEmoji}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8" />
          <path d="M9 9.5h.01M15 9.5h.01" />
        </svg>
      </button>
      {open && (
        <span className="emoji-grid" role="listbox" aria-label={t.newPost.addEmoji}>
          {EMOJIS.map((e) => (
            <button key={e} type="button" role="option" aria-selected={false} onClick={() => onPick(e)}>
              {e}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
