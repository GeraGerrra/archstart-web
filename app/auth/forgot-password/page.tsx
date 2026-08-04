import Link from "next/link";
import { AuthFrame } from "@/src/auth/components/AuthFrame";
import { ForgotPasswordForm } from "@/src/auth/components/AuthForms";

export default function ForgotPasswordPage() {
  return <AuthFrame eyebrow="ВОССТАНОВЛЕНИЕ" title="Сбросить пароль" description="Введите email. Ответ страницы не раскрывает, зарегистрирован ли этот адрес." footer={<p><Link href="/auth/sign-in">Вернуться ко входу</Link></p>}><ForgotPasswordForm /></AuthFrame>;
}
