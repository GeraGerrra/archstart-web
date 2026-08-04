import { redirect } from "next/navigation";
import { AuthFrame } from "@/src/auth/components/AuthFrame";
import { OnboardingForm } from "@/src/auth/components/AuthForms";
import { requireAuth } from "@/src/auth/guards";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OnboardingPage() {
  const context = await requireAuth("/onboarding");
  if (context.profile?.onboarding_completed_at) redirect("/prototype/a/dashboard");
  return <AuthFrame eyebrow="ПЕРВЫЙ ВХОД" title="Настроим профиль" description="Ответьте на один вопрос. Эти данные принадлежат только вашему профилю."><OnboardingForm initial={{ firstName: context.profile?.first_name ?? "", lastName: context.profile?.last_name ?? "", discoverySource: context.profile?.discovery_source ?? "" }} /></AuthFrame>;
}
