import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/app/actions";
import { AuthMobileHead, AuthPanel, PasswordField, SubmitButton } from "@/components/auth";
import { getT } from "@/i18n/server";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUser()) redirect("/");
  const { t } = await getT();
  const { error } = await searchParams;
  const message = error && error in t.errors ? t.errors[error as keyof typeof t.errors] : null;
  return (
    <>
      <AuthPanel kind="login" />
      <section className="auth-main">
        <form action={login} className="auth-form">
          <AuthMobileHead />
          <div className="auth-title">
            <h1>{t.auth.loginTitle}</h1>
            <p className="muted">
              {t.auth.noAccount} <Link href="/register">{t.auth.registerTitle}</Link>
            </p>
          </div>
          {message && <div className="alert" role="alert">{message}</div>}
          <label className="field">
            <span className="field-label">{t.auth.email}</span>
            <input type="email" name="email" autoComplete="email" placeholder={t.auth.emailPlaceholder} required />
          </label>
          <PasswordField isNew={false} />
          <SubmitButton label={t.auth.loginTitle} pending={t.auth.loggingIn} />
        </form>
      </section>
    </>
  );
}
