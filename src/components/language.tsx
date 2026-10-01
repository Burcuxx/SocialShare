"use client";

import { useId, useState, useTransition } from "react";
import { setLocale } from "@/app/actions";
import { LOCALE_NAMES, LOCALES } from "@/i18n";
import { useT } from "@/i18n/client";

/** Segment with every language; used in the sidebar and on the auth panel. */
export function LanguageSegment({ showLabel = true }: { showLabel?: boolean }) {
  const { t, locale } = useT();
  const [, startTransition] = useTransition();
  const labelId = useId();
  return (
    <div className="lang">
      {showLabel && (
        <span id={labelId} className="side-label">
          {t.nav.language}
        </span>
      )}
      <div
        role="radiogroup"
        aria-labelledby={showLabel ? labelId : undefined}
        aria-label={showLabel ? undefined : t.nav.language}
        className="segment segment-dark"
      >
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={l === locale}
            onClick={() => startTransition(() => setLocale(l))}
          >
            {LOCALE_NAMES[l]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Compact "TR" button with a small menu; used in the phone top bar. */
export function LanguageMenu() {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  return (
    <div className="popover-wrap">
      <button
        type="button"
        className="topbar-button"
        aria-label={t.nav.languageMenu(LOCALE_NAMES[locale])}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {locale.toUpperCase()}
      </button>
      {open && (
        <div className="popover" role="radiogroup" aria-label={t.nav.language}>
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={l === locale}
              onClick={() => {
                setOpen(false);
                startTransition(() => setLocale(l));
              }}
            >
              {LOCALE_NAMES[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
