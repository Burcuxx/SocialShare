"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/i18n/client";
import { LanguageSegment } from "./language";
import { Logo } from "./logo";

export function AuthPanel({ kind }: { kind: "login" | "register" }) {
  const { t } = useT();
  return (
    <section className="auth-panel">
      <Logo size={32} />
      {kind === "login" ? (
        <div className="auth-pitch">
          <h2>
            {t.auth.slogan[0]}
            <br />
            {t.auth.slogan[1]}
          </h2>
          <p>{t.auth.pitch}</p>
          <div className="row">
            <span className="dot-chip"><span className="dot dot-youtube" />YouTube</span>
            <span className="dot-chip"><span className="dot dot-tiktok" />TikTok</span>
            <span className="dot-chip"><span className="dot dot-instagram" />Instagram</span>
          </div>
        </div>
      ) : (
        <div className="auth-pitch">
          <h2>{t.auth.stepsTitle}</h2>
          <ol className="auth-steps">
            {t.auth.steps.map((s, i) => (
              <li key={s}>
                <span className="num">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}
      <LanguageSegment showLabel={false} />
    </section>
  );
}

/** Mobile: logo and language above the form (the panel is hidden ≤860px). */
export function AuthMobileHead() {
  return (
    <div className="auth-mobile-head">
      <Logo size={28} variant="onLight" />
      <LanguageSegment showLabel={false} />
    </div>
  );
}

export function SubmitButton({ label, pending }: { label: string; pending: string }) {
  const { pending: isPending } = useFormStatus();
  return (
    <button className="btn btn-primary btn-wide" disabled={isPending}>
      {isPending ? pending : label}
    </button>
  );
}

/** 0–4: length ≥ 8, length ≥ 12, letters and digits, a symbol or mixed case. */
function score(pw: string) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) s++;
  return s;
}

export function PasswordField({
  isNew,
  error,
}: {
  isNew: boolean;
  error?: string;
}) {
  const { t } = useT();
  const [value, setValue] = useState("");
  const s = score(value);
  const hintId = "password-hint";
  const errorId = "password-error";
  return (
    <label className="field">
      <span className="field-label">{t.auth.password}</span>
      <input
        type="password"
        name="password"
        autoComplete={isNew ? "new-password" : "current-password"}
        minLength={isNew ? 8 : undefined}
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={!!error || undefined}
        aria-describedby={[error && errorId, isNew && hintId].filter(Boolean).join(" ") || undefined}
      />
      {error && <span id={errorId} className="field-error">{error}</span>}
      {isNew && (
        <>
          <span className="strength" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={i <= s ? `on s${s}` : ""} />
            ))}
          </span>
          <span id={hintId} className="muted small">
            {value ? `${t.auth.strengthLabel}: ${t.auth.strength[Math.max(0, s - 1)]} · ` : ""}
            {t.auth.passwordHint}
          </span>
        </>
      )}
    </label>
  );
}
