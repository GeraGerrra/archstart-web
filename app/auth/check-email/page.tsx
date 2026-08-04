import Link from "next/link";
import { AuthFrame } from "@/src/auth/components/AuthFrame";

interface CheckEmailPageProps { searchParams: Promise<{ mode?: string }> }

export default async function CheckEmailPage({ searchParams }: CheckEmailPageProps) {
  const query = await searchParams;
  const recovery = query.mode === "recovery";
  return <AuthFrame eyebrow="EMAIL" title="Проверьте почту" description={recovery ? "Если аккаунт с таким адресом существует, мы отправили ссылку для смены пароля." : "Мы отправили письмо для подтверждения аккаунта. Перейдите по ссылке, чтобы продолжить настройку профиля."} footer={<p><Link href="/auth/sign-in">Вернуться ко входу</Link></p>}><div className="asa-auth__notice"><strong>{recovery ? "Восстановление пароля" : "Подтверждение email"}</strong><p>Если письма нет, проверьте папку «Спам» и правильность адреса.</p></div></AuthFrame>;
}
