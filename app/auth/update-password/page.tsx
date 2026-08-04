import { AuthFrame } from "@/src/auth/components/AuthFrame";
import { UpdatePasswordForm } from "@/src/auth/components/AuthForms";
import { requireAuth } from "@/src/auth/guards";
import { PASSWORD_POLICY_COPY_RU } from "@/src/auth/password-policy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UpdatePasswordPage() {
  await requireAuth("/auth/update-password");
  return <AuthFrame eyebrow="БЕЗОПАСНОСТЬ" title="Новый пароль" description={PASSWORD_POLICY_COPY_RU}><UpdatePasswordForm /></AuthFrame>;
}
