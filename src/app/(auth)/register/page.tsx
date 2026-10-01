import Link from "next/link";
import { redirect } from "next/navigation";
import { register } from "@/app/actions";
import { AuthMobileHead, AuthPanel, PasswordField, SubmitButton } from "@/components/auth";
import { getT } from "@/i18n/server";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await currentUser()) redirect("/");
  const { t } = await getT();
  const { error } = await searchParams;
  const message = error && error in t.errors ? t.errors[error as keyof typeof t.errors] : null;
  const emailError = error === "invalidEmail" || error === "emailTaken" ? message : null;
  const passwordError = error === "shortPassword" ? message : null;
  return (
    <>
      <AuthPanel kind="register" />
      <section className="auth-main">
        <form action={register} className="auth-form">
          <AuthMobileHead />
          <div className="auth-title">
            <h1>{t.auth.registerTitle}</h1>
            <p className="muted">
              {t.auth.haveAccount} <Link href="/login">{t.auth.loginTitle}</Link>
            </p>
          </div>
          {message && <div className="alert" role="alert">{message}</div>}
          <label className="field">
            <span className="field-label">{t.auth.email}</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder={t.auth.emailPlaceholder}
              required
              aria-invalid={!!emailError || undefined}
              aria-describedby={emailError ? "email-error" : undefined}
            />
            {emailError && <span id="email-error" className="field-error">{emailError}</span>}
          </label>
          <PasswordField isNew error={passwordError ?? undefined} />
          <SubmitButton label={t.auth.registerTitle} pending={t.auth.registering} />
        </form>
      </section>
    </>
  );
}
