import { redirect } from "next/navigation";
import { login } from "@/app/actions";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUser()) redirect("/");
  const { error } = await searchParams;
  return (
    <AuthForm
      title="Giriş yap"
      action={login}
      submitLabel="Giriş yap"
      error={error}
      footer={{ text: "Hesabın yok mu?", href: "/register", link: "Kayıt ol" }}
    />
  );
}
