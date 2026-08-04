import Link from "next/link";
import { AuthFrame } from "@/src/auth/components/AuthFrame";
import { SignInForm } from "@/src/auth/components/AuthForms";
import { safeRelativeDestination } from "@/src/auth/redirects";

interface SignInPageProps { searchParams: Promise<{ next?: string; error?: string }> }

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const query = await searchParams;
  const routeError = query.error === "confirmation" ? "Ссылка подтверждения недействительна или истекла." : query.error === "session" ? "Сессия недействительна. Войдите ещё раз." : undefined;
  return <AuthFrame eyebrow="АККАУНТ" title="Войти в ARCH.START" description="Вход открывает профиль и персональную оболочку «Мой курс». Сам курс остаётся публичным." footer={<p>Нет аккаунта? <Link href="/auth/sign-up">Зарегистрироваться</Link></p>}><SignInForm next={safeRelativeDestination(query.next)} routeError={routeError} /></AuthFrame>;
}
