import { redirect } from "next/navigation";
import { register } from "@/app/actions";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await currentUser()) redirect("/");
  const { error } = await searchParams;
  return (
    <AuthForm
      title="Kayıt ol"
      action={register}
      submitLabel="Kayıt ol"
      error={error}
      newPassword
      footer={{ text: "Zaten hesabın var mı?", href: "/login", link: "Giriş yap" }}
    />
  );
}
