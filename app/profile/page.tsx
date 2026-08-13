import Link from "next/link";
import { AuthFrame } from "@/src/auth/components/AuthFrame";
import { ProfileForm } from "@/src/auth/components/AuthForms";
import { signOutAction } from "@/src/auth/actions";
import { requireOnboardedProfile } from "@/src/auth/guards";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ProfilePageProps { searchParams: Promise<{ saved?: string }> }

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const [context, query] = await Promise.all([requireOnboardedProfile("/profile"), searchParams]);
  return <AuthFrame eyebrow="ПРОФИЛЬ" title="Ваши данные" description="Email хранится в Auth и показан только для чтения." footer={<div className="asa-auth__profile-footer">{query.saved === "1" ? <p role="status">Изменения сохранены.</p> : <Link href="/dashboard">Вернуться в «Мой курс»</Link>}<form action={signOutAction}><button type="submit">Выйти</button></form></div>}><ProfileForm initial={{ firstName: context.profile.first_name ?? "", lastName: context.profile.last_name ?? "", discoverySource: context.profile.discovery_source ?? "", email: context.email }} /></AuthFrame>;
}
