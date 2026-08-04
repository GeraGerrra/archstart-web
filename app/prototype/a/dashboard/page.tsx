import { AccountDashboard } from "@/src/auth/components/AccountDashboard";
import { requireOnboardedProfile } from "@/src/auth/guards";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccountDashboardPage() {
  const { email, profile } = await requireOnboardedProfile("/prototype/a/dashboard");
  return <AccountDashboard firstName={profile.first_name ?? "участник"} email={email} />;
}
