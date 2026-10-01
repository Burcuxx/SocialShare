import Link from "next/link";

type Props = {
  title: string;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  error?: string;
  footer: { text: string; href: string; link: string };
  newPassword?: boolean;
};

export function AuthForm({ title, action, submitLabel, error, footer, newPassword }: Props) {
  return (
    <div className="auth">
      <form action={action} className="card stack auth-card">
        <div className="brand">Social Share</div>
        <h1>{title}</h1>
        {error && <p className="error">{error}</p>}
        <label className="field">
          <span>E-posta</span>
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label className="field">
          <span>Şifre</span>
          <input
            type="password"
            name="password"
            autoComplete={newPassword ? "new-password" : "current-password"}
            minLength={newPassword ? 8 : undefined}
            required
          />
          {newPassword && <small className="muted">En az 8 karakter</small>}
        </label>
        <button className="primary wide">{submitLabel}</button>
        <p className="muted">
          {footer.text} <Link href={footer.href}>{footer.link}</Link>
        </p>
      </form>
    </div>
  );
}
