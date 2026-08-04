import Link from "next/link";
import { AuthFrame } from "@/src/auth/components/AuthFrame";
import { SignUpForm } from "@/src/auth/components/AuthForms";

export default function SignUpPage() {
  return <AuthFrame eyebrow="АККАУНТ" title="Создать аккаунт" description="Используйте email и пароль. Перед первым входом потребуется подтвердить почту." footer={<p>Уже есть аккаунт? <Link href="/auth/sign-in">Войти</Link></p>}><SignUpForm /></AuthFrame>;
}
